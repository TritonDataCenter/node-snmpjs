/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var ASN1 = require('asn1').Ber;
var data = require('./data');

function
SnmpVarbind(arg)
{
	var self = this;

	if (!arg)
		arg = {};
	if (typeof (arg) !== 'object')
		throw new TypeError('arg must be an object');

	this._oid = undefined;
	this._data = undefined;

	this.__defineGetter__('oid', function () {
		if (self._oid)
			return (self._oid.value);
		return (undefined);
	});
	this.__defineSetter__('oid', function (v) {
		if (typeof (v) === 'string')
			v = data.createData({ value: v,
			    type: 'ObjectIdentifier' });

		if (typeof (v) !== 'object' || !data.isSnmpData(v) ||
		    v.typename != 'ObjectIdentifier') {
			throw new TypeError('oid must be a string or ' +
			    'SNMP data object of type ObjectIdentifier');
		}

		self._oid = v;
	});
	this.__defineGetter__('data', function () {
		return (self._data);
	});
	this.__defineSetter__('data', function (v) {
		if (typeof (v) === 'object' && data.isSnmpData(v))
			self._data = v;
		else if (typeof (v) === 'object' && (v instanceof ASN1.Reader))
			self._data = data.createData({ value: v });
		else if (typeof (v) === 'object')
			self._data = data.createData(v);
	});

	if (typeof (arg.oid) !== 'undefined')
		this.oid = arg.oid;
	if (typeof (arg.data) !== 'undefined')
		this.data = arg.data;
}

SnmpVarbind.prototype.__snmpjs_magic = 'SnmpVarbind';

SnmpVarbind.prototype.clone = function clone() {
	var oclone, dclone;

	if (this._oid)
		oclone = this._oid.clone();
	if (this._data)
		dclone = this._data.clone();

	return (new this.constructor({ oid: oclone, data: dclone }));
};

SnmpVarbind.prototype.encode = function encode(writer) {
	if (typeof (this._oid) === 'undefined')
		throw new ReferenceError('Cannot encode undefined oid');
	if (typeof (this._data) == 'undefined')
		throw new ReferenceError('Cannot encode undefined data');

	writer.startSequence();
	this._oid.encode(writer);
	this._data.encode(writer);
	writer.endSequence();
};

function
createVarbind(arg)
{
	return (new SnmpVarbind(arg));
}

module.exports = {
	SnmpVarbind: SnmpVarbind,
	createVarbind: createVarbind,
	isSnmpVarbind: function (v) {
		return ((typeof (v.__snmpjs_magic) === 'string' &&
		    v.__snmpjs_magic === 'SnmpVarbind') ? true : false);
	}
};
