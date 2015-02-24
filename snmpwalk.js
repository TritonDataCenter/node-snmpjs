#! /usr/bin/env node
/*
 * Copyright (c) 2015 Jan Van Buggenhout.  All rights reserved.
 */

var snmp = require('./lib/index.js');
var bunyan = require('bunyan');
var util = require('util');

var client = snmp.createClient({
	log: new bunyan({ name: 'snmpwalk', level: 'info' })
});

function print_get_response(snmpmsg)
{
	snmpmsg.pdu.varbinds.forEach(function (varbind) {
		console.log(varbind.oid + ' = ' + varbind.data.value);
	});
}

/* jsl:ignore */
function snmpwalk(ip, community, version, oid, cb, donecb)
{
/* jsl:end */
	function walk(snmpmsg) {
		if (snmpmsg.pdu.error_status == snmp.pdu.noSuchName) {
			if (donecb)
				donecb();
			return;
		}
		cb(snmpmsg);
		client.getNext(ip, community, version,
			snmpmsg.pdu.varbinds[0].oid, walk);
	}

	client.getNext(ip, community, version, oid, walk);
}

var ip = process.argv[2];
var community = process.argv[3];
var oid = process.argv[4];

snmpwalk(ip, community, 0, oid, print_get_response, function () {
	client.unref();
});
