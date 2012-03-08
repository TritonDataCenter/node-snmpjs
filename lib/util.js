/*
 * Copyright 2012 Joyent, Inc.  All rights reserved.
 */

var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');

function
_createVarbind(oid, rsd)
{
	var vb;

	if (typeof (rsd) === 'number')
		vb = rsd;
	else if (typeof (rsd) === 'undefined')
		vb = undefined;
	else if (typeof (rsd) === 'object' && rsd instanceof data.SnmpData)
		vb = varbind.createVarbind({ oid: oid, data: rsd });
	else
		throw new TypeError('Response is of incompatible type');

	return (vb);
}

function
readOnlyScalar(loc, rsd)
{
	var oid = loc.objoid + '.0';

	if (loc.op == PDU.SetRequest) {
		loc.done(_createVarbind(PDU.notWritable));
		return;
	}

	loc.done(_createVarbind(oid, rsd));
}

function
writableScalar(loc, rsd)
{
	var oid = loc.objoid + '.0';

	loc.done(_createVarbind(oid, rsd));
}

module.exports = {
	readOnlyScalar: readOnlyScalar,
	writableScalar: writableScalar
};
