/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var d = require('dtrace-provider');

var agent_provider;
var dtrace_id = 0;
var MAX_INT = 4294967295;

/*
 * 0: id
 * 1: remote address
 * 2: OID
 */
var AGENT_PROBES = {
	'agent-get-start': [ 'int', 'char *', 'char *' ],
	/* 3: status, 4: value */
	'agent-get-done': [ 'int', 'char *', 'char *', 'int', 'char *' ]
};

module.exports = function () {
	if (!agent_provider) {
		agent_provider = d.createDTraceProvider('snmpjs');

		Object.keys(AGENT_PROBES).forEach(function (p) {
			var args = AGENT_PROBES[p].splice(0);
			args.unshift(p);

			d.DTraceProvider.prototype.addProbe.apply(
			    agent_provider, args);
		});

		agent_provider.enable();
		agent_provider._nextId = function () {
			if (dtrace_id === MAX_INT)
				dtrace_id = 0;

			return (++dtrace_id);
		};
	}

	return (agent_provider);
}();
