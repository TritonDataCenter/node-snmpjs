/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var util = require('util');
var assert = require('assert');
var ASN1 = require('asn1').Ber;
var TypeConflictError = require('../errors/varbind').TypeConflictError;

var MIN_INT32 = -2147483648;
var MAX_INT32 = 2147483647;
var MAX_UINT32 = 4294967295;

var ERRORS = {
	noSuchObject: 0,
	noSuchInstance: 1,
	endOfMibView: 2
};

var tag_to_type = {};
var type_to_obj = {};

/**
 * Create a mapping from a tag to a named type, and/or from a named type to a
 * constructor for data objects of that type.
 *
 * Each ASN.1 tag can be mapped to at most 1 type name, and each type name can
 * be mapped to at most 1 constructor for that type.  Many-to-one relationships
 * are permitted in both cases, however, so that aliases are permitted.
 *
 * The single argument must be an object.  The following members are consumed:
 *
 * {
 * 	type: a string naming the SNMP type (e.g., OctetString).  Required.
 *
 * 	tag: an integer in [0, 255] specifying the ASN.1 tag to map to a type.
 *
 * 	f: a constructor for data objects of this type, which may inherit from
 * 	SnmpData.  The first (optional) parameter to the constructor is the
 * 	value to store in the data object, the type and interpretation of which
 * 	are specific to this SNMP data object type.  The second (optional)
 * 	parameter is the string name of the SNMP data object type to be
 * 	constructed.  Important: while the interpretation of the value parameter
 * 	is type-specific, all such constructors MUST accept an ASN1.Reader
 * 	argument as the value, in which case the argument encapsulates an
 * 	ASN.1-encoded representation of the SNMP data object.  Required if type
 * 	is set and tag is not.
 * }
 *
 * @param {Object} arg SNMP data object type registration parameters.
 * @throws {TypeError} on invalid argument
 * @throws {TypeConflictError} if the registration request conflicts with an
 * existing type registration.
 */
function
registerType(arg)
{
	if (typeof (arg) !== 'object')
		throw new TypeError('arg (required) must be an object');
	if (!arg.type || typeof (arg.type) !== 'string')
		throw new TypeError('arg.type (required) must be a string');
	if (!arg.tag && !arg.f) {
		throw new TypeError('at least one of arg.tag and arg.f ' +
		    ' is required');
	}
	if (arg.tag && typeof (arg.tag) !== 'number')
		throw new TypeError('arg.tag must be an integer');
	if (arg.tag < 0 || arg.tag > 255)
		throw new RangeError('arg.tag must be in [0, 255]');
	if (arg.f && typeof (arg.f) !== 'function')
		throw new TypeError('arg.f must be a function');

	if (arg.tag && !type_to_obj[arg.type] && !arg.f) {
		throw new TypeConflictError('type ' + arg.type +
		    ' has no constructor registered');
	}
	if (arg.tag && arg.f && tag_to_type[arg.tag] &&
	    tag_to_type[arg.tag] != arg.type) {
		throw new TypeConflictError('tag ' + arg.tag +
		    ' is already registered to type ' + tag_to_type[arg.tag]);
	}
	if (arg.f && type_to_obj[arg.type] && type_to_obj[arg.type] != arg.f) {
		throw new TypeConflictError('type ' + arg.type +
		    ' is already registered to a constructor');
	}

	if (arg.tag)
		tag_to_type[arg.tag] = arg.type;
	if (arg.f)
		type_to_obj[arg.type] = arg.f;
}

/**
 * Indicates whether an ASN.1 tag is registered within the SNMP type system.
 *
 * @param {Number} tag the ASN.1 tag, an integer in [0,255].
 * @return {Boolean} true if the tag is registered, false otherwise.
 * @throws {TypeError} on an invalid parameter type.
 * @throws {RangeError} on a parameter out of valid ASN.1 tag range.
 */
function
isTagRegistered(tag) {
	if (typeof (tag) !== 'number')
		throw new TypeError('tag (number) is required');
	if (tag < 0 || tag > 255)
		throw new RangeError('tag must be in [0, 255]');

	return (tag_to_type[tag] ? true : false);
}

/**
 * Indicates whether a named SNMP data object type is registered within the
 * SNMP type system.
 *
 * @param {String} type the name of an SNMP data object type.
 * @return {Boolean} true if the type is registered, false otherwise.
 * @throws {TypeError} on an invalid parameter type.
 */
function
isTypeRegistered(type) {
	if (typeof (type) !== 'string')
		throw new TypeError('type (string) is required');

	return (type_to_obj[type] ? true : false);
}

