/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var test = require('tap').test;

test('load library', function(t) {
	var data = require('../../lib/protocol/data');
	t.ok(data);

	t.end();
});
