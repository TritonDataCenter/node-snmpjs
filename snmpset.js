#! /usr/bin/env node
/*
 * Copyright (c) 2015 Jan Van Buggenhout.  All rights reserved.
 */

var snmp = require('./lib/index.js');
var bunyan = require('bunyan');
var util = require('util');

var client = snmp.createClient({
	log: new bunyan({ name: 'snmpset', level: 'info' })
});

var ip = process.argv[2];
var community = process.argv[3];
var oid = process.argv[4];
var value = process.argv[5];

client.set(ip, community, 0, oid, snmp.data.createData({ type: 'Integer',
value: parseInt(value, 10) }), function (snmpmsg) {
	// console.log(snmp.pdu.strerror(snmpmsg.pdu.error_status));
	process.exitCode = snmpmsg.pdu.error_status;
	client.unref();
});
