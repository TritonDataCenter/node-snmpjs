/*
 * Copyright 2012 Joyent, Inc.  All rights reserved.
 */

var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');

function
readOnlyScalar(arg, rsd)
{
	var vb;
	var oid;

	oid = arg.obj.oid + '.0';

	if (arg.op == PDU.SetRequest) {
		vb = PDU.notWritable;
		arg.next(vb);
		return;
	}
	if (arg.op != PDU.GetRequest)
		throw new TypeError('Invalid request type ' + arg.op);

	/*
	 * Error case.  There are only two valid possibilities here.  The
	 * first is noSuchInstance, in which case we encode that into a
	 * varbind and send it along for processing.  If this value is anything
	 * else, we pass along PDU.genErr and don't encode a varbind (the agent
	 * will handle it for us).
	 *
	 * Consumers of this interface should never generate noSuchObject or
	 * endOfMibView here; the agent will generate those if needed.
	 */
	if (typeof (rsd) === 'number' || typeof (rsd) === 'undefined') {
		if (rsd === data.noSuchInstance) {
			rsd = data.createSnmpData({ type: 'Null', value: rsd });
			vb = varbind.createSnmpVarbind({ oid: oid, data: rsd });
		} else {
			vb = PDU.genErr;
		}
	} else if (typeof (rsd) === 'object' && rsd instanceof data.SnmpData) {
		vb = varbind.createSnmpVarbind({ oid: oid, data: rsd });
	} else {
		throw new TypeError('Response is of incompatible type');
	}

	arg.next(vb);
}

module.exports = {
	readOnlyScalar: readOnlyScalar
};
