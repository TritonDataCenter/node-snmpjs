/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

function
MIB()
{
	this._root = {
		children: {},
		owner: undefined,
		restrict: undefined
	};
}

MIB.prototype.add = function (owner, restrict)
{
	var oid, addr, i, node;

	if (typeof (owner) !== 'object')
		throw new TypeError('owner (object) is required');
	if (typeof (owner.subtree) !== 'string' ||
	    typeof (owner.callback) !== 'function')
		throw new TypeError('owner is malformed');

	oid = owner.subtree;
	if (oid.charAt(0) == '.')
		oid = oid.slice(1);

	addr = oid.split('.');

	node = this._root;
	for (i = 0; i < addr.length; i++) {
		if (typeof (node.owner) !== 'undefined')
			throw new Error('shadowing of parent tree forbidden');

		if (!node.children.hasOwnProperty(addr[i])) {
			node.children[addr[i]] = {
				children: {},
				owner: undefined,
				restrict: undefined
			};
		}
		node = node.children[addr[i]];
	}
	if (typeof (node.owner) !== 'undefined')
		throw new Error(owner.subtree + ' already registered');
	node.owner = owner;
};

MIB.prototype.restrict = function (subtree, restrict)
{
	var addr, i, node;

	if (typeof (subtree) != 'string')
		throw new TypeError('subtree (string) is required');
	if (typeof (restrict) != 'function')
		throw new TypeError('restrict (function) is required');

	if (subtree.charAt(0) == '.')
		subtree = subtree.slice(1);

	addr = subtree.split('.');

	node = this._root;
	for (i = 0; i < addr.length; i++) {
		if (!node.children.hasOwnProperty(addr[i])) {
			node.children[addr[i]] = {
				children: {},
				owner: undefined,
				restrict: undefined
			};
		}
		node = node.children[addr[i]];
	}
	if (!node.restrict)
		node.restrict = [];
	node.restrict.push(restrict);
};

MIB.prototype.lookup = function (oid)
{
	var addr, i, node;
	var restrict = [];

	if (typeof (oid) != 'string')
		throw new TypeError('oid (string) is required');

	if (oid.charAt(0) == '.')
		oid = oid.slice(1);

	addr = oid.split('.');

	node = this._root;
	for (i = 0; i < addr.length &&
	    node.children.hasOwnProperty(addr[i]); i++) {
		node = node.children[addr[i]];
		if (node.restrict)
			restrict.push(node.restrict);
	}

	if (!node.owner)
		return (null);

	return ({
		owner: node.owner,
		restrict: restrict
	});
};

module.exports = MIB;
