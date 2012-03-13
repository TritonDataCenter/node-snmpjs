#! /usr/bin/env node
/*
 * Copyright (c) 2012, Joyent, Inc. All rights reserved.
 */

var snmp = require('./lib/index.js');
var mib = require('./lib/mib/index.js');
var bunyan = require('bunyan');
var fs = require('fs');

var config = process.argv[2] || 'agent.json';
var cfstr = fs.readFileSync(config);
var cf, log_cf;
var log, agent;

cf = JSON.parse(cfstr);
log_cf = cf.log || {
	name: 'snmpd',
	level: 'trace'
};

log = new bunyan(log_cf);

agent = snmp.createAgent({
	log: log
});

/* XXX MIB configuration */

agent.request(mib);

agent.bind({ family: 'udp4', port: 161 });
