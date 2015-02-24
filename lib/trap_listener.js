/*
 * Copyright (c) 2013 Joyent, Inc.  All rights reserved.
 */

var util = require('util');
var Listener = require('./listener');
var PDU = require('./protocol/pdu');

function
TrapListener(options)
{
	Listener.call(this, options);
}
util.inherits(TrapListener, Listener);

TrapListener.prototype._process_msg = function _process_msg(msg) {
	switch (msg.pdu.op) {
	case PDU.Trap:
	case PDU.InformRequest:
	case PDU.SNMPv2_Trap:
		this.emit('trap', msg);
		break;
	case PDU.GetRequest:
	case PDU.SetRequest:
	case PDU.GetNextRequest:
	case PDU.GetBulkRequest:
	case PDU.Response:
	case PDU.Report:
	default:
		Listener.prototype._process_msg.call(this, msg);
		break;
	}
};

module.exports = TrapListener;
