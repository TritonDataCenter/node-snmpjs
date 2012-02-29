/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var SNMP = require('../../index.js');

var mib_2_system = {
	subtree: '.1.3.6.1.2.1.1',
	callback: function (arg) {
		if (typeof (arg) !== 'object')
			throw new TypeError('arg must be an object');
		if (!arg.op || !arg.src || !arg.req)
			throw new TypeError('arg is missing required members');

		switch (arg.op) {
		case SNMP.pdu.GetRequest:
		case SNMP.pdu.GetNextRequest:
			break;
		case SNMP.pdu.GetBulkRequest:
		default:
			arg.callback (null, SNMP.pdu.readOnly);
			return;
		}

		var rsp = SNMP.varbind.createSnmpVarbind({
			oid: req.oid,
			data: {
				type: 'Unsigned32',
				value: 0xa0000000
			}
		});

		return (rsp);
	}
};

module.exports = mib_2_system;
