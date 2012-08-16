/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var test = require('tap').test;
var ASN1 = require('asn1').Ber;
var data;

function
_data(a)
{
	var r = new ASN1.Reader(new Buffer(a));
	return (data.createData({ value: r }));
}

function
_data_t(a, t)
{
	var r = new ASN1.Reader(new Buffer(a));
	return (data.createData({ type: t, value: r }));
}

function
_type_tag_chk(t, d, n, v)
{
	t.equal(d.typename, n, 'data is of type ' + n);
	t.equal(d.tag, v, 'tag is ' + v);
}

function
_cmp_buf(a, b)
{
	var i;

	if (a.length != b.length)
		return (false);

	for (i = 0; i < a.length; i++) {
		if (a[i] != b[i])
			return (false);
	}

	return (true);
}

test('load library', function(t) {
	data = require('../../lib/protocol/data');
	t.ok(data, 'module require should work');

	t.end();
});

test('integer construct from reader', function (t) {
	var d;

	d = _data([0x02, 0x01, 0x00]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 0, 'value is 0');

	d = _data([0x02, 0x01, 0x01]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 1, 'value is 1');

	d = _data([0x02, 0x01, 0x7f]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 127, 'value is 7f');

	d = _data([0x02, 0x04, 0x7f, 0xff, 0xff, 0xfc]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 2147483644, 'value is 7ffffffc');

	t.throws(function () {
		_data([0x11, 0x01, 0x04]);
	}, new ReferenceError('data type for ASN.1 tag 17 unknown'));

	t.end();
});

test('integer construct from reader, typed', function (t) {
	var d;

	d = _data_t([0x02, 0x01, 0x24], 'Integer');
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 36, 'value is 24');

	d = _data_t([0x47, 0x02, 0x11, 0x22], 'Integer');
	_type_tag_chk(t, d, 'Integer', 0x47);
	t.equal(d.value, 4386, 'value is 1122');

	d = _data_t([0x47, 0x02, 0x11, 0x22], ASN1.Integer);
	_type_tag_chk(t, d, 'Integer', 0x47);
	t.equal(d.value, 4386, 'value is 1122');

	t.throws(function () {
		_data_t([0x47, 0x02, 0x11, 0x22], 0x47);
	}, new ReferenceError('tag 71 has no registered type'));

	t.end();
});

test('integer construct from primitive', function (t) {
	var d;

	d = data.createData({ type: 'Integer', value: 0 });
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 0, 'value is 0');

	d = data.createData({ type: 'Integer', value: 0x7fffffff });
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 0x7fffffff, 'value is 7fffffff');

	t.throws(function () {
		data.createData({ type: 'Integer', value: 0x80000000 });
	}, new RangeError('value 2147483648 out of range for Integer'));

	t.throws(function () {
		data.createData({ type: 'Integer', value: 0x100000000 });
	}, new RangeError('value 4294967296 out of range for Integer'));

	t.throws(function () {
		data.createData({ type: 'Integer', value: 'foo' });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		data.createData({ type: 'Integer', value: {} });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		data.createData({ type: 'Integer', value: [] });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		data.createData({ type: 'Integer', value: 2.333 });
	}, new TypeError('value is of incompatible type'));

	t.end();
});

test('integer value access', function (t) {
	var d;

	d = data.createData({ type: 'Integer', value: 0 });
	d.value = 712;
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 712, 'value is 2c8');

	d.value++;
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 713, 'value is 2c9');

	d.value--;
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, 712, 'value is 2c8');

	t.throws(function () {
		d.value = 0x80000000;
	}, new RangeError('value 2147483648 out of range for Integer'));

	t.throws(function () {
		d.value = 0x100000000;
	}, new RangeError('value 4294967296 out of range for Integer'));

	t.throws(function () {
		d.value = 'foo';
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = '0.00002345';
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = {
			hi: 22,
			lo: 2933
		};
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = [ 1, 2, 3 ];
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = undefined;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = null;
	}, new TypeError('value is of incompatible type'));

	t.end();
});

