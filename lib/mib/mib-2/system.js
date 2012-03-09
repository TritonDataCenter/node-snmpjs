/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var os = require('os');
var snmp = require('../../index.js');

function
mib2_system_sysDescr(prq)
{
	/* XXX configuration */
	var val = snmp.data.createData({ type: 'OctetString',
	    value: 'node-snmpjs' });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysObjectID(prq)
{
	var sun = '.1.3.6.1.4.1.42';
	var data = {
		type: 'ObjectIdentifier',
		value: sun + '.2.2.5'
	};
	var val = snmp.data.createData(data);
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysUpTime(prq)
{
	/* XXX introspection */
	var val = snmp.data.createData({ type: 'TimeTicks', value: 0 });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysContact(prq)
{
	/* XXX configuration */
	var val = snmp.data.createData({ type: 'OctetString',
	    value: 'Richard Nixon, trickydick@whitehouse.gov' });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysName(prq)
{
	var nodename = os.hostname();
	var val = snmp.data.createData({ type: 'OctetString',
	    value: nodename });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysLocation(prq)
{
	/* XXX configuration */
	var val = snmp.data.createData({ type: 'OctetString',
	    value: 'home' });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysServices(prq)
{
	/* XXX configuration */
	var val = snmp.data.createData({ type: 'Integer', value: 72 });
	snmp.provider.readOnlyScalar(prq, val);
}

var system = [
{
	oid: '.1.3.6.1.2.1.1.1',
	handler: mib2_system_sysDescr
},
{
	oid: '.1.3.6.1.2.1.1.2',
	handler: mib2_system_sysObjectID
},
{
	oid: '.1.3.6.1.2.1.1.3',
	handler: mib2_system_sysUpTime
},
{
	oid: '.1.3.6.1.2.1.1.4',
	handler: mib2_system_sysContact
},
{
	oid: '.1.3.6.1.2.1.1.5',
	handler: mib2_system_sysName
},
{
	oid: '.1.3.6.1.2.1.1.6',
	handler: mib2_system_sysLocation
},
{
	oid: '.1.3.6.1.2.1.1.7',
	handler: mib2_system_sysServices
} ];

module.exports = system;
