/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */
var util = require('util');

function
TypeConflictError(str)
{
	this.name = 'TypeConflictError';
	this.message = str;
}
util.inherits(TypeConflictError, Error);

module.exports = {
	TypeConflictError: TypeConflictError
};
