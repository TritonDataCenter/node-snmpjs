#! /usr/bin/env node
/*
 * Copyright (c) 2015 Jan Van Buggenhout.  All rights reserved.
 */

var snmp = require('./lib/index.js');
var bunyan = require('bunyan');
var util = require('util');
var path = require('path');

var callback;
if ('snmpinform' == path.basename(process.argv[1]).split('.')[0])
	callback = function (snmpmsg) {
		console.log(util.inspect(snmp.message.serializer(snmpmsg),
				false, null, true));
		process.exitCode = snmpmsg.pdu.error_status;
		client.unref();
	};

var client = snmp.createClient({
	log: new bunyan({
		name: typeof (callback) === 'function' ? 'snmpinform'
							: 'snmptrap',
		level: 'info'
	})
});

var ip = process.argv[2];
var community = process.argv[3];
// coldStart
var oid = '1.3.6.1.6.3.1.1.5.1'; // process.argv[4];
// var value = process.argv[5];

client.inform(ip, community, 0, oid, [
		snmp.varbind.createVarbind({
			// sysDescr.0
			oid: '1.3.6.1.2.1.1.1.0',
			data: snmp.data.createData({
				type: 'OctetString',
				value: 'TEST'
			})
		})
], callback);
