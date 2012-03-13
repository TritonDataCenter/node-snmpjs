/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var util = require('util');
var data = require('./protocol/data');

function
MIBNode(addr, parent)
{
	var self = this;

	if (typeof (addr) !== 'object' || !util.isArray(addr))
		throw new TypeError('addr (array) is required');

	this._addr = addr;
	this._oid = this._addr.join('.');
	this._children = [];
	this._parent = parent;
	this._decor = {};

	this.__defineGetter__('oid', function () { return (self._oid); });
	this.__defineGetter__('addr', function () { return (self._addr); });
	this.__defineGetter__('parent', function () { return (self._parent); });
}

MIBNode.prototype.child = function child(idx) {
	if (typeof (idx) !== 'number')
		throw new TypeError('idx (number) is required');

	return (this._children[idx]);
};

MIBNode.prototype.decor = function (tag) {
	return (this._decor[tag]);
};

MIBNode.prototype.decorate = function (arg) {
	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');
	if (typeof (arg.tag) !== 'string')
		throw new TypeError('arg.tag (string) is required');

	this._decor[arg.tag] = arg.obj;
};

MIBNode.prototype.listChildren = function listChildren(lowest) {
	var sorted = [];

	if (typeof (lowest) === 'undefined')
		lowest = 0;

	this._children.forEach(function (c, i) {
		if (i >= lowest)
			sorted.push(i);
	});

	sorted.sort(function (a, b) {
		return (a - b);
	});

	return (sorted);
};

function
oid_is_descended(oid, ancestor)
{
	var a_addr = data.canonicalizeOID(ancestor);
	var addr = data.canonicalizeOID(oid);
	var is_a = true;

	if (addr.length <= a_addr.length)
		return (false);

	a_addr.forEach(function (o, i) {
		if (addr[i] !== a_addr[i])
			is_a = false;
	});

	return (is_a);
}

MIBNode.prototype.isDescendant = function isDescendant(oid) {
	return (oid_is_descended(this._addr, oid));
};

MIBNode.prototype.isAncestor = function isAncestor(oid) {
	return (oid_is_descended(oid, this._addr));
};

function
MIB()
{
	this._root = new MIBNode([], null);
}

MIB.prototype.add = function add(def) {
	var addr;
	var node;
	var i;

	if (typeof (def) === 'string' ||
	    typeof (def) === 'object' && util.isArray(def))
		addr = def;
	else
		addr = def.oid;

	addr = data.canonicalizeOID(addr);
	node = this._root;

	for (i = 0; i < addr.length; i++) {
		if (!node._children.hasOwnProperty(addr[i])) {
			node._children[addr[i]] =
			    new MIBNode(addr.slice(0, i + 1), node);
		}
		node = node._children[addr[i]];
	}

	return (node);
};

MIB.prototype.lookup = function lookup(addr) {
	var i, node;

	addr = data.canonicalizeOID(addr);
	node = this._root;
	for (i = 0; i < addr.length; i++) {
		if (!node._children.hasOwnProperty(addr[i]))
			break;
		node = node._children[addr[i]];
	}

	return (node);
};

MIB.prototype.next_match = function (arg) {
	var child_indices;
	var sub;
	var i;

	if (typeof (arg) !== 'object')
		throw new TypeError('arg (object) is required');
	if (typeof (arg.node) !== 'object' || !(arg.node instanceof MIBNode))
		throw new TypeError('arg.node (object) is required');
	if (typeof (arg.match) !== 'function')
		throw new TypeError('arg.match (function) is required');
	if (typeof (arg.start) !== 'undefined' &&
	    typeof (arg.start) !== 'number')
		throw new TypeError('arg.start must be a number');

	if (arg.match(arg.node) === true)
		return (arg.node);

	child_indices = arg.node.listChildren(arg.start);
	for (i = 0; i < child_indices.length; i++) {
		sub = this.next_match({
			node: arg.node._children[child_indices[i]],
			match: arg.match
		});
		if (sub)
			return (sub);
	}
	if (!arg.node._parent)
		return (null);

	return (this.next_match({
		node: arg.node._parent,
		match: arg.match,
		start: arg.node._addr[arg.node._addr.length - 1] + 1
	}));
};

module.exports = MIB;
