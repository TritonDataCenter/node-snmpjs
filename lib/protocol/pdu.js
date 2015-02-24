/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var util = require('util');
var ASN1 = require('asn1').Ber;
var varbind = require('./varbind');
var data = require('./data');

var OPS = {
	GetRequest: 0,
	GetNextRequest: 1,
	Response: 2,
	SetRequest: 3,
	Trap: 4,	/* OBSOLETE! */
	GetBulkRequest: 5,
	InformRequest: 6,
	SNMPv2_Trap: 7,
	Report: 8
};

var ERRORS = {
	noError: 0,
	tooBig: 1,
	noSuchName: 2,
	badValue: 3,
	readOnly: 4,
	genErr: 5,
	noAccess: 6,
	wrongType: 7,
	wrongLength: 8,
	wrongEncoding: 9,
	wrongValue: 10,
	noCreation: 11,
	inconsistentValue: 12,
	resourceUnavailable: 13,
	commitFailed: 14,
	undoFailed: 15,
	authorizationError: 16,
	notWritable: 17,
	inconsistentName: 18
};

var TRAPS_V1 = {
	coldStart: 0,
	warmStart: 1,
	linkDown: 2,
	linkUp: 3,
	authenticationFailure: 4,
	egpNeighborLoss: 5,
	enterpriseSpecific: 6
};

function
SnmpPDU(arg)
{
	var self = this;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');

	if (typeof (arg.op) !== 'number')
		throw new TypeError('arg.op (number) is required');
	if (arg.op < 0 || arg.op > 31) /* ASN.1 limitation */
		throw new RangeError('op ' + arg.op + ' is out of range');

	this._op = arg.op;
	this._varbinds = [];

	this.__defineGetter__('op', function () {
		return (self._op);
	});
	this.__defineGetter__('varbinds', function () {
		return (self._varbinds);
	});
	this.__defineSetter__('varbinds', function (v) {
		var i = 0;

		if (typeof (v) === 'object' && varbind.isSnmpVarbind(v)) {
			self._varbinds = [ v ];
			return;
		}

		if (typeof (v) !== 'object' || !util.isArray(v))
			throw new TypeError('varbinds must be an array');

		for (i = 0; i < v.length; i++) {
			if (typeof (v[i]) !== 'object' ||
			    !varbind.isSnmpVarbind(v[i])) {
				throw new TypeError('varbinds[' + i + '] is ' +
				    'of incompatible type');
			}
		}
		self._varbinds = v;
	});

	if (arg.varbinds)
		this.varbinds = arg.varbinds;
}

SnmpPDU.prototype.__snmpjs_magic = 'SnmpPDU';

SnmpPDU.prototype.clone = function () {
	throw new TypeError('Cannot clone base PDU object');
};

SnmpPDU.prototype.cloneAs = function (op) {
	throw new TypeError('Cannot clone base PDU object');
};

SnmpPDU.prototype.encode = function (writer) {
	throw new TypeError('Cannot encode base PDU object');
};

function
_set_bind(pdu, key, primitive, type) {
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

		pdu[key] = v;
	});
}

function
SnmpStdPDU(arg)
{
	var self = this;
	var request_id;
	var f;
	var errst_if_name;
	var erridx_if_name;

	SnmpPDU.call(this, arg);

	if (this._op === SnmpPDU.Trap)
		throw new TypeError('cannot create standard PDU as v1 trap');

	if (typeof (arg.request_id) === 'undefined')
		throw new TypeError('arg.request_id is required');
	if (typeof (arg.request_id) === 'number') {
		request_id = data.createData({ value: arg.request_id,
		    type: 'Integer' });
	} else {
		request_id = arg.request_id;
	}
	if (typeof (request_id) !== 'object' || !data.isSnmpData(request_id) ||
	    request_id.typename != 'Integer') {
		throw new TypeError('arg.request_id must be integer or ' +
		    ' and SNMP data object of type Integer');
	}

	this._request_id = request_id;
	this._error_status = data.createData({ value: 0, type: 'Integer' });
	this._error_index = data.createData({ value: 0, type: 'Integer' });

	this.__defineGetter__('request_id', function () {
		return (self._request_id.value);
	});

	/*
	 * We cheat a little here, taking advantage of the standard's very
	 * deliberate use of the same structure for all PDU types.  The
	 * interpretation of these two values are different for GetBulk
	 * requests, but they are otherwise the same so we will avoid creating
	 * yet another PDU type and just present the appropriate names as
	 * getters and setters.
	 */
	if (this.op == OPS.GetBulkRequest) {
		errst_if_name = 'non_repeaters';
		erridx_if_name = 'max_repetitions';
	} else {
		errst_if_name = 'error_status';
		erridx_if_name = 'error_index';
	}

	this.__defineGetter__(errst_if_name, function () {
		return (self._error_status.value);
	});
	this.__defineSetter__(errst_if_name,
	    _set_bind(self, '_error_status', 'number', 'Integer'));
	this.__defineGetter__(erridx_if_name, function () {
		return (self._error_index.value);
	});
	f = _set_bind(self, '_error_index', 'number', 'Integer');
	if (this.op == OPS.GetBulkRequest) {
		this.__defineSetter__(erridx_if_name, f);
	} else {
		this.__defineSetter__(erridx_if_name, function (v) {
			if (v < 0 || v > self._varbinds.length) {
				throw new RangeError('error index ' + v +
				    ' is out of range');
			}
			f(v);
		});
	}
}
util.inherits(SnmpStdPDU, SnmpPDU);

