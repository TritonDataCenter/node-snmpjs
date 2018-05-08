/*
 * Copyright (c) 2013 Joyent, Inc.  All rights reserved.
 */

/*
 * SNMP is defined by a large set of specifications.  See
 * http://www.snmp.com/protocol/snmp_rfcs.shtml as a starting point.
 */

var Agent = require('./agent');
var Client = require('./client');
var TrapListener = require('./trap_listener');
var Logger = require('debug');
var MIB = require('./mib');
var provider = require('./provider');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');
var uint64_t = require('./protocol/uint64_t');

var agent_provider;

function
bunyan_serialize_raw(raw)
{
	var obj = {
		buf: (raw.buf ? raw.buf.inspect() : '<empty>'),
		len: raw.len || 0
	};
	return (obj);
}

function
bunyan_serialize_endpoint(endpoint)
{
	var obj = {
		family: endpoint.family || '<unknown>',
		address: endpoint.address || '<unknown>',
		port: endpoint.port || 0
	};
	return (obj);
}

function
defaultLogger(_log, name)
{
	var logger = {
		error: Logger('snmpjs:' + name + ':error'),
		warn: Logger('snmpjs:' + name + ':warn'),
		info: Logger('snmpjs:' + name + ':info'),
		debug: Logger('snmpjs:' + name + ':debug'),
		trace: Logger('snmpjs:' + name + ':trace'),
	}
	return logger;
}

module.exports = {
	createAgent: function createAgent(options) {
		if (!options)
			options = {};
		if (!options.name)
			options.name = 'snmpjs';

		options.log = defaultLogger(options.log, options.name);

		return (new Agent(options));
	},

	createMIB: function createMIB(def) {
		var mib = new MIB();
		if (def)
			mib.add(def);

		return (mib);
	},

	createClient: function createClient(options) {
		if (!options)
			options = {};
		if (!options.name)
			options.name = 'snmpjs';

		options.log = defaultLogger(options.log, options.name);

		return (new Client(options));
	},

	createTrapListener: function createTrapListener(options) {
		if (!options)
			options = {};
		if (!options.name)
			options.name = 'snmpjs';

		options.log = defaultLogger(options.log, options.name);

		return (new TrapListener(options));
	},

	message: message,
	pdu: PDU,
	varbind: varbind,
	data: data,
	provider: provider,
	uint64_t: uint64_t
};
