/*
 * Copyright (c) 2014 Joyent, Inc.  All rights reserved.
 */

var test = require('tap').test;
var uint64_t;

test('load library', function (t) {
	uint64_t = require('../../lib/protocol/uint64_t');
	t.ok(uint64_t, 'module require should work');

	t.end();
});

test('creation', function (t) {
	var a = new uint64_t(0, 0);
	t.deepEqual(a, { _hi: 0, _lo: 0 }, 'explicit double zero');

	a = new uint64_t(0);
	t.deepEqual(a, { _hi: 0, _lo: 0 }, 'explicit single zero');

	a = new uint64_t(42);
	t.deepEqual(a, { _hi: 0, _lo: 42 }, 'single small integer');

	a = new uint64_t('0');
	t.deepEqual(a, { _hi: 0, _lo: 0 }, 'string 0');

	a = new uint64_t('42');
	t.deepEqual(a, { _hi: 0, _lo: 42 }, 'string small decimal');

	a = new uint64_t('042');
	t.deepEqual(a, { _hi: 0, _lo: 042 }, 'string small octal');

	a = new uint64_t('0x42');
	t.deepEqual(a, { _hi: 0, _lo: 0x42 }, 'string small hex');

	a = new uint64_t('0x1fff00ff');
	t.deepEqual(a, { _hi: 0, _lo: 0x1fff00ff }, 'string medium hex');

	a = new uint64_t('0x1ffff0000');
	t.deepEqual(a, { _hi: 1, _lo: 0xffff0000 }, 'string 33 hex');

	a = new uint64_t('0xffff1234ebc068ac');
	t.deepEqual(a, { _hi: 0xffff1234, _lo: 0xebc068ac },
	    'string large hex');

	a = new uint64_t('18446744073709551615');
	t.deepEqual(a, { _hi: 0xffffffff, _lo: 0xffffffff },
	    'string max decimal');

	a = new uint64_t(0x12345678, 0x9abcdef0);
	t.deepEqual(a, { _hi: 0x12345678, _lo: 0x9abcdef0 },
	    'explicit hex 61 pair');

	t.throws(function () {
		a = new uint64_t('0x123456789abcdef01');
	}, new RangeError('hex value too large'));

	t.throws(function () {
		a = new uint64_t({ foo: 'bar' });
	}, new TypeError('hi and lo components must be integers'));

	t.throws(function () {
		a = new uint64_t(4.6, 299.000001);
	}, new TypeError('hi and lo components must be integers'));

	t.throws(function () {
		a = new uint64_t(-2944.12);
	}, new TypeError('hi and lo components must be integers'));

	t.end();
});

test('addition', function (t) {
	var a = new uint64_t(0, 0x456);
	var b = new uint64_t(0, 0x125);
	var s = uint64_t.addq(a, b);
	t.deepEqual(s, { _hi: 0, _lo: 0x57b }, '456 + 125 = 57b');
	s = uint64_t.addq(b, a);
	t.deepEqual(s, { _hi: 0, _lo: 0x57b }, '125 + 456 = 57b');

	a = new uint64_t(0);
	b = new uint64_t(0x147, 0x2c0509);
	s = uint64_t.addq(a, b);
	t.deepEqual(s, { _hi: 0x147, _lo: 0x2c0509 },
	    '0 + 147002c0509 = 147002c0509');
	s = uint64_t.addq(b, a);
	t.deepEqual(s, { _hi: 0x147, _lo: 0x2c0509 },
	    '147002c0509 + 0 = 147002c0509');

	a = new uint64_t(0x1bd1, 0x29c00410);
	b = new uint64_t(0, 0x29aa05c0);
	s = uint64_t.addq(a, b);
	t.deepEqual(s, { _hi: 0x1bd1, _lo: 0x536a09d0 },
	    '1bd129c00410 + 29aa05c0 = 1bd1536a09d0');
	s = uint64_t.addq(b, a);
	t.deepEqual(s, { _hi: 0x1bd1, _lo: 0x536a09d0 },
	    '29aa05c0 + 1bd129c00410 = 1bd1536a09d0');

	a = new uint64_t(0xfeedface, 0xdeadbeef);
	b = new uint64_t(0, 0xbeeff00d);
	s = uint64_t.addq(a, b);
	t.deepEqual(s, { _hi: 0xfeedfacf, _lo: 0x9d9daefc },
	    'feedfacedeadbeef + beeff00d = feedfacf9d9daefc');
	s = uint64_t.addq(b, a);
	t.deepEqual(s, { _hi: 0xfeedfacf, _lo: 0x9d9daefc },
	    'beeff00d + feedfacedeadbeef = feedfacf9d9daefc');

	a = new uint64_t(0xffffffff, 0xffffffff);
	b = new uint64_t(0, 1);
	s = uint64_t.addq(a, b);
	t.deepEqual(s, { _hi: 0, _lo: 0 },
	    'ffffffffffffffff + 1 = 0');
	s = uint64_t.addq(b, a);
	t.deepEqual(s, { _hi: 0, _lo: 0 },
	    '1 + ffffffffffffffff = 0');

	t.end();
});

