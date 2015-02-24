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

var ip = '127.0.0.1'; // process.argv[2];
var community = 'public'; // process.argv[3];
var non_repeaters = [ '1.3.6.1.2.1.1' ];
var repeaters = [ '1.3.6.1.2.1.1.9.1.2', '1.3.6.1.2.1.1.9.1.3' ];

client.getBulk(ip, community, non_repeaters, repeaters, 5, function (snmpmsg) {
	print_get_response(snmpmsg);
	client.unref();
});
