/*
 * Copyright (c) 2013 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var dgram = require('dgram');
var util = require('util');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');
var MIB = require('./mib');
var events = require('events');

function
TrapListener(options)
{
	var self = this;

	if (typeof (options) !== 'object')
		throw new TypeError('options (object) is required');
	if (typeof (options.log) !== 'object')
		throw new TypeError('options.log (object) is required');

	this._log = options.log;
	this._name = options.name || 'snmpjs';
	this._connections = [];

	this._malformed_messages = 0;
}
util.inherits(TrapListener, events.EventEmitter);

TrapListener.prototype._process_msg = function _process_msg(msg) {
	switch (msg.pdu.op) {
	case PDU.Trap:
	case PDU.InformRequest:
	case PDU.SNMPv2_Trap:
		this.emit('trap', msg);
		break;
	case PDU.GetRequest:
	case PDU.SetRequest:
	case PDU.GetNextRequest:
	case PDU.GetBulkRequest:
	case PDU.Response:
	case PDU.Report:
	default:
		this._log.debug({
			raw: msg.raw,
			origin: msg.src,
			snmpmsg: msg
		    }, 'Ignoring PDU of inappropriate type ' +
			PDU.strop(msg.pdu.op));
		break;
	}
};

TrapListener.prototype._recv = function _recv(raw, src) {
	var msg;

	try {
		msg = message.parseMessage({ raw: raw, src: src });
	} catch (err) {
		this.malformed_messages++;
		this._log.debug({
			err: err,
			raw: raw,
			origin: src }, 'Invalid SNMP message');
		return;
	}

	this._log.trace({ raw: raw, origin: src, snmpmsg: msg },
	    'Received SNMP message');
	this._process_msg(msg);
};

TrapListener.prototype.bind = function bind(arg, cb) {
	var self = this;
	var conn;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');
	if (typeof (arg.family) !== 'string')
		throw new TypeError('arg.family (string) is required');
	if (typeof (arg.port) !== 'number')
		throw new TypeError('arg.port (number) is required');
	if (typeof (arg.addr) !== 'undefined' &&
	    typeof (arg.addr) !== 'string')
		throw new TypeError('arg.addr must be a string');

	if (cb !== undefined && typeof (cb) !== 'function')
		throw new TypeError('cb must be a function');

	conn = dgram.createSocket(arg.family);
	conn.on('message', function _recv_binder(msg, rinfo) {
		var raw = {
			buf: msg,
			len: rinfo.size
		};
		var src = {
			family: arg.family,
			address: rinfo.address,
			port: rinfo.port
		};
		self._recv(raw, src);
	});
	this._connections.push(conn);

	conn.on('listening', function () {
		self._log.info('Bound to ' + conn.address().address + ':' +
		    conn.address().port);
		if (cb)
			cb();
	});

	conn.bind(arg.port, arg.addr);
};

TrapListener.prototype.close = function close() {
	this._connections.forEach(function (c) {
		this._log.info('Shutting down endpoint ' + c.address().address +
		    ':' + c.address().port);
		c.close();
	});
};

module.exports = TrapListener;