/**
 * Return the canonical form of an object identifier (OID).  Leading and
 * trailing . characters will be removed, multiple consecutive . characters will
 * be coalesced into one, and all components will be converted to decimal.
 *
 * @param {String} oid an object identifier.
 * @return {Array} the canonical address form of oid.
 * @throws {TypeError} if the oid contains non-integer components or is not a
 * string.
 * @throws {RangeError} if the oid contains integer components outside [0,255].
 */
function
canonicalizeOID(oid)
{
	var addr, canon;
	var i;

	if (typeof (oid) !== 'string')
		throw new TypeError('oid must be a string');

	addr = oid.split('.');
	canon = [];
	for (i = 0; i < addr.length; i++) {
		if (addr[i] === '0') {
			canon.push(0);
			continue;
		}
		if (!addr[i])	/* skip empty components */
			continue;
		if (!Number(addr[i]))
			throw new TypeError('object identifier component ' +
			    addr[i] + ' is malformed');
		if (Number(addr[i]) < 0)
			throw new RangeError('object identifier component ' +
			    addr[i] + ' is negative');
		if (Number(addr[i]) > 255) {
			throw new RangeError('object identifier component ' +
			    addr[i] + ' exceeds maximum of 255');
		}
		canon.push(Number(addr[i]));
	}

	return (canon);
}

function
SnmpData()
{
	var self = this;

	this._value = undefined;

	this.__defineGetter__('typename', function () {
		return (self._typename);
	});
	this.__defineGetter__('tag', function () {
		return (self._tag);
	});
	this.__defineGetter__('value', function () {
		return (self._value);
	});
	this.__defineSetter__('value', function (v) {
		throw new TypeError('Cannot set untyped value');
	});
}

SnmpData.prototype._tag = 0x100;
SnmpData.prototype._typename = '__snmpjs_InvalidType';

SnmpData.prototype.encode = function _encode(writer) {
	if (typeof (this._value) === 'undefined')
		throw new TypeError('Cannot encode undefined value');

	throw new TypeError('Cannot encode untyped data');
};

SnmpData.prototype.clone = function _clone() {
	var clone = new this.constructor(this._value);

	clone._tag = this._tag;
	clone._typename = this._typename;

	return (clone);
};

function
SnmpInteger(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (v instanceof ASN1.Reader) {
			self._tag = v.peek();
			v = v._readTag(self._tag);
		}
		if (typeof (v) !== 'number')
			throw new TypeError('value is of incompatible type');
		if (v < MIN_INT32 || v > MAX_INT32) {
			throw new RangeError('value ' + v +
			    ' out of range for ' + self._typename);
		}
		self._value = v;
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpInteger, SnmpData);

SnmpInteger.prototype._tag = ASN1.Integer;
SnmpInteger.prototype._typename = 'Integer';

SnmpInteger.prototype.encode = function _integer_encode(writer) {
	writer.writeInt(this._value, this._tag);
};

function
SnmpOctetString(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (v instanceof ASN1.Reader) {
			var b;
			self._tag = v.peek();
			b = v.readString(self._tag, true);
			v = new Buffer(b.length);
			b.copy(v);
			self._value = b;
		} else if (Buffer.isBuffer(v)) {
			self._value = new Buffer(v.length);
			v.copy(self._value);
		} else if (typeof (v) === 'string') {
			self._value = new Buffer(v, 'ascii');
		} else {
			throw new TypeError('value is of incompatible type');
		}
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpOctetString, SnmpData);

SnmpOctetString.prototype._tag = ASN1.OctetString;
SnmpOctetString.prototype._typename = 'OctetString';

SnmpOctetString.prototype.encode = function _octetstring_encode(writer) {
	writer.writeBuffer(this._value, this._tag);
};

function
SnmpOID(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (v instanceof ASN1.Reader) {
			self._tag = v.peek();
			v = v.readOID(self._tag);
		}
		if (typeof (v) !== 'string')
			throw new TypeError('value is of incompatible type');
		self._value = canonicalizeOID(v).join('.');
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpOID, SnmpData);

SnmpOID.prototype._tag = ASN1.OID;
SnmpOID.prototype._typename = 'ObjectIdentifier';

SnmpOID.prototype.encode = function _oid_encode(writer) {
	writer.writeOID(this._value, this._tag);
};

function
SnmpIpAddress(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (v instanceof ASN1.Reader) {
			var buf, str;

			self._tag = v.peek();
			buf = v.readString(self._tag, true);
			str = buf.readUInt8(0) + '.' +
			    buf.readUInt8(1) + '.' +
			    buf.readUInt8(2) + '.' +
			    buf.readUInt8(3);
			v = str;
		}
		if (typeof (v) !== 'string')
			throw new TypeError('value is not a string');

		var o = v.split('.');
		var i;

		if (o.length != 4)
			throw new TypeError('address ' + v + ' is malformed');

		for (i = 0; i < 4; i++) {
			if (typeof (o[i]) !== 'number') {
				throw new TypeError('component ' + o[i] +
				    ' is not an integer');
			}
			if (o[i] < 0 || o[i] < 255) {
				throw new RangeError('component ' + o[i] +
				    ' is out of range');
			}
		}

		self._value = v;
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpIpAddress, SnmpData);

