/*
 * Copyright (c) 2014 Joyent, Inc.  All rights reserved.
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
_encode(d)
{
	var w = new ASN1.Writer();
	d.encode(w);
	return (w.buffer);
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

	d = _data([0x02, 0x01, 0x80]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, -128, 'value is -128');

	d = _data([0x02, 0x01, 0xff]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, -1, 'value is -1');

	d = _data([0x02, 0x04, 0xbc, 0x24, 0x07, 0x4e]);
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, -1138489522, 'value is -1138489522');

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

	d = data.createData({ type: 'Integer', value: -40 });
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, -40, 'value is -40');

	d = data.createData({ type: 'Integer', value: -2147483648 });
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, -2147483648, 'value is -2147483648');

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

	d.value = -128;
	_type_tag_chk(t, d, 'Integer', ASN1.Integer);
	t.equal(d.value, -128, 'value is -128');

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
			_hi: 22,
			_lo: 2933
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

test('integer encode', function (t) {
	var bufs = [
		[0x02, 0x01, 0x00],
		[0x02, 0x01, 0x7e],
		[0x02, 0x01, 0x80],
		[0x02, 0x01, 0xdc],
		[0x02, 0x02, 0x10, 0x00],
		[0x02, 0x02, 0x4c, 0x73],
		[0x02, 0x02, 0x80, 0x00],
		[0x02, 0x02, 0xf0, 0xfe],
		[0x02, 0x03, 0x01, 0x00, 0x00],
		[0x02, 0x03, 0x2d, 0x78, 0x1b],
		[0x02, 0x03, 0x7f, 0xff, 0xfe],
		[0x02, 0x03, 0xa6, 0x22, 0x7c],
		[0x02, 0x04, 0x10, 0x00, 0x00, 0x00],
		[0x02, 0x04, 0x7f, 0xff, 0xff, 0xfe],
		[0x02, 0x04, 0x80, 0x00, 0x00, 0x00],
		[0x02, 0x04, 0xef, 0xff, 0xff, 0xfe]
	];
	bufs.forEach(function (b) {
		var d = _data(b);
		var eb = _encode(d);
		t.ok(_cmp_buf(b, eb), 'encode ' + d.value);
	});

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

test('octet string encode', function (t) {
	var v = [
		'foobar',
		new Buffer([0x01, 0x00, 0x41, 0x4c, 0x00, 0x20, 0x4d]),
		'foo bar baz quux',
		new Buffer([0xfc, 0x24, 0x59, 0xdc, 0x12, 0x00, 0x14, 0xeb]),
		new Buffer('fööbå®', 'utf8')
	];
	var ev = [
		[0x04, 0x06, 0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72],
		[0x04, 0x07, 0x01, 0x00, 0x41, 0x4c, 0x00, 0x20, 0x4d],
		[0x04, 0x10, 0x66, 0x6f, 0x6f, 0x20, 0x62, 0x61, 0x72,
		    0x20, 0x62, 0x61, 0x7a, 0x20, 0x71, 0x75, 0x75, 0x78],
		[0x04, 0x08, 0xfc, 0x24, 0x59, 0xdc, 0x12, 0x00, 0x14, 0xeb],
		[0x04, 0x0a, 0x66, 0xc3, 0xb6, 0xc3, 0xb6, 0x62, 0xc3, 0xa5,
		    0xc2, 0xae]
	];

	v.forEach(function (s, i) {
		var d = data.createData({ type: 'OctetString', value: s });
		var eb = _encode(d);
		console.log(eb);
		t.ok(_cmp_buf(eb, ev[i]), 'encode ' + d.value);
	});

	t.end();
});

test('OID construct from reader', function (t) {
	var d;

	d = _data([0x06, 0x06, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x00]);
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6.1.4.1.0', 'value is 1.3.6.1.4.1.0');

	d = _data([0x06, 0x04, 0x5e, 0x0e, 0x87, 0x46]);
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '2.14.14.966', 'value is 2.14.14.966');

	d = _data([0x06, 0x02, 0x2b, 0x06]);
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '1.3.6', 'value is 1.3.6');

	t.throws(function () {
		d = _data([0x06, 0x01, 0x29]);
	}, new RangeError('object identifier is too short'));

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
		    value: [ 0, 1, 'fred', 4 ] });
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

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: [ 1, 6, true, 13, 0 ]});
	}, new TypeError('object identifier component true is malformed'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: '1.4.7.blargh.5.11' });
	}, new TypeError('object identifier component blargh is malformed'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: '1.3.6.999999999999.1.0' });
	}, new RangeError('object identifier component ' +
	    '999999999999 is too large'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: '4.1.3.7.0' });
	}, new RangeError('object identifier does not begin with 0, 1, or 2'));

	t.throws(function () {
		d = data.createData({ type: 'ObjectIdentifier',
		    value: '1.40.2.11.6' });
	}, new RangeError('object identifier second component 40 exceeds ' +
	    'encoding limit of 39'));

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

	d.value = [ 2, 39, 127, 128, 129, 255, 256, 257, 948554 ];
	_type_tag_chk(t, d, 'ObjectIdentifier', ASN1.OID);
	t.equal(d.value, '2.39.127.128.129.255.256.257.948554',
	    'value is 2.39.127.128.129.255.256.257.948554');

	t.throws(function () {
		d.value = -221;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = false;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = 'barney';
	}, new RangeError('object identifier is too short'));

	t.throws(function () {
		d.value = 'fred.barney.pebbles';
	}, new TypeError('object identifier component fred is malformed'));

	t.throws(function () {
		d.value = { _hi: 112, _lo: -843572 };
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

	t.throws(function () {
		d.value = [ 1, 44, 6, 18, 114 ];
	}, new RangeError('object identifier second component 44 exceeds ' +
	    'encoding limit of 39'));

	t.throws(function () {
		d.value = [ 3, 1, 6, 0, 7, 0 ];
	}, new RangeError('object identifier does not begin with 0, 1, or 2'));

	t.throws(function () {
		d.value = [ 1, 3, 6, 3.14159, 7, 0, 1 ];
	}, new TypeError('object identifier component 3.14159 ' +
	    'is not an integer'));

	t.end();
});

test('OID encode', function (t) {
	var v = [
		'1.39.1.2.0.100.127.128.200.900.11002021',
		'1.3.6.1.16.145593',
		'0.16.12.81.0'
	];
	var ev = [
		[0x06, 0x10, 0x4f, 0x01, 0x02, 0x00, 0x64, 0x7f, 0x81, 0x00,
		    0x81, 0x48, 0x87, 0x04, 0x85, 0x9f, 0xc1, 0x25],
		[0x06, 0x07, 0x2b, 0x06, 0x01, 0x10, 0x88, 0xf1, 0x39],
		[0x06, 0x04, 0x10, 0x0c, 0x51, 0x00]
	];

	v.forEach(function (o, i) {
		var d = data.createData({ type: 'ObjectIdentifier', value: o });
		var eb = _encode(d);
		t.ok(_cmp_buf(eb, ev[i]), 'encode ' + d.value);
	});

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

test('IpAddress value access', function (t) {
	var d;

	d = data.createData({ type: 'IpAddress' });
	d.value = '1.2.3.4';
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '1.2.3.4', 'value is 1.2.3.4');

	d.value = '10.207.11.43';
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '10.207.11.43', 'value is 10.207.11.43');

	d.value = '255.255.255.255';
	_type_tag_chk(t, d, 'IpAddress', 0x40);
	t.equal(d.value, '255.255.255.255', 'value is 255.255.255.255');

	t.throws(function () {
		d.value = '1.3.5';
	}, new TypeError('address 1.3.5 is malformed'));

	t.throws(function () {
		d.value = 400;
	}, new TypeError('value is of incompatible type'));

	t.throws(function () {
		d.value = '146.fred.10.166';
	}, new TypeError('component fred is not an integer'));

	t.throws(function () {
		d.value = '256.167.10.8';
	}, new RangeError('component 256 is out of range'));

	t.end();
});

test('IpAddress encode', function (t) {
	var v = [
		'134.197.40.166',
		'10.10.0.100',
		'127.0.0.1',
		'0.0.0.0',
		'255.255.255.255'
	];
	var ev = [
		[0x40, 0x04, 0x86, 0xc5, 0x28, 0xa6],
		[0x40, 0x04, 0x0a, 0x0a, 0x00, 0x64],
		[0x40, 0x04, 0x7f, 0x00, 0x00, 0x01],
		[0x40, 0x04, 0x00, 0x00, 0x00, 0x00],
		[0x40, 0x04, 0xff, 0xff, 0xff, 0xff]
	];

	v.forEach(function (a, i) {
		var d = data.createData({ type: 'IpAddress', value: a });
		var eb = _encode(d);
		t.ok(_cmp_buf(eb, ev[i]), 'encoded ' + d.value);
	});

	t.end();
});

test('Counter32 construct from reader', function (t) {
	var d;

	d = _data([0x41, 0x01, 0x00]);
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0, 'value is 0');

	d = _data([0x41, 0x04, 0x11, 0x26, 0xa5, 0x02]);
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0x1126a502 >>> 0, 'value is 1126a502');

	d = _data([0x41, 0x04, 0xb0, 0x2f, 0x4c, 0x10]);
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0xb02f4c10 >>> 0, 'value is b02f4c10');

	d = _data([0x41, 0x05, 0x00, 0xf4, 0x23, 0x00, 0x03]);
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0xf4230003 >>> 0, 'value is f4230003');

	t.throws(function () {
		d = _data([0x41, 0x05, 0xff, 0x8c, 0x2a, 0x08, 0x04]);
	}, new RangeError('integer is too long'));

	t.end();
});

test('Counter32 construct from reader, typed', function (t) {
	var d;

	d = _data_t([0x41, 0x01, 0x21], 'Counter32');
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0x21, 'value is 21');

	d = _data_t([0x28, 0x03, 0xd2, 0x47, 0x10], 'Counter32');
	_type_tag_chk(t, d, 'Counter32', 0x28);
	t.equal(d.value, 0xd24710, 'value is d24710');

	d = _data_t([0x67, 0x04, 0xf7, 0xff, 0x2c, 0x94], 'Counter32');
	_type_tag_chk(t, d, 'Counter32', 0x67);
	t.equal(d.value, 0xf7ff2c94 >>> 0, 'value is f7ff2c94');

	t.end();
});

test('Counter32 construct from primitive', function (t) {
	var d;

	d = data.createData({ type: 'Counter32' });
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, undefined, 'value is undefined');

	d = data.createData({ type: 'Counter32', value: 0 });
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0, 'value is 0');

	d = data.createData({ type: 'Counter32', value: 104942 });
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 104942, 'value is 104942');

	d = data.createData({ type: 'Counter32', value: 0xffffffff });
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0xffffffff, 'value is ffffffff');

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: 'fred' });
	}, new TypeError('value is not a number'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: '2' });
	}, new TypeError('value is not a number'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: false });
	}, new TypeError('value is not a number'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: [ 2 ] });
	}, new TypeError('value is not a number'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: { fred: 2 } });
	}, new TypeError('value is not a number'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: 15.662 });
	}, new TypeError('value is not an integer'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: -2000 });
	}, new RangeError('value -2000 out of range for Counter32'));

	t.throws(function () {
		d = data.createData({ type: 'Counter32', value: 0x100000000 });
	}, new RangeError('value 4294967296 out of range for Counter32'));

	t.end();
});

test('Counter32 value access', function (t) {
	var d;

	d = data.createData({ type: 'Counter32' });
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, undefined, 'value is undefined');

	d.value = 94933;
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 94933, 'value is 94933');

	d.value = 0;
	_type_tag_chk(t, d, 'Counter32', 0x41);
	t.equal(d.value, 0, 'value is 0');

	t.throws(function () {
		d.value = -1;
	}, new RangeError('value -1 out of range for Counter32'));

	t.throws(function () {
		d.value = '194';
	}, new TypeError('value is not a number'));

	t.throws(function () {
		d.value = -474722.102422;
	}, new TypeError('value is not an integer'));

	t.equal(d.value, 0, 'value is still 0');

	t.end();
});

test('Counter32 encode', function (t) {
	t.end();
});

test('Unsigned32 construct from reader', function (t) {
	t.end();
});

test('Unsigned32 construct from reader, typed', function (t) {
	t.end();
});

test('Unsigned32 construct from primitive', function (t) {
	t.end();
});

test('Unsigned32 value access', function (t) {
	t.end();
});

test('Unsigned32 encode', function (t) {
	t.end();
});

test('TimeTicks construct from reader', function (t) {
	t.end();
});

test('TimeTicks construct from reader, typed', function (t) {
	t.end();
});

test('TimeTicks construct from primitive', function (t) {
	t.end();
});

test('TimeTicks value access', function (t) {
	t.end();
});

test('TimeTicks encode', function (t) {
	t.end();
});

test('Opaque construct from reader', function (t) {
	t.end();
});

test('Opaque construct from reader, typed', function (t) {
	t.end();
});

test('Opaque construct from primitive', function (t) {
	t.end();
});

test('Opaque value access', function (t) {
	t.end();
});

test('Opaque encode', function (t) {
	t.end();
});

test('Counter64 construct from reader', function (t) {
	var d;

	d = _data([0x46, 0x01, 0x00]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0, _lo: 0 }, 'value is 0');

	d = _data([0x46, 0x01, 0x01]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0, _lo: 1 }, 'value is 1');

	d = _data([0x46, 0x01, 0x7f]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0, _lo: 127 }, 'value is 7f');

	d = _data([0x46, 0x04, 0x7f, 0xff, 0xff, 0xfc]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0, _lo: 2147483644 }, 'value is 7ffffffc');

	d = _data([0x46, 0x04, 0x80, 0x00, 0x00, 0x00]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0, _lo: 2147483648 >>> 0 },
	    'value is 80000000');

	d = _data([0x46, 0x07, 0x2c, 0x49, 0xee, 0xd4, 0x20, 0x00, 0x4c]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0x2c49ee >>> 0, _lo: 0xd420004c >>> 0 },
	    'value is 2c49eed420004c');

	d = _data([0x46, 0x08, 0xc0, 0x2c, 0x49, 0xee, 0xd4, 0x20, 0x00, 0x4c]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0xc02c49ee >>> 0, _lo: 0xd420004c >>> 0 },
	    'value is c02c49eed420004c');

	d = _data([0x46, 0x09, 0x00, 0xd4, 0x22, 0x33, 0x44, 0x8a,
	    0x01, 0x00, 0x28]);
	_type_tag_chk(t, d, 'Counter64', 0x46);
	t.deepEqual(d.value, { _hi: 0xd4223344 >>> 0, _lo: 0x8a010028 >>> 0 },
	    'value is d42233448a010028');

	t.throws(function () {
		d = _data([0x46, 0x09, 0x02, 0x11, 0x22, 0x33, 0x44, 0x55,
		    0x66, 0x77, 0x88]);
	}, new RangeError('integer is too long'));

	t.end();
});

test('Counter64 construct from reader, typed', function (t) {
	t.end();
});

test('Counter64 construct from primitive', function (t) {
	t.end();
});

test('Counter64 value access', function (t) {
	t.end();
});

test('Counter64 encode', function (t) {
	t.end();
});

test('Null construct from reader', function (t) {
	t.end();
});

test('Null construct from reader, typed', function (t) {
	t.end();
});

test('Null construct from primitive', function (t) {
	t.end();
});

test('Null value access', function (t) {
	t.end();
});

test('Null encode', function (t) {
	t.end();
});

test('OID canonicalization', function (t) {
	t.end();
});

test('type registration subsystem', function (t) {
	t.end();
});
