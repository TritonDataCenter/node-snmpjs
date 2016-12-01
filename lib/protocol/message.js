/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var util = require('util');
var ASN1 = require('asn1').Ber;
var lexer = require('../lexer');
var PDU = require('./pdu');
var varbind = require('./varbind');
var data = require('./data');
var parser = require('../parser').parser;
var EmptyMessageError = require('../errors/message').EmptyMessageError;
var MessageParseError = require('../errors/message').MessageParseError;
var NoSupportError = require('../errors/message').NoSupportError;

function
_set_bind(msg, key, primitive, type) {
	return (function (v) {
		if (typeof (v) === primitive) {
			v = data.createData({ value: v,
			    type: type });
		}
		if (typeof (v) !== 'object' || !data.isSnmpData(v) ||
		    v.typename != type) {
			throw new TypeError(key + ' must be a ' + primitive +
			    ' or SNMP data object of type ' + type);
		}

		msg[key] = v;
	});
}

function
SnmpMessage(arg)
{
	var self = this;
	var version, community;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg must be an object');

	if (typeof (arg.version) === 'undefined')
		throw new TypeError('arg.version is required');
	if (typeof (arg.version) === 'object' && data.isSnmpData(arg.version))
		version = arg.version;
	else
		version = data.createData({ value: arg.version,
		    type: 'Integer' });
	if (typeof (version) !== 'object' || !data.isSnmpData(version) ||
	    version.typename != 'Integer') {
		throw new TypeError('arg.version must be an integer or ' +
		    ' an SNMP data object of type Integer');
	}

	if (typeof (arg.community) === 'undefined')
		throw new TypeError('arg.community is required');
	if (typeof (arg.community) === 'object' &&
	    data.isSnmpData(arg.community))
		community = arg.community;
	else
		community = data.createData({ value: arg.community,
		    type: 'OctetString' });
	if (typeof (community) !== 'object' || !data.isSnmpData(community) ||
	    community.typename != 'OctetString') {
		throw new TypeError('arg.community must be a string or ' +
		    ' an SNMP data object of type OctetString');
	}
	switch (version.value) {
	case 0:
	case 1:
		break;
	case 3:
	default:
		throw new NoSupportError('SNMPv3 is unsupported');
	}

	this._version = version;
	this._community = community;
	this._raw = this._src = undefined;

	this.__defineGetter__('version', function () {
		return (self._version.value);
	});
	this.__defineGetter__('community', function () {
		return (self._community.value);
	});
	this.__defineGetter__('raw', function () {
		return (self._raw);
	});
	this.__defineGetter__('src', function () {
		return (self._src);
	});
	this.__defineGetter__('pdu', function () {
		return (self._pdu);
	});
	this.__defineSetter__('pdu', function (v) {
		if (typeof (v) !== 'object' || !PDU.isSnmpPDU(v))
			throw new TypeError('pdu must be an object');

		self._pdu = v;
	});

	if (arg.pdu)
		this.pdu = arg.pdu;
}

SnmpMessage.prototype.__snmpjs_magic = 'SnmpMessage';

SnmpMessage.prototype._setOrigin = function _setOrigin(raw, src)
{
	this._raw = raw;
	this._src = src;
};

SnmpMessage.prototype.encode = function encode()
{
	var writer = new ASN1.Writer();

	if (!this._community)
		throw new TypeError('Message is missing a community');
	if (!this._pdu)
		throw new TypeError('Message contains no PDU');
	if (this._raw)
		throw new TypeError('Message has already been encoded');

	writer.startSequence();
	this._version.encode(writer);
	this._community.encode(writer);
	this._pdu.encode(writer);
	writer.endSequence();

	this._raw = {
		buf: writer.buffer,
		len: writer.buffer.length
	};
};

function
ParseContext()
{
	var self = {
		ASN1: ASN1,
		pdu: PDU,
		varbind: varbind,
		data: data,
		message: module.exports,
		content: undefined,
	};

	self.setContent = function (content) {
		self.content = content;
	};

	self.parseError = function (str, hash) {
		throw new MessageParseError(str, hash);
	};

	self.parse = function (raw, src) {
		parser.yy = this;

		parser.parse(raw.buf);
		if (!self.content)
			throw new EmptyMessageError();

		self.content._setOrigin(raw, src);
		return self.content;
	};

	return self;
}

function
parseMessage(arg)
{
	var ctx;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');
	if (typeof (arg.raw) !== 'object')
		throw new TypeError('arg.raw (object) is required');
	if (Buffer.isBuffer(arg.raw)) {
		arg.raw = {
			buf: arg.raw,
			len: arg.raw.length
		};
	}
	if (typeof (arg.raw.buf) !== 'object' || !Buffer.isBuffer(arg.raw.buf))
		throw new TypeError('arg.raw does not contain a Buffer');

	ctx = new ParseContext();
	return (ctx.parse(arg.raw, arg.src));
}

function
createMessage(arg)
{
	return (new SnmpMessage(arg));
}

function
strversion(ver)
{
	if (typeof (ver) !== 'number')
		throw new TypeError('ver (number) is required');
	switch (ver) {
	case 0:
		return ('v1(0)');
	case 1:
		return ('v2c(1)');
	case 3:
		return ('v3(3)');
	default:
		return ('<unknown>(' + ver + ')');
	}
}

function
bunyan_serialize_snmpmsg(snmpmsg)
{
	var i;
	var obj = {
		version: strversion(snmpmsg.version),
		community: snmpmsg.community.toString()
	};

	if (snmpmsg.pdu.op === PDU.Trap) {
		obj.pdu = {
			op: PDU.strop(snmpmsg.pdu.op),
			enterprise: snmpmsg.pdu.enterprise,
			agent_addr: snmpmsg.pdu.agent_addr,
			generic_trap: snmpmsg.pdu.generic_trap,
			specific_trap: snmpmsg.pdu.specific_trap,
			time_stamp: snmpmsg.pdu.time_stamp,
			varbinds: []
		};
	} else {
		obj.pdu = {
			op: PDU.strop(snmpmsg.pdu.op),
			request_id: snmpmsg.pdu.request_id,
			error_status: PDU.strerror(snmpmsg.pdu.error_status),
			error_index: snmpmsg.pdu.error_index,
			varbinds: []
		};
	}
	for (i = 0; i < snmpmsg.pdu.varbinds.length; i++) {
		var dv = snmpmsg.pdu.varbinds[i].data.value;
		var vb = {
			oid: snmpmsg.pdu.varbinds[i].oid,
			typename: snmpmsg.pdu.varbinds[i].data.typename,
			value: dv,
			string_value: (dv != null ? dv.toString() : null)
		};
		obj.pdu.varbinds.push(vb);
	}

	return (obj);
}

module.exports = function _message_init() {
	var message = {
		parseMessage: parseMessage,
		createMessage: createMessage,
		strversion: strversion,
		serializer: bunyan_serialize_snmpmsg
	};

	message.isSnmpMessage = function (m) {
		return ((typeof (m.__snmpjs_magic) === 'string' &&
		    m.__snmpjs_magic === 'SnmpMessage') ? true : false);
	};

	parser.lexer = new lexer();

	return (message);
}();
