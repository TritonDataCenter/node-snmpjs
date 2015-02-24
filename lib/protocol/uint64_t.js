/*
 * Copyright (c) 2014 Joyent, Inc.  All rights reserved.
 */

/*
 * Rudimentary 64-bit unsigned integer operations.  This is needed only for
 * one thing: formatting Counter64 values as decimal strings.  Since we wrap
 * the pair of 32-bit values in this object type, we also use toOctets() to
 * encode the value without inspecting its contents.
 *
 * The division by 10 algorithm is courtesy of the Hacker's Delight 10-17,
 * figure 10-10.  The rest is trivial and obvious.  The operations are named
 * in the same way as the amd64 instructions that do the same thing.  Two
 * things are not supported, at all, because they aren't needed by snmpjs:
 *
 * - signed numbers
 * - division, except by 10
 *
 * This is all needed only because Javascript provides only 53 bits of
 * precision in Numbers, a notorious language defect.
 */

var fmt = require('util').format;
var TEN = new uint64_t(0, 10);

function
uint64_t(hi, lo)
{
	if (typeof (hi) === 'string' && typeof (lo) === 'undefined') {
		var s = hi;
		if (hi.substr(0, 2) === '0x') {
			hi = hi.slice(2);

			if (hi.length > 16)
				throw new RangeError('hex value too large');

			lo = parseInt(hi.substr(-8, 8), 16);
			if (hi.length > 8)
				hi = parseInt(hi.substr(0, hi.length - 8), 16);
			else
				hi = 0;
		} else if (hi.substr(0, 1) === '0') {
			var i;
			hi = 0;
			lo = 0;

			for (i = 0; i < (s.length - 1) * 3; i++) {
				var p = s.length - 1 - ((i / 3) >>> 0);
				var d = parseInt(s.charAt(p), 8);

				if (i > 8)
					hi |= !!(d & (1 << (i % 3))) << (i - 8);
				else
					lo |= !!(d & (1 << (i % 3))) << i;
			}
		} else {
			var a = new uint64_t(0, 0);

			for (i = 0; i < s.length; i++) {
				a = mulq(a, 10);
				a = addq(a, new uint64_t(0,
				    parseInt(s.charAt(i), 10)));
			}

			this._hi = a._hi;
			this._lo = a._lo;
			return;
		}
	} else if (typeof (hi) === 'number' && typeof (lo) === 'undefined') {
		lo = hi;
		hi = 0;
	}

	if (hi % 1 !== 0 || lo % 1 !== 0)
		throw new TypeError('hi and lo components must be integers');

	this._hi = hi >>> 0;
	this._lo = lo >>> 0;
}

function
typecheck(a)
{
	if (typeof (a) !== 'object')
		a = new uint64_t(a);

	if (typeof (a) !== 'object' ||
	    typeof (a._hi) !== 'number' || typeof (a._lo) !== 'number')
		throw new TypeError('argument must be a uint64_t');

	return (a);
}

function
addq(a, b)
{
	var s0, s16, s32, s48;
	var a0, a16, a32, a48;
	var b0, b16, b32, b48;

	a = typecheck(a);
	b = typecheck(b);

	a0 = (a._lo & 0xffff) >>> 0;
	b0 = (b._lo & 0xffff) >>> 0;
	s0 = (a0 + b0) >>> 0;

	a16 = (a._lo & 0xffff0000) >>> 16;
	b16 = (b._lo & 0xffff0000) >>> 16;
	s16 = (a16 + b16 + ((s0 & 0x10000) ? 1 : 0)) >>> 0;

	a32 = (a._hi & 0xffff) >>> 0;
	b32 = (b._hi & 0xffff) >>> 0;
	s32 = (a32 + b32 + ((s16 & 0x10000) ? 1 : 0)) >>> 0;

	a48 = (a._hi & 0xffff0000) >>> 16;
	b48 = (b._hi & 0xffff0000) >>> 16;
	s48 = (a48 + b48 + ((s32 & 0x10000) ? 1 : 0)) >>> 0;

	return (new uint64_t(((s48 & 0xffff) << 16) | (s32 & 0xffff),
	    ((s16 & 0xffff) << 16) | (s0 & 0xffff)));
}
uint64_t.addq = addq;

function
subq(a, b)
{
	var d0, d16, d32, d48;
	var a0, a16, a32, a48;
	var b0, b16, b32, b48;

	a = typecheck(a);
	b = typecheck(b);

	a0 = (a._lo & 0xffff) >>> 0;
	b0 = (b._lo & 0xffff) >>> 0;
	a16 = (a._lo & 0xffff0000) >>> 16;
	b16 = (b._lo & 0xffff0000) >>> 16;
	a32 = (a._hi & 0xffff) >>> 0;
	b32 = (b._hi & 0xffff) >>> 0;
	a48 = (a._hi & 0xffff0000) >>> 16;
	b48 = (b._hi & 0xffff0000) >>> 16;

	if (b0 > a0) {
		a0 += 0x10000;
		if (a16 === 0) {
			a16 = 0xffff >>> 0;
			if (a32 === 0) {
				a32 = 0xffff >>> 0;
				--a48;
			} else {
				--a32;
			}
		} else {
			--a16;
		}
	}
	d0 = (a0 - b0) >>> 0;

	if (b16 > a16) {
		a16 += 0x10000;
		if (a32 === 0) {
			a32 = 0xffff >>> 0;
			--a48;
		} else {
			--a32;
		}
	}
	d16 = (a16 - b16) >>> 0;

	if (b32 > a32) {
		a32 += 0x10000;
		--a48;
	}
	d32 = (a32 - b32) >>> 0;

	d48 = (a48 - b48) >>> 0;

	return (new uint64_t(((d48 & 0xffff) << 16) | (d32 & 0xffff),
	    ((d16 & 0xffff) << 16) | (d0 & 0xffff)));
}
uint64_t.subq = subq;

