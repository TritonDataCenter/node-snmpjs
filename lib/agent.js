/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var dgram = require('dgram');
var util = require('util');
var Logger = require('bunyan');
var dtrace = require('./dtrace');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');

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
Agent(options) {
	var self = this;
	var serializers = {
		err: Logger.stdSerializers.err,
		raw: bunyan_serialize_raw,
		origin: bunyan_serialize_endpoint,
		dst: bunyan_serialize_endpoint,
		snmpmsg: message.serializer
	};

	if (options) {
		if (typeof (options) !== 'object')
			throw new TypeError('options must be an object');
		if (typeof (options.mib) !== 'object')
			throw new TypeError('options.mib must be an object');
		if (options.log && typeof (options.log) !== 'object')
			throw new TypeError('options.log must be an object');
	} else {
		options = {};
	}

	if (!options.log) {
		this.log = new Logger({
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

	this.mib = options.mib;
	this._malformed_messages = 0;
}

Agent.prototype._process_varbind = function () {
	var req_pdu = msg.pdus[idx];
	var oid = req_pdu.varbinds[i].oid;
	var subtree = this.mib.lookup(oid);
	var ndone = 0;
	var res;

	if (!subtree) {
		res = req_pdu.varbinds[i].clone();
		res.data = createSnmpData(
		    { value: data.noSuchInstance, type: 'Null' });
	}

	subtree.owner.callback({ op: req.op, src: src,
	    req: req.varbinds[i], next:
	    function (rsp, err) {
	});
};

function
_varbind_bind(agent, req_pdu, rsp_pdu, i, count)
{
	return (function _varbind_done(vb, err) {
		if (!vb) {
			rsp_pdu.varbinds[i] = req_pdu.varbinds[i];
			if (rsp_pdu.error_status == PDU.noError &&
			    ) {
				rsp_pdu.error_status = err;
					rsp_pdu.error_index = i + 1;
				rsp_pdu.varbinds[i].error_s
		for (j = 0; j < subtree.restrict.length; j++) {
			if (!subtree.restrict[j]({ op: req.op,
			    oid: res.oid, src: src)) {
				rsp.varbinds[i] = req.varbinds[i];
				if (rsp.error_status == PDU.noError) {
					rsp.error_status = PDU.genErr;
					rsp.error_index = i + 1;
				}
			} else {
				rsp.varbinds[i] = res;
			}
		    	
		    }
		rsp.pdus[i] = pdu;
		if (rsp.pdus.length == count) {
			rsp.encode();
			agent.log.trace({ raw: rsp.raw, dst: dst,
				snmpmsg: rsp },
			    'Sending SNMP response message');
			sock = dgram.createSocket(dst.family);
			sock.send(rsp.raw.buf, 0, rsp.raw.len,
			    dst.port, dst.address);
		}
	});
}


Agent.prototype._process_pdu = function _process_pdu(msg, req_pdu, next) {
};

function
_pdu_bind(agent, rsp, i, count, dst)
{
	return (function _pdu_done(pdu) {
		var sock;

		rsp.pdus[i] = pdu;
		if (rsp.pdus.length == count) {
			rsp.encode();
			agent.log.trace({ raw: rsp.raw, dst: dst,
				snmpmsg: rsp },
			    'Sending SNMP response message');
			sock = dgram.createSocket(dst.family);
			sock.send(rsp.raw.buf, 0, rsp.raw.len,
			    dst.port, dst.address);
		}
	});
}

/*
 * Our strategy here is to split apart the PDU(s) received such that all
 * requested varbinds end up going to a given owner as an array of specifiers,
 * each containing the varbind, the operation, and (in the case of GetBulk)
 * operation-specific parameters.  When the MIB subtree owner has populated all
 * of those varbinds, it will call us back and we will reconstitute the data
 * into the proper order.  Once we've received all the data we're going to, 
 */
Agent.prototype._process_msg = function (msg) {
	var self = this;
	var rsp = message.createSnmpMessage({ version: msg.version,
	    community: msg.community });

	for (i = 0; i < msg.pdus.length; i++) {
		var req_pdu = msg.pdus[i];
		var rsp_pdu;
		var j;

		switch (req_pdu.op) {
		case PDU.GetRequest:
		case PDU.GetNextRequest:
		case PDU.SetRequest:
		case PDU.GetBulkRequest:
			break;
		case PDU.Response:
		case PDU.Trap:
		case PDU.InformRequest:
		case PDU.SNMPv2_Trap:
		case PDU.Report:
		default:
			log.debug({
				raw: msg.raw,
				origin: msg.src,
				snmpmsg: msg
			    }, 'Ignoring PDU ' + i +
			    ' of inappropriate type ' + pdu.strop(req_pdu.op));
			continue;
		}
	}

	rsp_pdu = PDU.createSnmpPDU({ op: PDU.Response,
	    request_id: req_pdu.request_id });

	rsp_pdu.error_status = 0;
	rsp_pdu.error_index = 0;

	for (i = 0; i < req_pdu.varbinds.length; i++) {
		this._process_varbind(msg, idx, i,
		    _varbind_bind(self, msg, idx, i, req_pdu.varbinds.));

	}
	next(rsp);
		this._process_pdu(msg.pdus[i], src,
		    _pdu_bind(self, rsp, i, msg.pdus.length, msg.src));
	}
};

Agent.prototype._recv = function _recv(raw, src) {
	var msg;
	var i;
	var self = this;

	try {
		msg = message.parseSnmpMessage(raw, src);
	} catch (err) {
		/* XXX in some cases we can reply with an error */
		this.malformed_messages++;
		this.log.debug({
			err: err,
			raw: raw,
			origin: src }, 'Invalid SNMP message');
		return;
	}

	this.log.trace({ raw: raw, origin: src, snmpmsg: msg },
	    'Received SNMP message');
	this._process_msg(msg);
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

Agent.prototype.close = function close() {
	if (!this.connection)
		return;
	this.connection.close();
};

module.exports = Agent;