test('subtraction', function (t) {
	var a = new uint64_t(0, 0x456);
	var b = new uint64_t(0, 0x125);
	var d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0, _lo: 0x331 }, '456 - 125 = 331');

	a = new uint64_t(0xc60a4221, 0xa8c8917b);
	b = new uint64_t(0);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0xc60a4221, _lo: 0xa8c8917b },
	    'c60a4221a8c8917b - 0 = c60a4221a8c8917b');

	a = new uint64_t(0x1bd1, 0x4444aaaa);
	b = new uint64_t(0x1000, 0x00000000);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0xbd1, _lo: 0x4444aaaa },
	    '1bd14444aaaa - 100000000000 = bd14444aaaa');

	a = new uint64_t(0x80000000, 0);
	b = new uint64_t(0x7fffffff, 0xffffffff);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0, _lo: 1 },
	    '8000000000000000 - 7fffffffffffffff = 1');

	a = new uint64_t(0x4001, 0x00001cc8);
	b = new uint64_t(0x2e, 0xfc002bfc);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0x3fd2, _lo: 0x3fff0cc },
	    '400100001cc8 - 2efc002bfc = 3fd203fff0cc');

	a = new uint64_t(0);
	b = new uint64_t(1);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0xffffffff, _lo: 0xffffffff },
	    '0 - 1 = ffffffffffffffff');

	a = new uint64_t(0xa000);
	b = new uint64_t(1, 0);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0xffffffff, _lo: 0xa000 },
	    'a000 - 100000000 = ffffffff0000a000');

	a = new uint64_t(0x3cf2, 0xfb002dee);
	b = new uint64_t(0x68ad0, 0x016400c2);
	d = uint64_t.subq(a, b);
	t.deepEqual(d, { _hi: 0xfff9b222, _lo: 0xf99c2d2c },
	    '3cf2fb002dee - 68ad0016400c2 = fff9b222f99c2d2c');

	t.end();
});

