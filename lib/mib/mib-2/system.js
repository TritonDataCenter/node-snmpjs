/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var os = require('os');
var snmp = require('../../index.js');

var SYSTEM_OID = '.1.3.6.1.2.1.1'
var PRIVATE_ENTERPRISES_OID = '.1.3.6.1.4.1'

function
mib2_system_sysDescr(desc, prq)
{
  desc = desc || 'node-snmpjs';
	var val = snmp.data.createData({ type: 'OctetString',
	    value: desc });
	snmp.provider.readOnlyScalar(prq, val);
}

/**
 * http://oid-info.com/get/1.3.6.1.2.1.1.2
 */
function
mib2_system_sysObjectID(oid, prq)
{
  oid = oid || PRIVATE_ENTERPRISES_OID + '.42.2.2.5'; // sun microsystems?
	var data = {
		type: 'ObjectIdentifier',
		value: oid
	};
	var val = snmp.data.createData(data);
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysUpTime(prq)
{
  var uptime = os.uptime() * 100; // uptime returns seconds, TimeTicks specifies 100ths of a second.
	var val = snmp.data.createData({ type: 'TimeTicks', value: uptime });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysContact(contactName, prq)
{
  contactName = contactName || 'Richard Nixon, trickydick@whitehouse.gov';
	var val = snmp.data.createData({ type: 'OctetString',
	    value: contactName });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysName(name, prq)
{
	var nodename = name || os.hostname();
	var val = snmp.data.createData({ type: 'OctetString',
	    value: nodename });
	snmp.provider.readOnlyScalar(prq, val);
}

function
mib2_system_sysLocation(location, prq)
{
  location = location || 'home';
	/* XXX configuration */
	var val = snmp.data.createData({ type: 'OctetString',
	    value: location });
	snmp.provider.readOnlyScalar(prq, val);
}

/**
 * http://oid-info.com/get/1.3.6.1.2.1.1.7
 * Automatically uses 72 which indicates application services
 */
function
mib2_system_sysServices(prq)
{
	var val = snmp.data.createData({ type: 'Integer', value: 72 });
	snmp.provider.readOnlyScalar(prq, val);
}

/**
 * Factory function for system MIB providers (1.3.6.1.2.1.1)
 * This function accepts an object that contains data for the various handlers, e.g.
 * `{name, description, oid, contact, location}` and automatically handles
 * `sysUptime` (using `os.uptime()`) and `sysServices`.
 * The passed object is available as a property on this function to allow
 * for updating values after the providers are bound.  e.g.
 *
 * ```
 * var sysProviders = getSystemProvider({ name: 'm0dem', location: 'west wing'});
 * agent.addProviders(sysProviders());
 * // later...
 * sysProviders.data.name = 'l3Switch';
 * // new requests for sysName will return 'l3Switch'
 * ```
 *
 * @param systemProviderInfo {object} system provider data
 * @param systemProviderInfo.name {string} sysName
 * @param systemProviderInfo.oid {string} private enterprises assigned OID that identifies the product type
 * @param systemProviderInfo.contact {string} sysContact
 * @param systemProviderInfo.description {string} sysDescription
 * @param systemProviderInfo.location {string} sysLocation
 * @see http://oid-info.com/get/1.3.6.1.2.1.1
 * @return {function} factory function with system provider variables
 *         accessible via the `data` property
 */
function
buildSystemProvider(systemProviderInfo) {

  var data = systemProviderInfo;

  var bindProviders = function sysProviders() {
    return [
      {
        oid: SYSTEM_OID + '.1',
        handler: function sysDescr(prq) { mib2_system_sysDescr(data.description, prq) }
      },
      {
        oid: SYSTEM_OID + '.2',
        handler: function sysOID(prq) { mib2_system_sysObjectID(data.oid, prq) }
      },
      {
        oid: SYSTEM_OID + '.3',
        handler: mib2_system_sysUpTime
      },
      {
        oid: SYSTEM_OID + '.4',
        handler: function sysContact(prq) { mib2_system_sysContact(data.contact, prq) }
      },
      {
        oid: SYSTEM_OID + '.5',
        handler: function sysName(prq) { mib2_system_sysName(data.name, prq) }
      },
      {
        oid: SYSTEM_OID + '.6',
        handler: function sysLocation(prq) { mib2_system_sysLocation(data.location, prq) }
      },
      {
        oid: SYSTEM_OID + '.7',
        handler: mib2_system_sysServices
      } ];
  };
  bindProviders.systemData = data;

  return bindProviders;
}

module.exports = buildSystemProvider;
