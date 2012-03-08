/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var assert = require('assert');
var util = require('util');
var data = require('./protocol/data');

var NODE_TYPES = {
	SHELL: 0,
	SUBTREE: 1,
	SCALAR: 2,
	ENTRY: 3,
	COLUMN: 4
};

function
SnmpObject(oid, type, parent, handler)
{
	this.addr = data.canonicalizeOID(oid);
	this.oid = this.addr.join('.');
	this.children = [];
	this.parent = parent;

	if (typeof (handler) === 'object' && util.isArray(handler))
		this.handler = handler;
	else if (typeof (handler) === 'function')
		this.handler = [ handler ];
	else
		this.handler = undefined;
	this.type = type || NODE_TYPES.SHELL;
}

SnmpObject.prototype.addHandler = function (prov) {
	assert.equal(prov.oid, this.oid);
	assert.equal(this.children.length, 0);

	if (this.handler) {
		assert.equal(this.type, prov.type);
		this.handler = this.handler.concat(prov.handler);
	} else {
		this.type = prov.type || NODE_TYPES.SCALAR;
		this.handler = prov.handler;
	}

	if (this.type == NODE_TYPES.ENTRY) {
		assert.ok(prov.COLUMNs);
		prov.COLUMNs.forEach(function (c) {
			assert.ok(typeof (c) === 'number');
			if (typeof (this.handler) !== 'undefined') {
				throw new Error('shadowing of parent tree ' +
				    'forbidden');
			}
			this.children[c] = new SnmpObject(this.oid + '.' + c,
			    NODE_TYPES.COLUMN, this, this.handler);
		});
	}
};

SnmpObject.prototype.listChildren = function (lowest) {
	var sorted = [];

	if (lowest === undefined)
		lowest = 0;

	this.children.forEach(function (c, i) {
		if (i >= lowest)
			sorted.push(i);
	});

	sorted.sort(function (a, b) {
		return (a - b);
	});

	return (sorted);
};

function
MIB()
{
	this._root = new SnmpObject('', NODE_TYPES.SUBTREE, null);
}

MIB.prototype._add_one = function _add_one(prov) {
	var addr;
	var node;
	var i;

	if (typeof (prov.oid) !== 'string')
		throw new TypeError('provider oid (string) is required');

	addr = data.canonicalizeOID(prov.oid);
	prov.oid = addr.join('.');
	node = this._root;

	for (i = 0; i < addr.length; i++) {
		if (typeof (node.handler) !== 'undefined')
			throw new Error('shadowing of parent tree forbidden');

		if (!node.children.hasOwnProperty(addr[i])) {
			node.children[addr[i]] =
			    new SnmpObject(addr.slice(0, i + 1).join('.'),
			    NODE_TYPES.SUBTREE, node);
		} else if (node.type == NODE_TYPES.SHELL) {
			node.type = NODE_TYPES.SUBTREE;
		}
		node = node.children[addr[i]];
	}

	node.addHandler(prov);
};

MIB.prototype.add = function (prov) {
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

MIB.prototype._lookup_node = function (addr) {
	var i, node;

	if (typeof (addr) !== 'object' || !util.isArray(addr))
		throw new TypeError('oid (string) is required');

	node = this._root;
	for (i = 0; i < addr.length; i++) {
		if (!node.children.hasOwnProperty(addr[i]))
			break;
		node = node.children[addr[i]];
	}

	return (node);
};

MIB.prototype.lookup = function (oid) {
	var addr, node;
	var loc = {};

	if (typeof (oid) === 'object' && util.isArray(oid)) {
		addr = oid;
		oid = addr.join('.');
	} else if (typeof (oid) === 'string') {
		addr = data.canonicalizeOID(oid);
		oid = addr.join('.');
	} else {
		throw new TypeError('oid (string) is required');
	}

	node = this._lookup_node(addr);

	loc.addr = addr;
	loc.oid = oid;

	if (node.oid == oid) {
		loc.objaddr = node.addr;
		loc.objoid = node.oid;
		loc.objtype = node.type;
		loc.handler = node.handler;
	}

	if (node.addr.length == addr.length - 1 &&
	    addr[addr.length - 1] === 0 &&
	    node.type == NODE_TYPES.SCALAR) {
		loc.objaddr = node.addr;
		loc.objoid = node.oid;
		loc.objtype = node.type;
		loc.handler = node.handler;
		loc.instaddr = [ 0 ];
	}

	if (node.type == NODE_TYPES.COLUMN) {
		loc.objaddr = node.addr;
		loc.objoid = node.oid;
		loc.objtype = node.type;
		loc.handler = node.handler;
		loc.instaddr = addr.slice(node.addr.length, addr.length);
	}

	return (loc);
};

function
_walk(node, start)
{
	var child_indices;
	var i;

	if (!node)
		return (null);

	switch (node.type) {
	case NODE_TYPES.COLUMN:
	case NODE_TYPES.SCALAR:
		return (node);

	case NODE_TYPES.SHELL:
	case NODE_TYPES.SUBTREE:
	case NODE_TYPES.ENTRY:
	default:
		child_indices = node.listChildren(start);
		for (i = 0; i < child_indices.length; i++) {
			node = _walk(node.children[child_indices[i]]);
			if (node)
				return (node);
		}
		if (!node.parent)
			return (null);

		return (_walk(node.parent,
		    node.addr[node.addr.length - 1] + 1));
	}
}

MIB.prototype.lookup_next = function (oid, exactok) {
	var node;
	var addr = data.canonicalizeOID(oid);
	var start;

	node = this._lookup_node(addr);
	switch (node.type) {
	/*
	 * We were asked for the next entry following a column OID,
	 * which will be the value from the first row.  If exactok has
	 * been passed in, this OID came from a manager and we should
	 * pass it along to the relevant MIB provider to figure out
	 * which is the first row.  Otherwise, that's been done already
	 * and we need to move on (below).
	 *
	 * Likewise, if we're passed in a scalar object, the next MIB
	 * node is the single instance.  If the handler has for some
	 * reason failed this already, exactok will be clear and we need
	 * to move on; otherwise, we can return this as-is and the
	 * provider will know we really mean the instance.
	 */
	case NODE_TYPES.COLUMN:
		if (exactok)
			return (this.lookup(oid));
		start = node.addr[node.addr.length - 1] + 1;
		node = node.parent;
		node = _walk(node, start);
		break;

	case NODE_TYPES.SCALAR:
		if (node.oid == oid && exactok)
			return (this.lookup(oid));
		start = node.addr[node.addr.length - 1] + 1;
		node = node.parent;
		node = _walk(node, start);
		break;

	case NODE_TYPES.SHELL:
	case NODE_TYPES.SUBTREE:
	case NODE_TYPES.ENTRY:
	default:
		if (addr.length <= node.addr.length) {
			node = _walk(node, 0);
		} else {
			start = node.addr[node.addr.length - 1] + 1;
			node = node.parent;
			node = _walk(node, start);
		}
		break;
	}

	if (node)
		return (this.lookup(node.oid));

	return ({ addr: addr, oid: oid });
};

module.exports = function () {
	Object.keys(NODE_TYPES).forEach(function (t) {
		MIB.__defineGetter__(t,
		    function () { return (NODE_TYPES[t]); });
	});

	return (MIB);
}();