test('multiplication', function (t) {
	var a = new uint64_t(0, 0x456);
	var b = new uint64_t(0, 0x125);
	var p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 0, _lo: 0x4f66e }, '456 * 125 = 4f66e');

	a = new uint64_t(0, 0);
	b = new uint64_t(0xffffffff, 0xffffffff);
	p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 0, _lo: 0 }, 'product with 0 is 0');
	p = uint64_t.mulq(b, a);
	t.deepEqual(p, { _hi: 0, _lo: 0 }, 'product with 0 is 0');

	a = new uint64_t(0, 1);
	b = new uint64_t(0xffffffff, 0);
	p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 0xffffffff, _lo: 0 },
	    'ffffffff00000000 * 1 = ffffffff00000000');
	p = uint64_t.mulq(b, a);
	t.deepEqual(p, { _hi: 0xffffffff, _lo: 0 },
	    '1 * ffffffff00000000 = ffffffff00000000');

	a = new uint64_t(0, 0x10000000);
	p = uint64_t.mulq(a, a);
	t.deepEqual(p, { _hi: 0x1000000, _lo: 0 },
	    '10000000 * 10000000 = 100000000000000');

	a = new uint64_t(1, 0);
	p = uint64_t.mulq(a, a);
	t.deepEqual(p, { _hi: 0, _lo: 0 },
	    '100000000 * 100000000 = 0');

	a = new uint64_t(0, 0x2cc9a);
	b = new uint64_t(0x174, 0x5a0236c4);
	p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 0x4124bbc, _lo: 0x568121e8 },
	    '2cc9a * 1745a0236c4 = 4124bbc568121e8');
	p = uint64_t.mulq(b, a);
	t.deepEqual(p, { _hi: 0x4124bbc, _lo: 0x568121e8 },
	    '1745a0236c4 * 2cc9a = 4124bbc568121e8');

	a = new uint64_t(0, 0xffffffff);
	p = uint64_t.mulq(a, a);
	t.deepEqual(p, { _hi: 0xfffffffe, _lo: 1 },
	    'ffffffff * ffffffff = fffffffe00000001');

	a = new uint64_t(0, 0xffffffff);
	b = new uint64_t(1, 0);
	p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 0xffffffff, _lo: 0 },
	    'ffffffff * 100000000 = ffffffff00000000');
	p = uint64_t.mulq(b, a);
	t.deepEqual(p, { _hi: 0xffffffff, _lo: 0 },
	    '100000000 * ffffffff = ffffffff00000000');

	a = new uint64_t(0, 0xffffffff);
	b = new uint64_t(1, 1);
	p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 0xffffffff, _lo: 0xffffffff },
	    'ffffffff * 100000001 = ffffffffffffffff');
	p = uint64_t.mulq(b, a);
	t.deepEqual(p, { _hi: 0xffffffff, _lo: 0xffffffff },
	    '100000001 * ffffffff = ffffffffffffffff');

	a = new uint64_t(0, 0xffff);
	b = new uint64_t(0, 0x1ffff);
	p = uint64_t.mulq(a, b);
	t.deepEqual(p, { _hi: 1, _lo: 0xfffd0001 },
	    'ffff * 1ffff = 1fffd0001');
	p = uint64_t.mulq(b, a);
	t.deepEqual(p, { _hi: 1, _lo: 0xfffd0001 },
	    '1ffff * ffff = 1fffd0001');

	t.end();
});

test('shift left', function (t) {
	var a = new uint64_t(0, 0x456);
	var r = uint64_t.shlq(a, 0);
	t.deepEqual(r, { _hi: 0, _lo: 0x456 }, '456 << 0 = 456');

	a = new uint64_t(0, 0);
	r = uint64_t.shlq(a, 18);
	t.deepEqual(r, { _hi: 0, _lo: 0 }, '0 << 18 = 0');
	r = uint64_t.shlq(a, 46);
	t.deepEqual(r, { _hi: 0, _lo: 0 }, '0 << 46 = 0');
	r = uint64_t.shlq(a, 64);
	t.deepEqual(r, { _hi: 0, _lo: 0 }, '0 << 64 = 0');
	r = uint64_t.shlq(a, 72);
	t.deepEqual(r, { _hi: 0, _lo: 0 }, '0 << 72 = 0');

	a = new uint64_t(0x5a5a5a5a, 0xa5a5a5a5);
	r = uint64_t.shlq(a, 0);
	t.deepEqual(r, { _hi: 0x5a5a5a5a, _lo: 0xa5a5a5a5 },
	    '5a5a5a5aa5a5a5a5 << 0 = 5a5a5a5aa5a5a5a5');
	r = uint64_t.shlq(a, 1);
	t.deepEqual(r, { _hi: 0xb4b4b4b5, _lo: 0x4b4b4b4a },
	    '5a5a5a5aa5a5a5a5 << 1 = b4b4b4b54b4b4b4a');
	r = uint64_t.shlq(a, 31);
	t.deepEqual(r, { _hi: 0x52d2d2d2, _lo: 0x80000000 },
	    '5a5a5a5aa5a5a5a5 << 31 = 52d2d2d280000000');
	r = uint64_t.shlq(a, 32);
	t.deepEqual(r, { _hi: 0xa5a5a5a5, _lo: 0 },
	    '5a5a5a5aa5a5a5a5 << 32 = a5a5a5a500000000');
	r = uint64_t.shlq(a, 33);
	t.deepEqual(r, { _hi: 0x4b4b4b4a, _lo: 0 },
	    '5a5a5a5aa5a5a5a5 << 33 = 4b4b4b4a00000000');
	r = uint64_t.shlq(a, 63);
	t.deepEqual(r, { _hi: 0x80000000, _lo: 0 },
	    '5a5a5a5aa5a5a5a5 << 63 = 8000000000000000');
	r = uint64_t.shlq(a, 64);
	t.deepEqual(r, { _hi: 0, _lo: 0 },
	    '5a5a5a5aa5a5a5a5 << 64 = 0');
	r = uint64_t.shlq(a, 65);
	t.deepEqual(r, { _hi: 0, _lo: 0 },
	    '5a5a5a5aa5a5a5a5 << 65 = 0');

	a = new uint64_t(0, 0xc0010001);
	r = uint64_t.shlq(a, 1);
	t.deepEqual(r, { _hi: 1, _lo: 0x80020002 },
	    'c0010001 << 1 = 180020002');

	a = new uint64_t(0xf0000000, 0xf0000000);
	r = uint64_t.shlq(a, 1);
	t.deepEqual(r, { _hi: 0xe0000001, _lo: 0xe0000000 },
	    'f0000000f0000000 << 1 = e0000001e0000000');
	r = uint64_t.shlq(a, 16);
	t.deepEqual(r, { _hi: 0xf000, _lo: 0 },
	    'f0000000f0000000 << 16 = f00000000000');

	t.end();
});

