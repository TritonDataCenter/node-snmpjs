/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var util = require('util');
var ASN1 = require('asn1').Ber;
var Lexer = require('../lexer');
var PDU = require('./pdu');
var varbind = require('./varbind');
var data = require('./data');
var Parser = require('../parser').parser;
var EmptyMessageError = require('../errors/message').EmptyMessageError;
var MessageParseError = require('../errors/message').MessageParseError;
var NoSupportError = require('../errors/message').NoSupportError;

/*
 * The relevant fields in a Message are:
 *
 * {
 *	raw: {
 *		buf: <Buffer>,
 *		len: 44
 *	},
 *	src: {
 *		family: 'udp4',
 *		address: '10.2.0.2',
 *		port: 56768
 *	},
 *	content: {
 *		version: 1,
 *		community: 'public',
 *		pdus: [ {
 *				_op: 'SET',
 *				_reqid: 139212763,
 *				_error: 0,
 *				_err_index: 0,
 *				_varbinds: [ {
 *					_tag: ASN1.Opaque,
 *					_oid: '1.3.6.2.0' (a string OID),
 *					_typename: 'Opaque',
 *					_value: <Buffer> or primitive,
 *			},
 *			...
 *		]
 *	}
 * }
 */
function
_set_bind(msg, key, primitive, type) {
	return (function (v) {
		if (typeof (v) === primitive) {
			v = data.createSnmpData({ value: v,
			    type: type });
		}
		if (typeof (v) !== 'object' ||
		    !(v instanceof data.SnmpData) ||
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
	var version, community, pdus;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg must be an object');

	if (typeof (arg.version) === 'undefined')
		throw new TypeError('arg.version is required');
	if (typeof (arg.version) === 'object' &&
	    arg.version instanceof data.SnmpData)
		version = arg.version;
	else
		version = data.createSnmpData({ value: arg.version,
		    type: 'Integer' });
	if (typeof (version) !== 'object' ||
	    !(version instanceof data.SnmpData) ||
	    version.typename != 'Integer') {
		throw new TypeError('arg.version must be an integer or ' +
		    ' an SNMP data object of type Integer');
	}

	if (typeof (arg.community) === 'undefined')
		throw new TypeError('arg.community is required');
	if (typeof (arg.community) === 'object' &&
	    arg.community instanceof data.SnmpData)
		community = arg.community;
	else
		community = data.createSnmpData({ value: arg.community,
		    type: 'OctetString' });
	if (typeof (community) !== 'object' ||
	    !(community instanceof data.SnmpData) ||
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

	if (arg.pdus)
		pdus = arg.pdus;
	else
		pdus = [];

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
	this.__defineGetter__('pdus', function () {
		return (self._pdus);
	});
	this.__defineSetter__('pdus', function (v) {
		var i;

		if (typeof (v) !== 'object')
			throw new TypeError('pdus must be an object');

		if (v instanceof PDU.SnmpPDU) {
			self._pdus = [ v ];
			return;
		}
		if (!util.isArray(v)) {
			throw new TypeError('attempt to set pdus from ' +
			    'incompatible type');
		}
		for (i = 0; i < v.length; i++) {
			if (!(v[i] instanceof PDU.SnmpPDU)) {
				throw new TypeError('pdus[' + i + '] is ' +
				    'of incompatible type');
			}
		}

		self._pdus = v;
	});

	this.pdus = pdus;
}

SnmpMessage.prototype.setOrigin = function setOrigin(raw, src)
{
	if (typeof (raw) != 'object')
		throw new TypeError('raw (object) is required');
	if (typeof (src) != 'object')
		throw new TypeError('src (object) is required');
	if (!raw.buf || !raw.len)
		throw new TypeError('raw argument is missing members');
	if (!src.address || !src.port)
		throw new TypeError('src argument is missing members');

	this._raw = raw;
	this._src = src;
};

SnmpMessage.prototype.encode = function encode()
{
	var writer = new ASN1.Writer();
	var i;

	if (!this._community)
		throw new TypeError('Message is missing a community');
	if (!this._pdus || this._pdus.length === 0)
		throw new TypeError('Message contains no PDUs');
	if (this._raw)
		throw new TypeError('Message has already been encoded');

	writer.startSequence();
	this._version.encode(writer);
	this._community.encode(writer);
	for (i = 0; i < this._pdus.length; i++)
		this._pdus[i].encode(writer);
	writer.endSequence();

	this._raw = {
		buf: writer.buffer,
		len: writer.buffer.length
	};
};

function
ParseContext()
{
	this.ASN1 = ASN1;
	this.pdu = PDU;
	this.varbind = varbind;
	this.data = data;
	this.message = module.exports;
	this.content = undefined;
}

ParseContext.prototype.parse = function parse(raw, src)
{
	/*
	 * This is vile.  Unfortunately, the parser generated by Jison isn't an
	 * object instance, nor is it anything that can construct one.  This
	 * doesn't really matter because we don't do anything asynchronous
	 * during parsing, but it's still wrong.
	 */
	Parser.yy = this;

	Parser.parse(raw.buf);
	if (!this.content)
		throw new EmptyMessageError();

	this.content.setOrigin(raw, src);
	return (this.content);
};

ParseContext.prototype.parseError = function parseError(str, hash)
{
	throw new MessageParseError(str, hash);
};

ParseContext.prototype.setContent = function setContent(content)
{
	this.content = content;
};

function
parseSnmpMessage(raw, src)
{
	var ctx = new ParseContext();
	return (ctx.parse(raw, src));
}

function
createSnmpMessage(version, community, pdus)
{
	return (new SnmpMessage(version, community, pdus));
}

function
strversion(ver)
{
	if (typeof (ver) != 'number')
		throw new TypeError('ver (number) is required');
	switch (ver) {
	case 0:
		return ('v1(0)');
	case 1:
		return ('v2/v2c(1)');
	case 3:
		return ('v3(3)');
	default:
		return ('<unknown>(' + ver + ')');
	}
}

function
bunyan_serialize_snmpmsg(snmpmsg)
{
	var i, j;
	var obj = {
		version: strversion(snmpmsg.version),
		community: snmpmsg.community.toString()
	};

	obj.pdus = [];
	for (i = 0; i < snmpmsg.pdus.length; i++) {
		var pdu = {
			op: PDU.strop(snmpmsg.pdus[i].op),
			request_id: snmpmsg.pdus[i].request_id,
			error_status:
			    PDU.strerror(snmpmsg.pdus[i].error_status),
			error_index: snmpmsg.pdus[i].error_index,
			varbinds: []
		};
		for (j = 0; j < snmpmsg.pdus[i].varbinds.length; j++) {
			var dv = snmpmsg.pdus[i].varbinds[j].data.value;
			var type = snmpmsg.pdus[i].varbinds[j].data.typename;
			var datastr = type + ': ' + dv;
			var vb = {
				oid: snmpmsg.pdus[i].varbinds[j].oid,
				typename: snmpmsg.pdus[i].varbinds[j].typename,
				value: datastr
			};
			pdu.varbinds.push(vb);
		}
		obj.pdus.push(pdu);
	}

	return (obj);
}

function
init()
{
	Parser.lexer = new Lexer();

	return (parseSnmpMessage);
}

module.exports = {
	parseSnmpMessage: init(),
	createSnmpMessage: createSnmpMessage,
	strversion: strversion,
	serializer: bunyan_serialize_snmpmsg
};
