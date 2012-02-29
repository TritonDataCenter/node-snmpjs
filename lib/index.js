/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

/*
 * SNMP is defined by a large set of specifications.  See
 * http://www.snmp.com/protocol/snmp_rfcs.shtml as a starting point.
 */

var d = require('dtrace-provider');
var agent = require('./agent');
var message = require('./protocol/message');
var PDU = require('./protocol/pdu');
var varbind = require('./protocol/varbind');
var data = require('./protocol/data');

var DTRACE;

function
defaultDTrace(name)
{
	if (!DTRACE)
		DTRACE = d.createDTraceProvider(name);

	return (DTRACE);
}

function
createAgent(options)
{
	if (!options)
		options = {};
	if (!options.name)
		options.name = 'snmp';
	if (!options.dtrace)
		options.dtrace = defaultDTrace(options.name);

	return (new agent(options));
}

module.exports = {
	createAgent: createAgent,
	message: message,
	pdu: PDU,
	varbind: varbind,
	data: data
};
