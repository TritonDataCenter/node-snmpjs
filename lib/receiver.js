/*
 * Copyright (c) 2015 Jan Van Buggenhout.  All rights reserved.
 * Copyright (c) 2013 Joyent, Inc.  All rights reserved.
 */

var dgram = require('dgram');
var util = require('util');
var events = require('events');
var PDU = require('./protocol/pdu');
var message = require('./protocol/message');

function
Receiver(options)
{
	if (typeof (options) !== 'object')
		throw new TypeError('options (object) is required');
	if (typeof (options.log) !== 'object')
		throw new TypeError('options.log (object) is required');

	this._log = options.log;
	this._name = options.name || 'snmpjs';

	this._malformed_messages = 0;
}
util.inherits(Receiver, events.EventEmitter);

Receiver.prototype._process_msg = function _process_msg(msg) {
	this._log.debug({
		raw: msg.raw,
		origin: msg.src,
		snmpmsg: msg
	    }, 'Ignoring PDU of inappropriate type ' +
		PDU.strop(msg.pdu.op));
};

Receiver.prototype._augment_msg = function _augment_msg(msg, conn) {
};

Receiver.prototype._recv = function _recv(raw, src, conn) {
	var msg;

	try {
		msg = message.parseMessage({ raw: raw, src: src });
	} catch (err) {
		this._malformed_messages++;
		this._log.debug({
			err: err,
			raw: raw,
			origin: src }, 'Invalid SNMP message');
		return;
	}

	this._augment_msg(msg, conn);
	this._log.trace({ raw: raw, origin: src, snmpmsg: msg },
	    'Received SNMP message');
	this._process_msg(msg);
};

Receiver.prototype.createSocket = function createSocket(family) {
	var self = this;
	var conn;

	if (typeof (family) !== 'string')
		throw new TypeError('family (string) is required');

	conn = dgram.createSocket(family);
	conn.on('message', function _recv_binder(msg, rinfo) {
		var raw = {
			buf: msg,
			len: rinfo.size
		};
		var src = {
			family: family,
			address: rinfo.address,
			port: rinfo.port
		};
		self._recv(raw, src, conn);
	});

	return (conn);
};

module.exports = Receiver;