test('octet string construct from reader', function (t) {
	var d;

	d = _data([0x04, 0x01, 0x00]);
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value, new Buffer([0])), 'string has correct value');

	d = _data([0x04, 0x06, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46]);
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value, new Buffer('ABCDEF', 'ascii')),
	    'string matches original value');

	t.end();
});

test('octet string construct from reader, typed', function (t) {
	var d;

	d = _data_t([0x04, 0x02, 0x08, 0x09], 'OctetString');
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value, new Buffer([0x8, 0x9])),
	    'string has correct value');

	d = _data_t([0x58, 0x02, 0x17, 0x2f], 'OctetString');
	_type_tag_chk(t, d, 'OctetString', 0x58);
	t.ok(_cmp_buf(d.value, new Buffer([0x17, 0x2f])),
	    'string has correct value');

	d = _data_t([0x58, 0x03, 0x55, 0x44, 0x33], ASN1.OctetString);
	_type_tag_chk(t, d, 'OctetString', 0x58);
	t.ok(_cmp_buf(d.value, new Buffer([0x55, 0x44, 0x33])),
	    'string matches original value');

	t.end();
});

test('octet string construct from primitive/object', function (t) {
	var d;

	d = data.createData({ type: 'OctetString', value: 'foobar' });
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value, new Buffer('foobar', 'ascii')),
	    'string matches original value');

	d = data.createData({ type: 'OctetString',
	    value: new Buffer([0x41, 0x00, 0x42, 0x20, 0x00, 0x43, 0x00]) });
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value,
	    new Buffer([0x41, 0x00, 0x42, 0x20, 0x00, 0x43, 0x00])),
	    'string matches original value');

	t.throws(function () {
		d = data.createData({ type: 'OctetString', value: 32 });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'OctetString', value: false });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'OctetString', value: null });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'OctetString', value: { a: 12 } });
	}, new TypeError('value is of incompatible type'));

	t.end();
});

test('octet string value access', function (t) {
	var d;

	d = data.createData({ type: 'OctetString' });
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.equal(d.value, undefined, 'initial value is undefined');

	d.value = 'foo';
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value, new Buffer('foo', 'ascii')),
	    'value matches string foo');

	d.value = new Buffer([0x00, 0x02, 0x44, 0x00]);
	_type_tag_chk(t, d, 'OctetString', ASN1.OctetString);
	t.ok(_cmp_buf(d.value, new Buffer([0x00, 0x02, 0x44, 0x00])),
	    'value matches assigned buffer');

	t.throws(function () {
		d.value = 32;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = true;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = null;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = {};
	}, new TypeError('value is of incompatible type'));

	t.end();
});

test('OID construct from reader', function (t) {
	var d;

	d = _data([0x06, 0x06, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x00]);
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.1.4.1.0', 'value is 1.3.6.1.4.1.0');

	t.end();
});

test('OID construct from reader, typed', function (t) {
	var d;

	d = _data_t([0x06, 0x06, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x00],
	    'ObjectIdentifier');
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.1.4.1.0', 'value is 1.3.6.1.4.1.0');

	d = _data_t([0x63, 0x06, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x00],
	    'ObjectIdentifier');
	_type_tag_chk(t, d, 'ObjectIdentifier', 0x63);
	t.equal(d.value, '1.3.6.1.4.1.0', 'value is 1.3.6.1.4.1.0');

	d = _data_t([0x63, 0x06, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x00], ASN1.OID);
	_type_tag_chk(t, d, 'ObjectIdentifier', 0x63);
	t.equal(d.value, '1.3.6.1.4.1.0', 'value is 1.3.6.1.4.1.0');

	t.end();
});

