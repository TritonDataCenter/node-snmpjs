/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var util = require('util');

function
EmptyMessageError()
{
	this.name = 'EmptyMessageError';
}
util.inherits(EmptyMessageError, Error);

function
MessageParseError(str, info)
{
	this.name = 'MessageParseError';
	this.message = str;
	this.token = info.token;
	this.offset = info.loc;
	this.expected = info.expected;
}
util.inherits(MessageParseError, Error);

function
NoSupportError(str)
{
	this.name = 'NoSupportError';
	this.message = str;
}
util.inherits(NoSupportError, Error);

module.exports = {
	EmptyMessageError: EmptyMessageError,
	MessageParseError: MessageParseError,
	NoSupportError: NoSupportError
};
