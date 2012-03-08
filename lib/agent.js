/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var dgram = require('dgram');
var util = require('util');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');
var MIB = require('./mib');

var AGENT_PROBES = {
	/* id, op, srcaddr */
	'agent-req-start': [ 'int', 'int', 'char *' ],
	/* id, op, srcaddr, status, index */
	'agent-req-done': [ 'int', 'int', 'char *', 'int', 'int' ],
	/* id, op, index, oid */
	'agent-varbind-dispatch': [ 'int', 'int', 'int', 'char *' ],
	/* id, op, index, oid, result */
	'agent-varbind-result': [ 'int', 'int', 'int', 'char *', 'char *' ]
};

function
Agent(options)
{
	var self = this;

	if (typeof (options) !== 'object')
		throw new TypeError('options (object) is required');
	if (typeof (options.log) !== 'object')
		throw new TypeError('options.log (object) is required');
	if (typeof (options.dtrace) !== 'object')
		throw new TypeError('options.dtrace (object) is required');

	this._log = options.log;
	this._dtrace = options.dtrace;
	this._name = options.name || 'snmpjs';

	Object.keys(AGENT_PROBES).forEach(function (p) {
		var args = AGENT_PROBES[p].splice(0);
		args.unshift(p);

		self._dtrace.addProbe.apply(self._dtrace, args);
	});

	this._dtrace.enable();

	this._mib = new MIB();
	this._malformed_messages = 0;
}

/*
 * The provider is expected to provide one of three things for each iteration
 * requested of it:
 *
 * - undefined, meaning that there is no matching instance.  This should happen
 *   only for tabular providers; scalar providers are never passed GetNext
 *   requests nor any Get or Set with an instance other than 0.
 *
 * - an integer, representing an error status from the set of errors enumerated
 *   in protocol/pdu.js.
 *
 * - an instance of SnmpVarbind containing the data requested.
 *
 * These end up here, one way or another, and we just stuff them into the
 * response object.
 */
function
_varbind_set_single(req, rsp, idx, vb)
{
	if (typeof (vb) === 'undefined') {
		rsp.pdu.varbinds[idx] = req.pdu.varbinds[idx].clone();
		rsp.pdu.varbinds[idx].data = data.createData({ type: 'Null',
		    value: data.noSuchInstance });
	} else if (typeof (vb) === 'number') {
		rsp.pdu.varbinds[idx] = req.pdu.varbinds[idx].clone();
		if (!rsp.pdu.error_status || idx + 1 < rsp.pdu.error_index) {
			rsp.pdu.error_status = vb;
			rsp.pdu.error_index = idx + 1;
		}
	} else if (typeof (vb) !== 'object' ||
	    !(vb instanceof varbind.SnmpVarbind)) {
		throw new TypeError('Response data is of incompatible type');
	} else {
		rsp.pdu.varbinds[idx] = vb;
	}
}

Agent.prototype._transmit_response = function _transmit_response(rsp) {
	var sock;
	var dst = rsp.dst;

	rsp.encode();
	this._log.trace({ raw: rsp.raw, dst: dst, snmpmsg: rsp },
			    'Sending SNMP response message');
	sock = dgram.createSocket(dst.family);
	sock.send(rsp.raw.buf, 0, rsp.raw.len, dst.port, dst.address);
};

Agent.prototype._do_getset = function _do_getset(req, rsp) {
	var self = this;
	var nvb = req.pdu.varbinds.length;
	var ndone = 0;

	req.pdu.varbinds.forEach(function (vb, i) {
		var loc = self._mib.lookup(vb.oid);

		loc.op = req.pdu.op;

		if (!loc.objoid) {
			loc.handler = function _getset_errhandler(arg) {
				var rsd = data.createData({ type: 'Null',
				    value: data.noSuchObject });
				var rsvb = varbind.createVarbind({
				    oid: arg.oid, data: rsd });
				arg.done(rsvb);
			};
		}

		loc.done = function _getset_done(rsvb) {
			_varbind_set_single(req, rsp, i, rsvb);
			if (++ndone == nvb)
				self._transmit_response(rsp);
		};
		loc.handler(loc);
	});
};