test('OID construct from primitive/object value', function (t) {
	var d;

	d = data.createData({ type: 'ObjectIdentifier',
	    value: '1.3.6.5.3.1.0' });
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.5.3.1.0', 'value is 1.3.6.5.3.1.0');

	d = data.createData({ type: 'ObjectIdentifier',
	    value: '.1.3.6.5.3.1.0' });
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.5.3.1.0', 'value is 1.3.6.5.3.1.0');

	d = data.createData({ type: 'ObjectIdentifier',
	    value: [ 1, 3, 6, 1, 9, 2, 11 ] });
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.1.9.2.11', 'value is 1.3.6.1.9.2.11');

	d = data.createData({ type: 'ObjectIdentifier' });
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, undefined, 'value is undefined');

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: 'fred' });
	}, new TypeError('object identifier component fred is malformed'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier', value: 12 });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier', value: {} });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: [ 1, 2, 3, 1e40 ] });
	}, new RangeError('object identifier component 1e+40 is too large'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier', value: true });
	}, new TypeError('value is of incompatible type'));

	t.end();
});

test('OID value access', function (t) {
	var d;

	d = data.createData({ type: 'ObjectIdentifier' });
	d.value = '2.4.6.8';
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '2.4.6.8', 'value is 2.4.6.8');

	d.value = '.1.3.6.1.5.0';
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.1.5.0', 'value is 1.3.6.1.5.0');

	d.value = [ 1, 3, 6, 1, 81, 223, 1, 0 ];
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.1.81.223.1.0', 'value is 1.3.6.1.81.223.1.0');

	t.throws(function () {
		d.value = -221;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = false;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = 'barney';
	}, new TypeError('object identifier component barney is malformed'));

	t.throws(function () {
		d.value = { hi: 112, lo: -843572 };
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = '.1.444444444444.12.0';
	}, new RangeError('object identifier component ' +
	    '444444444444 is too large'));

	t.throws(function () {
		d.value = [ 1, 0, 0, 0, -1, 0 ];
	}, new RangeError('object identifier component -1 is negative'));

	t.throws(function () {
		d.value = [ 1, 3, 6, 999999999999 ];
	}, new RangeError('object identifier component ' +
	    '999999999999 is too large'));

	t.end();
});

test('IpAddress construct from reader', function (t) {
	var d;

	d = _data([0x40, 0x04, 0xc0, 0xa8, 0x15, 0x01]);
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '192.168.21.1', 'value is 192.168.21.1');

	d = _data([0x40, 0x04, 0x00, 0x00, 0x00, 0x00]);
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '0.0.0.0', 'value is 0.0.0.0');

	t.throws(function () {
		d = _data([0x40, 0x02, 0x01, 0x01]);
	}, new RangeError('address length 2 is incorrect'));

	t.throws(function () {
		d = _data([0x40, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05]);
	}, new RangeError('address length 5 is incorrect'));

	t.end();
});

test('IpAddress construct from reader, typed', function (t) {
	var d;

	d = _data_t([0x27, 0x04, 0xc0, 0xa8, 0x15, 0x01], 'IpAddress');
	_type_tag_chk(t, d, 'IpAddress', 0x27);
	t.equal(d.value, '192.168.21.1', 'value is 192.168.21.1');

	t.throws(function () {
		d = _data_t([0x27, 0x03, 0x01, 0x02, 0x03], 'IpAddress');
	}, new RangeError('address length 3 is incorrect'));

	t.end();
});

test('IpAddress construct from primitive', function (t) {
	var d;

	d = data.createData({ type: 'IpAddress' });
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, undefined, 'value is undefined');

	d = data.createData({ type: 'IpAddress', value: '10.1.2.3' });
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '10.1.2.3', 'value is 10.1.2.3');

	d = data.createData({ type: 'IpAddress', value: '255.255.255.0' });
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '255.255.255.0', 'value is 255.255.255.0');

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: 'fred' });
	}, new TypeError('address fred is malformed'));

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: 32 });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: false });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: null });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: { foo: 1 } });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: [ 1 ] });
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d = data.createData({ type: 'IpAddress', value: '1.2.fred.4' });
	}, new TypeError('component fred is not an integer'));

	t.end();
});
