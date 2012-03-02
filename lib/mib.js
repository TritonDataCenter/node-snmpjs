/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var util = require('util');
var data = require('./protocol/data');

var NODE_TYPES = {
	shell: 0,
	subtree: 1,
	scalar: 2,
	entry: 3,
	column: 4
};

function
SnmpObject(oid, type, handler)
{
	this.oid = data.canonicalizeOID(oid);
	this.children = [];

	if (typeof (handler) === 'object' && util.isArray(handler))
		this.handler = handler;
	else if (typeof (handler) === 'function')
		this.handler = [ handler ];
	else
		this.handler = undefined;
	this.type = type || NODE_TYPES.shell;
}

function
_col_bind(node, i)
{
	return (function (arg) {
		arg.column = i;
		node.handler.forEach(function (h) {
			h(arg);
		});
	});
}

SnmpObject.prototype.addHandler = function (prov) {
	var i;

	assert.equal(prov.oid, this.oid);
	assert.equal(this.children.length, 0);

	if (this.handler) {
		assert.equal(this.type, prov.type);
		this.handler = this.handler.concat(prov.handler);
	} else {
		this.type = prov.type || NODE_TYPES.scalar;
		this.handler = prov.handler;
	}

	if (this.type == NODE_TYPES.entry) {
		assert.ok(prov.columns);
		for (i in prov.columns) {
			if (!prov.columns.hasOwnProperty(i))
				continue;
			assert.ok(typeof (prov.columns[i]) === 'number');

			if (typeof (this.handler) !== 'undefined') {
				throw new Error('shadowing of parent tree ' +
				    'forbidden');
			}
			this.children[i] = new SnmpObject(this.oid + '.' + i,
			    NODE_TYPES.column, _col_bind(this, i));
		}
	}
};

function
SnmpMIB()
{
	this._root = new SnmpObject('', NODE_TYPES.subtree);
}

SnmpMIB.prototype._add_one = function _add_one(prov) {
	var addr;
	var node;
	var i;

	if (typeof (prov.oid) !== 'string')
		throw new TypeError('provider oid (string) is required');

	prov.oid = data.canonicalizeOID(prov.oid);
	addr = prov.oid.split('.');
	node = this._root;

	for (i = 0; i < addr.length; i++) {
		if (typeof (node.handler) !== 'undefined')
			throw new Error('shadowing of parent tree forbidden');

		if (!node.children.hasOwnProperty(addr[i])) {
			node.children[addr[i]] =
			    new SnmpObject(addr.slice(0, i + 1).join('.'),
			    NODE_TYPES.subtree);
		} else if (node.type == NODE_TYPES.shell) {
			node.type = NODE_TYPES.subtree;
		}
		node = node.children[addr[i]];
	}

	node.addHandler(prov);
};

SnmpMIB.prototype.add = function (prov) {
	var self = this;

	if (typeof (prov) !== 'object')
		throw new TypeError('prov (object) is required');

	if (util.isArray(prov)) {
		prov.forEach(function (p) {
			self._add_one(p);
		});
	} else {
		this._add_one(prov);
	}
};

SnmpMIB.prototype.lookup = function (oid) {
	var addr, i, node;

	if (typeof (oid) !== 'string')
		throw new TypeError('oid (string) is required');

	oid = data.canonicalizeOID(oid);
	addr = oid.split('.');

	node = this._root;
	for (i = 0; i < addr.length &&
	    node.children.hasOwnProperty(addr[i]); i++)
		node = node.children[addr[i]];

	if (node.oid == oid)
		return ({ obj: node });

	if (i == addr.length - 1 && node.type == NODE_TYPES.scalar)
		return ({ obj: node, instance: 0 });

	if (node.type == NODE_TYPES.column)
		return ({ obj: node, instance: addr.slice(i, addr.length) });

	return (null);
};

SnmpMIB.prototype.nextOID = function (oid) {
	/* XXX */
};

function
createSnmpMIB(prov)
{
	var mib = new SnmpMIB();
	if (prov)
		mib.add(prov);

	return (mib);
}

module.exports = {
	createSnmpMIB: createSnmpMIB
};