Agent.prototype._do_getnext_one =
    function (req, rsp, i, oid, cookie, first) {
	var self = this;
	var loc = this._mib.lookup_next(oid, first);
	var nvb = req.pdu.varbinds.length;

	loc.op = PDU.GetNextRequest;

	if (!loc.objoid) {
		loc.handler = function _getnext_errhandler(arg) {
			var rsd = data.createData({ type: 'Null',
			    value: data.endOfMibView });
			var rsvb = varbind.createVarbind({
			    oid: arg.oid, data: rsd });
			arg.done(rsvb);
		};
	}

	loc.done = function _getnext_done(rsvb) {
		if (rsvb !== undefined) {
			_varbind_set_single(req, rsp, i, rsvb);
			if (++cookie.ndone == nvb)
				self._transmit_response(rsp);
			return;
		}
		self._do_getnext_one(req, rsp, i, loc.objoid, cookie, false);
	};

	loc.handler(loc);
};

Agent.prototype._do_getnext = function _do_getnext(req, rsp) {
	var self = this;
	var cookie = { ndone: 0 };

	req.pdu.varbinds.forEach(function (vb, i) {
		self._do_getnext_one(req, rsp, i, vb.oid, cookie, true);
	});
};

Agent.prototype._do_getbulk = function _do_getbulk(req, rsp) {
	/* XXX yuck */
};

Agent.prototype._process_req = function _process_req(req) {
	var rsp;

	assert.ok(req.version >= 0 && req.version <= 1);

	/* XXX check community here */

	rsp = message.createMessage({ version: req.version,
	    community: req.community });
	rsp.dst = req.src;

	rsp.pdu = PDU.createPDU({ op: PDU.Response,
	    request_id: req.pdu.request_id });
	rsp.pdu.error_status = 0;
	rsp.pdu.error_index = 0;

	switch (req.pdu.op) {
	case PDU.GetRequest:
	case PDU.SetRequest:
		this._do_getset(req, rsp);
		break;
	case PDU.GetNextRequest:
		this._do_getnext(req, rsp);
		break;
	case PDU.GetBulkRequest:
		this._do_getbulk(req, rsp);
		break;
	case PDU.Response:
	case PDU.Trap:
	case PDU.InformRequest:
	case PDU.SNMPv2_Trap:
	case PDU.Report:
	default:
		this._log.debug({
			raw: req.raw,
			origin: req.src,
			snmpmsg: req
		    }, 'Ignoring PDU of inappropriate type ' +
		        PDU.strop(req.pdu.op));
		break;
	}
};

Agent.prototype._recv = function _recv(raw, src) {
	var req;

	try {
		req = message.parseMessage(raw, src);
	} catch (err) {
		/* XXX in some cases we can reply with an error */
		this.malformed_messages++;
		this._log.debug({
			err: err,
			raw: raw,
			origin: src }, 'Invalid SNMP message');
		return;
	}

	this._log.trace({ raw: raw, origin: src, snmpmsg: req },
	    'Received SNMP message');
	this._process_req(req);
};

Agent.prototype.bind = function bind(family, port) {
	var self = this;

	this.connection = dgram.createSocket(family);
	this.connection.on('message', function _recv_binder(msg, rinfo) {
		var raw = {
			buf: msg,
			len: rinfo.size
		};
		var src = {
			family: family,
			address: rinfo.address,
			port: rinfo.port
		};
		self._recv(raw, src);
	});
	this.connection.bind(port);
};

Agent.prototype.request = function request(oid, handler, columns) {
	var prov;

	if (typeof (oid) === 'string') {
		if (typeof (handler) !== 'function')
			throw new TypeError('handler must be a function');

		this.mib.add({
			oid: oid,
			handler: handler,
			columns: columns
		});

		return;
	}

	prov = oid;
	if (typeof (prov) === 'object') {
		this._mib.add(prov);
		return;
	}

	throw new TypeError('MIB provider must be specified');
};

Agent.prototype.close = function close() {
	if (!this.connection)
		return;
	this.connection.close();
};

module.exports = Agent;