function
shlq(a, c)
{
	a = typecheck(a);
	if (typeof (c) !== 'number' || c % 1 !== 0)
		throw new TypeError('count argument must be an integer');
	if (c < 0)
		throw new RangeError('count argument must be positive');

	if (c >= 64)
		return (new uint64_t(0, 0));

	if (c >= 32)
		return (new uint64_t((a._lo << (c - 32)) & 0xffffffff, 0));

	if (c === 0)
		return (new uint64_t(a._hi, a._lo));

	return (new uint64_t(((a._hi << c) & 0xffffffff) | (a._lo >>> (32 - c)),
	    (a._lo << c) & 0xffffffff));
}
uint64_t.shlq = shlq;

function
shrlq(a, c)
{
	a = typecheck(a);
	if (typeof (c) !== 'number' || c % 1 !== 0)
		throw new TypeError('count argument must be an integer');
	if (c < 0)
		throw new RangeError('count argument must be positive');

	if (c >= 64)
		return (new uint64_t(0, 0));

	if (c >= 32)
		return (new uint64_t(0, a._hi >>> (c - 32)));

	if (c === 0)
		return (new uint64_t(a._hi, a._lo));

	return (new uint64_t(a._hi >>> c,
	    (a._lo >>> c) | ((a._hi << (32 - c)) & 0xffffffff)));
}
uint64_t.shrlq = shrlq;

function
mulq(a, b)
{
	var p0, p16, p32, p48;
	var a0, a16, a32, a48;
	var b0, b16, b32, b48;
	var s;

	a = typecheck(a);
	b = typecheck(b);

	a0 = (a._lo & 0xffff) >>> 0;
	b0 = (b._lo & 0xffff) >>> 0;
	a16 = (a._lo & 0xffff0000) >>> 16;
	b16 = (b._lo & 0xffff0000) >>> 16;
	a32 = (a._hi & 0xffff) >>> 0;
	b32 = (b._hi & 0xffff) >>> 0;
	a48 = (a._hi & 0xffff0000) >>> 16;
	b48 = (b._hi & 0xffff0000) >>> 16;

	p0 = new uint64_t(0, a0 * b0);
	p16 = addq(new uint64_t(0, a0 * b16), new uint64_t(0, a16 * b0));
	p32 = addq(new uint64_t(0, a32 * b0), new uint64_t(0, a16 * b16));
	p32 = addq(p32, new uint64_t(0, a0 * b32));
	p48 = addq(new uint64_t(0, a48 * b0), new uint64_t(0, a32 * b16));
	p48 = addq(p48, new uint64_t(0, a16 * b32));
	p48 = addq(p48, new uint64_t(0, a0 * b48));

	s = addq(p0, shlq(p16, 16));
	s = addq(s, shlq(p32, 32));
	s = addq(s, shlq(p48, 48));

	return (s);
}
uint64_t.mulq = mulq;

function
tstq(a)
{
	a = typecheck(a);

	return ((a._hi !== 0) || (a._lo !== 0));
}
uint64_t.tstq = tstq;

function
cmpq(a, b)
{
	a = typecheck(a);
	b = typecheck(b);

	if (a._hi > b._hi)
		return (1);
	if (a._hi < b._hi)
		return (-1);
	if (a._lo > b._lo)
		return (1);
	if (a._lo < b._lo)
		return (-1);

	return (0);
}
uint64_t.cmpq = cmpq;

uint64_t.prototype.toString_internal = function uint64_t_toString_internal() {
	return (fmt('[%d,%d]', this._hi, this._lo));
};

uint64_t.prototype.toString = function uint64_t_toString() {
	var s = '';
	var n = this, q, r;
	var v;

	if (!tstq(n))
		return ('0');

	while (tstq(n)) {
		q = addq(shrlq(n, 1), shrlq(n, 2));
		q = addq(q, shrlq(q, 4));
		q = addq(q, shrlq(q, 8));
		q = addq(q, shrlq(q, 16));
		q = addq(q, shrlq(q, 32));
		q = shrlq(q, 3);

		r = subq(n, mulq(q, TEN));
		v = (r._lo + 6) >>> 4;
		q = addq(q, new uint64_t(0, v));
		r._lo -= v * 10;
		n = q;

		s = r._lo.toString().concat(s);
	}

	return (s);
};

uint64_t.prototype.toOctets = function uint64_t_toOctets() {
	var a = new Array();
	var v = {
		hi: this._hi,
		lo: this._lo
	};
	var len;

	if (v.hi === 0 && v.lo === 0) {
		a.push(0);
		return (a);
	}

	len = 4;
	while (v.lo !== 0 || v.hi !== 0 && len > 0) {
		a.unshift(v.lo & 0xff);
		/* JSSTYLED */
		v.lo >>>= 8;
		--len;
	}

	while (v.hi !== 0) {
		a.unshift(v.hi & 0xff);
		/* JSSTYLED */
		v.hi >>>= 8;
	}

	return (a);
};

module.exports = uint64_t;
