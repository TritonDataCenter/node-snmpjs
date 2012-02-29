#! /usr/bin/env node
/*
 * Copyright (c) 2012, Joyent, Inc. All rights reserved.
 */

var SNMP = require('./lib/index.js');
var MIB = require('./lib/mib/index.js');
var Logger = require('bunyan');

/*
 * XXX read config here
 */

var log = new Logger({
	name: 'snmpd',
	level: 'trace'
});

/*
 * XXX register MIBs and bind based on config
 */
var mib = MIB.createMIB();
mib.add(MIB.std.mib_2.system);

var agent = SNMP.createAgent({
	log: log,
	mib: mib
});

agent.bind('udp4', 161);
