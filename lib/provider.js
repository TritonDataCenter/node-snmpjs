/*
 * Copyright 2012 Joyent, Inc.  All rights reserved.
 */

var util = require('util');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');
var MIB = require('./mib');

function
ProviderRequest(op, addr, node, iterate)
{
	var self = this;

	this._op = op;
	addr = this._addr = data.canonicalizeOID(addr);
	this._oid = this._addr.join('.');
	this._done = function () {
		throw new Error('BUG in snmpjs!  No completion callback set.');
	};
	this._iterate = iterate || 1;

	this.__defineGetter__('op', function () { return (self._op); });
	this.__defineGetter__('addr', function () { return (self._addr); });
	this.__defineGetter__('oid', function () { return (self._oid); });
	this.__defineGetter__('node', function () { return (self._node); });
	this.__defineGetter__('instance',
	    function () { return (self._instance); });
	this.__defineGetter__('iterate',
	    function () { return (self._iterate); });
	this.__defineGetter__('done', function () { return (self._done); });
	this.__defineGetter__('value', function () { return (self._value); });

	this._node = node;

	if (node && node.isAncestor(addr))
		this._instance = addr.slice(node.addr.length, addr.length);
}

function
_createVarbind(oid, rsd)
{
	var vb;

	if (typeof (rsd) === 'number')
		vb = rsd;
	else if (typeof (rsd) === 'undefined')
		vb = undefined;
	else if (typeof (rsd) === 'object' && data.isSnmpData(rsd))
		vb = varbind.createVarbind({ oid: oid, data: rsd });
	else
		throw new TypeError('Response is of incompatible type');

	return (vb);
}

function
readOnlyScalar(prq, rsd)
{
	var oid = prq.node.oid + '.0';

	if (prq.op == PDU.SetRequest) {
		prq.done(_createVarbind(PDU.notWritable));
		return;
	}

	prq.done(_createVarbind(oid, rsd));
}

function
writableScalar(prq, rsd)
{
	var oid = prq.node.oid + '.0';

	prq.done(_createVarbind(oid, rsd));
}

module.exports = {
	ProviderRequest: ProviderRequest,
	readOnlyScalar: readOnlyScalar,
	writableScalar: writableScalar
};