test('shift right', function (t) {
	var a = new uint64_t(0, 0x456);
	var r = uint64_t.shrlq(a, 0);
	t.deepEqual(r, { _hi: 0, _lo: 0x456 }, '456 >>> 0 = 456');

	a = new uint64_t(0);
	r = uint64_t.shrlq(a, 6);
	t.deepEqual(r, { _hi: 0, _lo: 0 }, '0 >>> 6 = 0');

	a = new uint64_t(0x10000000, 0);
	r = uint64_t.shrlq(a, 1);
	t.deepEqual(r, { _hi: 0x8000000, _lo: 0 },
	    '1000000000000000 >>> 1 = 800000000000000');
	r = uint64_t.shrlq(a, 20);
	t.deepEqual(r, { _hi: 0x100, _lo: 0 },
	    '1000000000000000 >>> 20 = 10000000000');
	r = uint64_t.shrlq(a, 28);
	t.deepEqual(r, { _hi: 1, _lo: 0 },
	    '1000000000000000 >>> 28 = 100000000');
	r = uint64_t.shrlq(a, 32);
	t.deepEqual(r, { _hi: 0, _lo: 0x10000000 },
	    '1000000000000000 >>> 32 = 10000000');
	r = uint64_t.shrlq(a, 33);
	t.deepEqual(r, { _hi: 0, _lo: 0x8000000 },
	    '1000000000000000 >>> 33 = 8000000');

	a = new uint64_t(0x4c00, 0x80000000);
	r = uint64_t.shrlq(a, 4);
	t.deepEqual(r, { _hi: 0x4c0, _lo: 0x8000000 },
	    '4c0080000000 >>> 4 = 4c008000000');
	r = uint64_t.shrlq(a, 16);
	t.deepEqual(r, { _hi: 0, _lo: 0x4c008000 },
	    '4c0080000000 >>> 16 = 4c008000');

	a = new uint64_t(0xe7802376, 0x5ddefa11);
	r = uint64_t.shrlq(a, 30);
	t.deepEqual(r, { _hi: 3, _lo: 0x9e008dd9 },
	    'e78023765ddefa11 >>> 30 = 39e008dd9');
	r = uint64_t.shrlq(a, 31);
	t.deepEqual(r, { _hi: 1, _lo: 0xcf0046ec },
	    'e78023765ddefa11 >>> 31 = 1cf0046ec');
	r = uint64_t.shrlq(a, 36);
	t.deepEqual(r, { _hi: 0, _lo: 0xe780237 },
	    'e78023765ddefa11 >>> 36 = e780237');
	r = uint64_t.shrlq(a, 63);
	t.deepEqual(r, { _hi: 0, _lo: 1 },
	    'e78023765ddefa11 >>> 63 = 1');
	r = uint64_t.shrlq(a, 64);
	t.deepEqual(r, { _hi: 0, _lo: 0 },
	    'e78023765ddefa11 >>> 64 = 0');
	r = uint64_t.shrlq(a, 65);
	t.deepEqual(r, { _hi: 0, _lo: 0 },
	    'e78023765ddefa11 >>> 65 = 0');

	t.end();
});