SnmpStdPDU.prototype.cloneAs = function (op) {
	var clone = new this.constructor({ op: op,
	    request_id: this._request_id });
	var i;

	clone._error_status = this._error_status;
	clone._error_index = this._error_index;
	for (i = 0; i < this._varbinds.length; i++)
		clone.varbinds.push(this._varbinds[i].clone());

	return (clone);
};

SnmpStdPDU.prototype.clone = function () {
	return (this.cloneAs(this._op));
};

SnmpStdPDU.prototype.encode = function (writer) {
	var i;

	if (this._op == OPS.GetBulkRequest &&
	    this._varbinds.length < this.non_repeaters) {
		throw new RangeError('number of non-repeater varbinds is ' +
		    'greater than the total varbind count');
	}

	writer.startSequence(ASN1.Context | ASN1.Constructor | this._op);
	this._request_id.encode(writer);
	this._error_status.encode(writer);
	this._error_index.encode(writer);

	writer.startSequence();
	for (i = 0; i < this._varbinds.length; i++)
		this._varbinds[i].encode(writer);
	writer.endSequence();
	writer.endSequence();
};

function
SnmpTrapV1PDU(arg)
{
	var self = this;

	SnmpPDU.call(this, arg);

	this.__defineGetter__('enterprise', function () {
		if (self._enterprise)
			return (self._enterprise.value);
		return (undefined);
	});
	this.__defineSetter__('enterprise',
	    _set_bind(self, '_enterprise', 'string', 'ObjectIdentifier'));
	this.__defineGetter__('agent_addr', function () {
		if (self._agent_addr)
			return (self._agent_addr.value);
		return (undefined);
	});
	this.__defineSetter__('agent_addr',
	    _set_bind(self, '_agent_addr', 'string', 'IpAddress'));
	this.__defineGetter__('generic_trap', function () {
		if (self._generic_trap)
			return (self._generic_trap.value);
		return (undefined);
	});
	this.__defineSetter__('generic_trap',
	    _set_bind(self, '_generic_trap', 'number', 'Integer'));
	this.__defineGetter__('specific_trap', function () {
		if (self._specific_trap)
			return (self._specific_trap.value);
		return (undefined);
	});
	this.__defineSetter__('specific_trap',
	    _set_bind(self, '_specific_trap', 'number', 'Integer'));
	this.__defineGetter__('time_stamp', function () {
		if (self._time_stamp)
			return (self._time_stamp.value);
		return (undefined);
	});
	this.__defineSetter__('time_stamp',
	    _set_bind(self, '_time_stamp', 'number', 'TimeTicks'));

	if (arg.enterprise)
		this.enterprise = arg.enterprise;
	if (arg.agent_addr)
		this.agent_addr = arg.agent_addr;
	if (arg.generic_trap)
		this.generic_trap = arg.generic_trap;
	if (arg.specific_trap)
		this.specific_trap = arg.specific_trap;
	if (arg.time_stamp)
		this.time_stamp = arg.time_stamp;
}
util.inherits(SnmpTrapV1PDU, SnmpPDU);

SnmpTrapV1PDU.prototype.encode = function (writer) {
	var i;

	writer.startSequence(ASN1.Context | ASN1.Constructor | this._op);
	this._enterprise.encode(writer);
	this._agent_addr.encode(writer);
	this._generic_trap.encode(writer);
	this._specific_trap.encode(writer);
	this._time_stamp.encode(writer);

	writer.startSequence();
	for (i = 0; i < this._varbinds.length; i++)
		this._varbinds[i].encode(writer);
	writer.endSequence();
	writer.endSequence();
};

function
createPDU(arg)
{
	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');
	if (typeof (arg.op) !== 'number')
		throw new TypeError('arg.op (number) is reguired');

	switch (arg.op) {
	case OPS.Trap:
		return (new SnmpTrapV1PDU(arg));
	default:
		return (new SnmpStdPDU(arg));
	}
}

function
strop(op)
{
	var i;
	if (typeof (op) != 'number')
		throw new TypeError('op (number) is required');
	for (i in OPS) {
		if (OPS.hasOwnProperty(i) && OPS[i] == op)
			return (i + '(' + op + ')');
	}
	return ('<unknown>(' + op + ')');
}

function
strerror(err)
{
	var i;
	if (typeof (err) != 'number')
		throw new TypeError('err (number) is required');
	for (i in ERRORS) {
		if (ERRORS.hasOwnProperty(i) && ERRORS[i] == err)
			return (i + '(' + err + ')');
	}
	return ('<unknown>(' + err + ')');
}

function
strtrap(trap)
{
	var i;
	if (typeof (trap) !== 'number')
		throw new TypeError('trap (number) is required');
	for (i in TRAPS_V1) {
		if (TRAPS_V1.hasOwnProperty(i) && TRAPS_V1[i] == trap)
			return (i + '(' + trap + ')');
	}
	return ('<unknown>(' + trap + ')');
}

module.exports = function _pdu_init() {
	var PDU = {
		SnmpPDU: SnmpPDU,
		createPDU: createPDU,
		strop: strop,
		strerror: strerror,
		strtrap: strtrap
	};

	Object.keys(OPS).forEach(function (o) {
		PDU.__defineGetter__(o, function () { return (OPS[o]); });
	});

	Object.keys(ERRORS).forEach(function (e) {
		PDU.__defineGetter__(e, function () { return (ERRORS[e]); });
	});

	Object.keys(TRAPS_V1).forEach(function (t) {
		PDU.__defineGetter__(t, function () { return (TRAPS_V1[t]); });
	});

	PDU.isSnmpPDU = function (p) {
		return ((typeof (p.__snmpjs_magic) === 'string' &&
		    p.__snmpjs_magic === 'SnmpPDU') ? true : false);
	};

	return (PDU);
}();
