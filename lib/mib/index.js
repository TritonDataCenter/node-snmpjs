/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var MIB = require('./mib');
var mib_2_system = require('./mib-2/system');

function
createMIB()
{
	return (new MIB());
}

module.exports = {
	createMIB: createMIB,
	std: {
		mib_2: {
			system: mib_2_system
		}
	}
};
