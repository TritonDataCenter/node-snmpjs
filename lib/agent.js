/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var dgram = require('dgram');
var util = require('util');
var Listener = require('./listener');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');
var MIB = require('./mib');
var ProviderRequest = require('./provider').ProviderRequest;

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
AgentMIBDecor(prov, column)
{
	this._scalar = (prov.columns) ? false : true;
	this._column = (column === true) ? true : false;

	if (util.isArray(prov.handler))
		this._handler = prov.handler;
	else
		this._handler = [ prov.handler ];
}

AgentMIBDecor.prototype.instancePossible = function () {
	return (this._scalar || this._column);
};

Agent.prototype._add_provider = function _add_provider(prov) {
	var self = this;
	var decor;
	var node;

	if (typeof (prov) !== 'object')
		throw new TypeError('prov (object) is required');
	if (typeof (prov.oid) !== 'string')
		throw new TypeError('prov.oid (string) is required');
	if (typeof (prov.handler) !== 'function' &&
	    (typeof (prov.handler) !== 'object' || !util.isArray(prov.handler)))
		throw new TypeError('prov.handler (function) is required');
	if (typeof (prov.columns) !== 'undefined' &&
	    (typeof (prov.columns) !== 'object' || !util.isArray(prov.columns)))
		throw new TypeError('prov.columns must be an array');

	node = this._mib.add(prov);
	decor = new AgentMIBDecor(prov);
	node.decorate({ tag: '_agent', obj: decor });

	if (prov.columns) {
		prov.columns.forEach(function (c) {
			node = self._mib.add(prov.oid + '.' + c);
			decor = new AgentMIBDecor(prov, true);
			node.decorate({ tag: '_agent', obj: decor });
		});
	}
};

Agent.prototype.addProviders = function addProviders(prov) {
	var self = this;

	if (typeof (prov) !== 'object')
		throw new TypeError('prov (object) is required');

	if (util.isArray(prov)) {
		prov.forEach(function (p) {
			self._add_provider(p);
		});
	} else {
		this._add_provider(prov);
	}
};

function
Agent(options)
{
	var self = this;

	Listener.call(this, options);

	if (typeof (options.dtrace) !== 'object')
		throw new TypeError('options.dtrace (object) is required');

	this._dtrace = options.dtrace;

	Object.keys(AGENT_PROBES).forEach(function (p) {
		var args = AGENT_PROBES[p].splice(0);
		args.unshift(p);

		self._dtrace.addProbe.apply(self._dtrace, args);
	});

	this._dtrace.enable();

	this._mib = new MIB();
}
util.inherits(Agent, Listener);

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
Agent.prototype._varbind_set_single =
    function _varbind_set_single(req, rsp, idx, vb) {
	if (typeof (vb) === 'undefined' && req.pdu.op == PDU.GetNextRequest) {
		rsp.pdu.varbinds[idx] = req.pdu.varbinds[idx].clone();
		rsp.pdu.varbinds[idx].data = data.createData({ type: 'Null',
		    value: data.noSuchInstance });
	} else if (typeof (vb) === 'number') {
		if (req.pdu.op != PDU.SetRequest && vb != PDU.genErr) {
			this.log.warn({ snmpmsg: req },
			    'provider attempted to set prohibited ' +
			    'error code ' + vb + ' for varbind ' + idx);
			vb = PDU.genErr;
		}
		rsp.pdu.varbinds[idx] = req.pdu.varbinds[idx].clone();
		if (!rsp.pdu.error_status || idx + 1 < rsp.pdu.error_index) {
			rsp.pdu.error_status = vb;
			rsp.pdu.error_index = idx + 1;
		}
	} else if (typeof (vb) !== 'object' || !varbind.isSnmpVarbind(vb)) {
		throw new TypeError('Response data is of incompatible type');
	} else {
		rsp.pdu.varbinds[idx] = vb;
	}
};

Agent.prototype._transmit_response = function _transmit_response(sock, rsp) {
	var dst = rsp.dst;
	var local_sock = false;

	rsp.encode();
	this._log.trace({ raw: rsp.raw, dst: dst, snmpmsg: rsp },
			    'Sending SNMP response message');

	if (!sock) {
		sock = dgram.createSocket(dst.family);
		local_sock = false;
	}
	sock.send(rsp.raw.buf, 0, rsp.raw.len, dst.port, dst.address,
	    function (err, len) {
		if (local_sock)
			sock.close();
	    });
};

Agent.prototype._do_getset = function _do_getset(req, rsp) {
	var self = this;
	var nvb = req.pdu.varbinds.length;
	var ndone = 0;

	req.pdu.varbinds.forEach(function (vb, i) {
		var node = self._mib.lookup(vb.oid);
		var prq = new ProviderRequest(req.pdu.op, vb.oid, node);
		var decor = node.decor('_agent');
		var handler;

		if (!node || !decor || !decor.instancePossible()) {
			handler = [ function _getset_nsohandler(pr) {
				var rsd = data.createData({ type: 'Null',
				    value: data.noSuchObject });
				var rsvb = varbind.createVarbind({
				    oid: pr.oid, data: rsd });
				pr.done(rsvb);
			} ];
		} else {
			if (!prq.instance || decor._scalar &&
			    (prq.instance.length > 1 || prq.instance[0] != 0)) {
				handler = [ function _getset_nsihandler(pr) {
					var rsd = data.createData({
					    type: 'Null',
					    value: data.noSuchInstance
					});
					var rsvb = varbind.createVarbind({
					    oid: pr.oid, data: rsd });
					pr.done(rsvb);
				} ];
			} else {
				if (prq.op == PDU.SetRequest)
					prq._value = vb.data;
				handler = decor._handler;
			}
		}

		prq._done = function _getset_done(rsvb) {
			self._varbind_set_single(req, rsp, i, rsvb);
			if (++ndone == nvb)
				self._transmit_response(req._conn_recv, rsp);
		};
		handler.forEach(function (h) {
			h(prq);
		});
	});
};