test('test for nonzero', function (t) {
	var a = new uint64_t(0, 0);
	t.notOk(uint64_t.tstq(a), '0 is 0');

	a = new uint64_t(0, 1);
	t.ok(uint64_t.tstq(a), '1 is not 0');

	a = new uint64_t(1, 0);
	t.ok(uint64_t.tstq(a), '100000000 is not 0');

	a = new uint64_t(1, 1);
	t.ok(uint64_t.tstq(a), '100000001 is not 0');

	a = new uint64_t(0xef002345, 0xffcc4622);
	t.ok(uint64_t.tstq(a), 'ef002345ffcc4622 is not 0');

	t.end();
});

test('comparison', function (t) {
	var z = new uint64_t(0, 0);
	t.equal(uint64_t.cmpq(z, z), 0, '0 == 0');

	var a = new uint64_t(1, 0);
	t.equal(uint64_t.cmpq(a, z), 1, '100000000 > 0');
	t.equal(uint64_t.cmpq(z, a), -1, '0 < 100000000');

	var b = new uint64_t(0xfff00000);
	t.equal(uint64_t.cmpq(a, b), 1, '100000000 > fff00000');
	t.equal(uint64_t.cmpq(b, a), -1, 'fff00000 < 100000000');

	var a = new uint64_t(0xffffffff, 0xffffffff);
	t.equal(uint64_t.cmpq(a, z), 1, 'ffffffffffffffff > 0');
	t.equal(uint64_t.cmpq(z, a), -1, '0 < ffffffffffffffff');
	t.equal(uint64_t.cmpq(a, b), 1, 'ffffffffffffffff > fff00000');
	t.equal(uint64_t.cmpq(b, a), -1, 'fff00000 < ffffffffffffffff');

	t.equal(uint64_t.cmpq(42, 878), -1, 'explicit 42 < 878');
	t.equal(uint64_t.cmpq('9000000000', 2000000000), 1, '9e9 > 2e9');

	t.end();
});

test('toString', function (t) {
	var a = new uint64_t(0, 0);
	var s = a.toString();
	t.equal(s, '0', 'should be 0');

	a = new uint64_t(0, 0x456);
	s = a.toString();
	t.equal(s, '1110', 'should be 1110');

	a = new uint64_t(0, 0xffffffff);
	s = a.toString();
	t.equal(s, '4294967295', 'should be 4294967295');

	a = new uint64_t(1, 0);
	s = a.toString();
	t.equal(s, '4294967296', 'should be 4294967296');

	a = new uint64_t(0, 4095);
	s = a.toString();
	t.equal(s, '4095', 'should be 4095');

	a = new uint64_t(0, 6928001);
	s = a.toString();
	t.equal(s, '6928001', 'should be 6928001');

	a = new uint64_t(0x4055a, 0xc80a2941);
	s = a.toString();
	t.equal(s, '1131787368147265', 'should be 1131787368147265');

	a = new uint64_t(0xffffffff, 0xffffffff);
	s = a.toString();
	t.equal(s, '18446744073709551615', 'should be 18446744073709551615');

	t.end();
});

test('toOctets', function (t) {
	var a = new uint64_t(0, 0)
	var o = a.toOctets();
	t.deepEqual(o, [ 0 ], 'should be [ 0 ]');

	a = new uint64_t(0x44556677, 0x01020304);
	o = a.toOctets();
	t.deepEqual(o, [ 0x44, 0x55, 0x66, 0x77, 0x01, 0x02, 0x03, 0x04 ],
	    'should be [ 0x44, 0x55, 0x66, 0x77, 0x01, 0x02, 0x03, 0x04 ]');

	a = new uint64_t(0, 0x456);
	o = a.toOctets();
	t.deepEqual(o, [ 0x04, 0x56 ], 'should be [ 0x04, 0x56 ]');

	a = new uint64_t(0x456, 0);
	o = a.toOctets();
	t.deepEqual(o, [ 0x04, 0x56, 0, 0, 0, 0 ],
	    'should be [ 0x04, 0x56, 0, 0, 0, 0 ]');

	a = new uint64_t(0xfcfcfcfc, 0x80808080);
	o = a.toOctets();
	t.deepEqual(o, [ 0xfc, 0xfc, 0xfc, 0xfc, 0x80, 0x80, 0x80, 0x80 ],
	    'should be [ 0xfc, 0xfc, 0xfc, 0xfc, 0x80, 0x80, 0x80, 0x80 ]');

	t.end();
});
