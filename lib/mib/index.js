/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var mib2_system = require('./mib-2/system');

module.exports = function () {
	var providers = [];

	providers = providers.concat(mib2_system);

	return (providers);
}();
