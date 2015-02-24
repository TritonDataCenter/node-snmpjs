#! /usr/bin/env node
/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 */

var snmp = require('./lib/index.js');
var mib = require('./lib/mib/index.js');
var bunyan = require('bunyan');
var fs = require('fs');
var util = require('util');

var config = process.argv[2] || 'tl.json';
var cfstr = fs.readFileSync(config);
var cf, log_cf;
var log, tl;

cf = JSON.parse(cfstr);
log_cf = cf.log || {
	name: 'snmpd',
	level: 'trace'
};

log = new bunyan(log_cf);

tl = snmp.createTrapListener({
	log: log
});

tl.on('trap', function (msg) {
	console.log(util.inspect(snmp.message.serializer(msg), false, null));
});
tl.bind({ family: 'udp4', port: 162 });