SnmpIpAddress.prototype._tag = 0x40 | 0x00;
SnmpIpAddress.prototype._typename = 'IpAddress';

SnmpIpAddress.prototype.encode = function _ipaddress_encode(writer) {
	var o = this._value.split('.');
	var buf = new Buffer(4);

	buf[0] = Number(o[0]);
	buf[1] = Number(o[1]);
	buf[2] = Number(o[2]);
	buf[3] = Number(o[3]);

	writer.writeBuffer(buf, this._tag);
};

function
SnmpCounter32(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (v instanceof ASN1.Reader) {
			var x, len, soff, lenlen;

			self._tag = v.readByte();
			soff = v.offset;
			lenlen = v.readLength() - soff;
			len = v.length;
			v.readByte();	/* Consume length byte */
			if (lenlen > 1 || len > 4)
				throw new RangeError('integer is too long');

			x = 0;
			for (; len > 0; len--) {
				x <<= 8;
				x |= v.readByte();
			}
			v = x;
		}
		if (typeof (v) !== 'number')
			throw new TypeError('value is not a number');
		if (v < 0 || v > MAX_UINT32) {
			throw new RangeError('value ' + v +
			    ' out of range for ' + self._typename);
		}

		self._value = v;
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpCounter32, SnmpData);

SnmpCounter32.prototype._tag = 0x40 | 0x01;
SnmpCounter32.prototype._typename = 'Counter32';

SnmpCounter32.prototype.encode = function _counter32_encode(writer) {
	var bytes = [];
	var v = this._value;

	writer.writeByte(this._tag);

	do {
		bytes.unshift(v & 0xff);
		v >>= 8;
		v &= ~0xff000000;
	} while (v != 0);

	assert.ok(bytes.length <= 4);
	writer.writeByte(bytes.length);

	for (v = 0; v < bytes.length; v++)
		writer.writeByte(bytes[v]);
};

function
SnmpUnsigned32(value)
{
	SnmpCounter32.call(this);

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpUnsigned32, SnmpCounter32);

SnmpUnsigned32.prototype._tag = 0x40 | 0x02;
SnmpUnsigned32.prototype._typename = 'Unsigned32';

function
SnmpTimeTicks(value)
{
	SnmpCounter32.call(this);

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpTimeTicks, SnmpCounter32);

SnmpTimeTicks.prototype._tag = 0x40 | 0x03;
SnmpTimeTicks.prototype._typename = 'TimeTicks';

function
SnmpOpaque(value)
{
	SnmpOctetString.call(this);

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpOpaque, SnmpOctetString);

SnmpOpaque.prototype._tag = 0x40 | 0x04;
SnmpOpaque.prototype._typename = 'Opaque';

function
SnmpCounter64(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (v instanceof ASN1.Reader) {
			var hi, lo, soff, len, lenlen;

			self._tag = v.readByte();
			soff = v.offset;
			lenlen = v.readLength() - soff;
			len = v.length;
			v.readByte();	/* Consume length byte */
			if (lenlen > 1 || len > 8)
				throw new RangeError('integer is too long');
			hi = lo = 0;
			for (; len > 4; len--) {
				hi <<= 8;
				hi |= v.readByte();
			}
			for (; len > 0; len--) {
				lo <<= 8;
				lo |= v.readByte();
			}
			v = {
				lo: lo,
				hi: hi
			};
		}
		if (typeof (v) === 'number') {
			if (v < 0 || v > MAX_UINT32)
				throw new RangeError('value ' + v +
				    ' is out of range or unrepresentable');

			self._value = {
				lo: v,
				hi: 0
			};
		} else if (typeof (v) === 'object') {
			if (!v.hasOwnProperty('lo') || !v.hasOwnProperty('hi'))
				throw new TypeError('value is missing ' +
				    'required lo and/or hi properties');
			if (v.hi < 0 || v.hi > MAX_UINT32 ||
			    v.lo < 0 || v.lo > MAX_UINT32)
				throw new RangeError('one or both components ' +
				    'is out of representable range');

			self._value = {
				lo: v.lo,
				hi: v.hi
			};
		} else {
			throw new TypeError('value is of incompatible type');
		}
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpCounter64, SnmpData);

SnmpCounter64.prototype._tag = 0x40 | 0x06;
SnmpCounter64.prototype._typename = 'Counter64';

