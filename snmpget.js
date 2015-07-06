#! /usr/bin/env node
/*
 * Copyright (c) 2015 Jan Van Buggenhout.  All rights reserved.
 */

var snmp = require('./lib/index.js');
var bunyan = require('bunyan');
var util = require('util');

var client = snmp.createClient({
	log: new bunyan({ name: 'snmpget', level: 'info' })
});

function print_get_response(snmpmsg)
{
	snmpmsg.pdu.varbinds.forEach(function (varbind) {
		console.log(varbind.oid + ' = ' + varbind.data.value);
	});
}

var ip = process.argv[2];
var community = process.argv[3];
var oid = process.argv[4];

client.get(ip, community, 0, oid, function (snmpmsg) {
	print_get_response(snmpmsg);
	client.close();
});
