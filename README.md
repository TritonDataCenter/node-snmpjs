snmpjs provides a toolkit for SNMP agents and management applications in
Node.js.

## Usage

For full docs, see <http://wesolows.github.com/node-snmpjs/>.

	var os = require('os');
	var snmp = require('snmpjs');
	var logger = require('bunyan');

	var log = new logger({
		name: 'snmpd',
		level: 'info'
	});

	var agent = snmp.createAgent({
		log: log
	});

	agent.request({ oid: '.1.3.6.1.2.1.1.5', handler: function (prq) {
		var nodename = os.hostname();
		var val = snmp.data.createData({ type: 'OctetString',
		    value: nodename });

		snmp.provider.readOnlyScalar(prq, val);
	} });

	agent.bind({ family: 'udp4', port: 161 });

Try hitting that with your favourite SNMP get utility, such as:

	$ snmpget -v 2c -c any localhost .1.3.6.1.2.1.1.5

## Installation

	$ npm install snmpjs

## License

MIT.

## Bugs

See <https://github.com/wesolows/node-snmpjs/issues>.