Agent.prototype._getnext_lookup = function _getnext_lookup(oid, exactok) {
	var node;
	var addr = data.canonicalizeOID(oid);
	var match;
	var decor;

	oid = addr.join('.');
	node = this._mib.lookup(oid);

	if (!node)
		return (null);

	decor = node.decor('_agent');
	match = function (n) {
		var d = n.decor('_agent');

		return (d && d.instancePossible() || false);
	};

	/*
	 * Please note that this code is optimised for readability because the
	 * logic for choosing where to look for the next instance is somewhat
	 * complex.  It should be very apparent from this that we are in fact
	 * covering all possible cases, and doing the right thing for each.
	 */

	/*
	 * Exact match, the node is a column.  Use the node if an exact match is
	 * ok; the provider will figure out the first row, or else we'll end up
	 * right back here with exactok clear.
	 */
	if (node.oid === oid && decor && decor._column && exactok)
		return (node);

	/*
	 * Exact match, the node is a column but we need the next subtree.
	 * Walk the parent starting from the next sibling.
	 */
	if (node.oid === oid && decor && decor._column) {
		return (this._mib.next_match({
			node: node.parent,
			match: match,
			start: node.addr[node.addr.length - 1] + 1
		}));
	}

	/*
	 * Exact match, the node is a scalar.  Use it; we want the instance,
	 * becuase it follows this OID in the lexicographical order.
	 */
	if (node.oid === oid && decor && decor._scalar)
		return (node);

	/*
	 * Exact match, the node is just an OID.  Walk the node from the
	 * beginning to find any instances within this subtree.  If there aren't
	 * any, the walk will proceed back up and on to the next sibling.
	 */
	if (node.oid === oid && (!decor || !decor.instancePossible())) {
		return (this._mib.next_match({
			node: node,
			match: match
		}));
	}

	/*
	 * Ancestor, and the node is just an OID.  Walk the node from the first
	 * child after the first non-matching component.
	 *
	 * Ex: GetNext(.1.3.3.6.2) finds (.1.3); walk (.1.3), 4
	 */
	if (!decor || !decor.instancePossible()) {
		return (this._mib.next_match({
			node: node,
			match: match,
			start: addr[node.addr.length] + 1
		}));
	}

	/*
	 * Ancestor, and the node is a scalar.  Walk the parent starting from
	 * the next sibling, because there can be only one intance below this
	 * node.  So no matter what the instance portion of the OID is, the next
	 * instance in the MIB can't be in this subtree.
	 */
	if (decor._scalar) {
		return (this._mib.next_match({
			node: node.parent,
			match: match,
			start: node.addr[node.addr.length - 1] + 1
		}));
	}

	/*
	 * Ancestor, and the node is a column.  Use the node if an exact match
	 * is ok, otherwise keep going.  Note that this is the same as the very
	 * first case above; we don't actually care whether we're being asked
	 * for the first row in the column or the next one after some identified
	 * instance, because that's the provider's job to figure out.
	 */
	if (exactok)
		return (node);

	/*
	 * Ancestor, and the node is a column.  An exact match is not ok, so
	 * walk the parent starting from the next sibling.  Again, this is the
	 * same as the case in which we hit the exact match -- we know we've
	 * already asked this provider and we need to advance to another one.
	 */
	return (this._mib.next_match({
		node: node.parent,
		match: match,
		start: node.addr[node.addr.length - 1] + 1
	}));
};

Agent.prototype._do_getnext_one =
    function (req, rsp, i, oid, cookie, first) {
	var self = this;
	var node = this._getnext_lookup(oid, first);
	var nvb = req.pdu.varbinds.length;
	var prq = new ProviderRequest(req.pdu.op, oid, node);
	var handler;

	if (!node || !node.decor('_agent').instancePossible()) {
		handler = [ function _getset_nsohandler(pr) {
			var rsd = data.createData({ type: 'Null',
			    value: data.endOfMibView });
			var rsvb = varbind.createVarbind({
			    oid: pr.oid, data: rsd });
			pr.done(rsvb);
		} ];
	} else {
		handler = node.decor('_agent')._handler;
	}

	prq._done = function _getnext_done(rsvb) {
		if (rsvb !== undefined) {
			self._varbind_set_single(req, rsp, i, rsvb);
			if (++cookie.ndone == nvb)
				self._transmit_response(req._conn_recv, rsp);
			return;
		}
		self._do_getnext_one(req, rsp, i, prq.node.oid, cookie, false);
	};

	handler.forEach(function (h) {
		h(prq);
	});
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
		Listener.prototype._process_msg.call(this, req);
		break;
	}
};

Agent.prototype._process_msg = function _process_msg(msg) {
	this._process_req(msg);
};

Agent.prototype._augment_msg = function _augment_msg(msg, conn) {
	msg._conn_recv = conn;
};

Agent.prototype.request = function request(oid, handler, columns) {
	var prov;

	if (typeof (oid) === 'string') {
		if (typeof (handler) !== 'function')
			throw new TypeError('handler must be a function');

		this.addProviders({
			oid: oid,
			handler: handler,
			columns: columns
		});

		return;
	}

	prov = oid;
	if (typeof (prov) === 'object') {
		this.addProviders(prov);
		return;
	}

	throw new TypeError('MIB provider must be specified');
};

module.exports = Agent;