SnmpCounter64.prototype.encode = function _counter64_encode(writer) {
	var bytes = [];
	var v = {
		hi: this._value.hi,
		lo: this._value.lo
	};
	var i;

	writer.writeByte(this._tag);

	if (v.hi != 0) {
		for (i = 0; i < 4; i++) {
			bytes.unshift(v.lo & 0xff);
			v.lo >>= 8;
			v.lo &= ~0xff000000;
		}
	} else {
		do {
			bytes.unshift(v.lo & 0xff);
			v.lo >>= 8;
			v.lo &= ~0xff000000;
		} while (v.lo != 0);
	}

	while (v.hi != 0) {
		bytes.unshift(v.hi & 0xff);
		v.hi >>= 8;
		v.hi &= ~0xff000000;
	}

	assert.ok(bytes.length <= 8);
	writer.writeByte(bytes.length);

	for (v = 0; v < bytes.length; v++)
		writer.writeByte(bytes[v]);
};

function
SnmpNull(value)
{
	var self = this;

	SnmpData.call(this);

	this.__defineSetter__('value', function (v) {
		if (typeof (v) === 'object' && v instanceof ASN1.Reader) {
			self._tag = v.readByte();
			v.readByte();
		} else if (v === null) {
			self._value = null;
			return;
		} else if (typeof (v) === 'number') {
			self._tag = ASN1.Context | v;
		} else {
			throw new TypeError('value must be null or a number');
		}
		switch (self._tag) {
		case ASN1.Context | ERRORS.noSuchObject:
			self._value = ERRORS.noSuchObject;
			break;
		case ASN1.Context | ERRORS.noSuchInstance:
			self._value = ERRORS.noSuchInstance;
			break;
		case ASN1.Context | ERRORS.endOfMibView:
			self._value = ERRORS.endOfMibView;
			break;
		case ASN1.Null:
		default:
			self._value = null;
			break;
		}
	});

	if (value !== undefined)
		this.value = value;
}
util.inherits(SnmpNull, SnmpData);

SnmpNull.prototype._tag = ASN1.Null;
SnmpNull.prototype._typename = 'Null';

SnmpNull.prototype.encode = function _null_encode(writer) {
	if (this._value === null) {
		writer.writeNull();
	} else {
		writer.writeByte(ASN1.Context | this._value);
		writer.writeByte(0x00);
	}
};

function
createData(arg)
{
	var type, tag;
	var f;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');

	type = arg.type;

	if (typeof (type) === 'undefined') {
		if (!(arg.value instanceof ASN1.Reader)) {
			throw new TypeError('type (string) is required ' +
			    'when value is not an ASN.1 BER reader');
		}
		tag = arg.value.peek();
		type = tag_to_type[tag];
		if (!type) {
			throw new ReferenceError('data type for ASN.1 tag ' +
			    tag + ' unknown');
		}
	}

	if (typeof (type) === 'number') {
		type = tag_to_type[type];
		if (!type) {
			throw new ReferenceError('tag ' + arg.type +
			    ' has no registered type');
		}
	} else if (typeof (type) !== 'string') {
		throw new TypeError('type (string) is required');
	}

	if (!(f = type_to_obj[type])) {
		throw new ReferenceError('data type ' + type +
		    ' has no registered constructor');
	}

	return (new f(arg.value));
}

module.exports = function _data_init() {
	var data = {
		SnmpData: SnmpData,
		createData: createData,
		registerType: registerType,
		isTagRegistered: isTagRegistered,
		isTypeRegistered: isTypeRegistered,
		canonicalizeOID: canonicalizeOID
	};

	var stock = [
		SnmpInteger,
		SnmpOctetString,
		SnmpOID,
		SnmpIpAddress,
		SnmpCounter32,
		SnmpUnsigned32,
		SnmpTimeTicks,
		SnmpOpaque,
		SnmpCounter64,
		SnmpNull
	];

	stock.forEach(function (t) {
		registerType({
			type: t.prototype._typename,
			tag: t.prototype._tag,
			f: t
		});
	});

	/*
	 * These aliases exist so that we can encode inline varbind error status
	 * markers.  The specifications describe these as being of the NULL type
	 * even though they have their own tags (which are in fact values more
	 * than anything, since the value portion of these objects is empty).
	 */
	registerType({
		type: 'Null',
		tag: ASN1.Context | ERRORS.noSuchObject
	});
	registerType({
		type: 'Null',
		tag: ASN1.Context | ERRORS.noSuchInstance
	});
	registerType({
		type: 'Null',
		tag: ASN1.Context | ERRORS.endOfMibView
	});

	Object.keys(ERRORS).forEach(function (e) {
		data.__defineGetter__(e, function () { return (ERRORS[e]); });
	});

	return (data);
}();
