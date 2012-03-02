/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var dgram = require('dgram');
var util = require('util');
var bunyan = require('bunyan');
var dtrace = require('./dtrace');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');
var mib = require('./mib');

function
bunyan_serialize_raw(raw)
{
	var obj = {
		buf: (raw.buf ? raw.buf.inspect() : '<empty>'),
		len: raw.len || 0
	};
	return (obj);
}

function
bunyan_serialize_endpoint(endpoint)
{
	var obj = {
		family: endpoint.family || '<unknown>',
		address: endpoint.address || '<unknown>',
		port: endpoint.port || 0
	};
	return (obj);
}

function
fireDTraceProbe()
{
}

function
Agent(options) {
	var serializers = {
		err: bunyan.stdSerializers.err,
		raw: bunyan_serialize_raw,
		origin: bunyan_serialize_endpoint,
		dst: bunyan_serialize_endpoint,
		snmpmsg: message.serializer
	};

	if (options) {
		if (typeof (options) !== 'object')
			throw new TypeError('options must be an object');
		if (options.log && typeof (options.log) !== 'object')
			throw new TypeError('options.log must be an object');
	} else {
		options = {};
	}

	if (!options.log) {
		this.log = new bunyan({
			name: options.name || 'snmp',
			level: 'info',
			stream: process.stderr,
			serializers: serializers
		});
	} else {
		this.log = options.log.child({
			component: 'snmp-agent',
			serializers: serializers
		});
	}

	this._mib = mib.createSnmpMIB();
	this._malformed_messages = 0;
}

Agent.prototype._dispatch_varbind = function (req, rsp, idx, next) {
	var rqvb = req.pdu.varbinds[idx];
	var arg = {};
	var loc = this._mib.lookup(rqvb.oid);

	if (!loc) {
		if (req.pdu.op == PDU.GetRequest ||
		    req.pdu.op == PDU.SetRequest) {
			next(data.noSuchObject);
			return;
		}
		/* XXX next/bulk */
	}

	arg = {
		op: req.pdu.op,
		instance: loc.instance,
		value: (req.pdu.op == PDU.SetRequest) ? rqvb.data : undefined,
		iterate: 1, /* XXX */
		next: next
	};
	loc.node.handler(arg);
};

Agent.prototype._transmit_response = function _transmit_response(rsp) {
	var sock;
	var dst = rsp.dst;

	rsp.encode();
	this.log.trace({ raw: rsp.raw, dst: dst, snmpmsg: rsp },
			    'Sending SNMP response message');
	sock = dgram.createSocket(dst.family);
	sock.send(rsp.raw.buf, 0, rsp.raw.len, dst.port, dst.address);
};

function
_varbind_set(req, pdu, idx, vb)
{
	if (typeof (vb) === 'number') {
		pdu.varbinds[idx] = req.pdu.varbinds[idx].clone();
		if (!pdu.error_status || idx + 1 < pdu.error_index) {
			pdu.error_status = vb;
			pdu.error_index = idx + 1;
		}
	} else {
		pdu.varbinds[idx] = vb;
	}
}

Agent.prototype._process_singleton = function (req, rsp) {
	var self = this;
	var pdu = rsp.pdu;
	var nvb = req.pdu.varbinds.length;
	var ndone = 0;

	req.pdu.varbinds.forEach(function (vb, i) {
	    self._dispatch_varbind(req, rsp, i, function (rsvb) {
		_varbind_set(req, pdu, i, rsvb);
		if (++ndone == nvb)
			self._transmit_response(rsp);
	    });
	});
};

Agent.prototype._process_bulk = function (req, rsp) {
	/* XXX yuck */
};

Agent.prototype._process_req = function (req) {
	var rsp;

	assert.ok(req.version >= 0 && req.version <= 1);

	/* XXX check community here */

	rsp = message.createSnmpMessage({ version: req.version,
	    community: req.community });
	rsp.dst = req.src;

	rsp.pdu = PDU.createSnmpPDU({ op: PDU.Response,
	    request_id: req.pdu.request_id });
	rsp.pdu.error_status = 0;
	rsp.pdu.error_index = 0;

	switch (req.pdu.op) {
	case PDU.GetRequest:
	case PDU.GetNextRequest:
	case PDU.SetRequest:
		this._process_singleton(req, rsp);
		break;
	case PDU.GetBulkRequest:
		this._process_bulk(req, rsp);
		break;
	case PDU.Response:
	case PDU.Trap:
	case PDU.InformRequest:
	case PDU.SNMPv2_Trap:
	case PDU.Report:
	default:
		this.log.debug({
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
		req = message.parseSnmpMessage(raw, src);
	} catch (err) {
		/* XXX in some cases we can reply with an error */
		this.malformed_messages++;
		this.log.debug({
			err: err,
			raw: raw,
			origin: src }, 'Invalid SNMP message');
		return;
	}

	this.log.trace({ raw: raw, origin: src, snmpmsg: req },
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

function
createSnmpAgent(options)
{
	if (!options)
		options = {};
	if (!options.dtrace)
		options.dtrace = dtrace;

	return (new Agent(options));
}

module.exports = {
	createSnmpAgent: createSnmpAgent
};
