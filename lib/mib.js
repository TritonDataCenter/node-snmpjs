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
MIBNode(oid, type, parent)
{
	var self = this;

	this._addr = data.canonicalizeOID(oid);
	this._oid = this._addr.join('.');
	this._children = [];
	this._parent = parent;
	this._handler = undefined;
	this._type = type || NODE_TYPES.SHELL;

	this.__defineGetter__('oid', function () { return (self._oid); });
	this.__defineGetter__('addr', function () { return (self._addr); });
	this.__defineGetter__('parent', function () { return (self._parent); });
	this.__defineGetter__('node_type',
	    function () { return (self._type); });
}

MIBNode.prototype.child = function child(idx) {
	if (typeof (idx) !== 'number')
		throw new TypeError('idx (number) is required');

	return (this._children[idx]);
};

MIBNode.prototype.addHandler = function addHandler(prov) {
	assert.equal(prov.oid, this._oid);
	assert.equal(this._children.length, 0);

	if (this.handler) {
		assert.equal(this._type, prov.type);
		this._handler = this._handler.concat(prov.handler);
	} else {
		this._type = prov.type || NODE_TYPES.SCALAR;
		if (typeof (prov.handler) === 'object' &&
		    util.isArray(prov.handler)) {
			this._handler = prov.handler;
		} else if (typeof (prov.handler) === 'function') {
			this._handler = [ prov.handler ];
		} else {
			throw new TypeError('prov.handler ' +
			    '(function or array) is required');
		}
	}

	if (this._type == NODE_TYPES.ENTRY) {
		assert.ok(prov.columns);
		prov.columns.forEach(function (c) {
			assert.ok(typeof (c) === 'number');
			if (typeof (this._handler) !== 'undefined') {
				throw new Error('shadowing of parent tree ' +
				    'forbidden');
			}
			this._children[c] = new MIBNode(this._oid + '.' + c,
			    NODE_TYPES.COLUMN, this);
			this._children[c]._handler = this._handler;
		});
	}
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
MIB()
{
	this._root = new MIBNode([], NODE_TYPES.SUBTREE, null);
}

MIB.prototype._add_one = function _add_one(prov) {
	var addr;
	var node;
	var i;

	addr = data.canonicalizeOID(prov.oid);
	prov.oid = addr.join('.');
	node = this._root;

	for (i = 0; i < addr.length; i++) {
		if (typeof (node._handler) !== 'undefined')
			throw new Error('shadowing of parent tree forbidden');

		if (!node._children.hasOwnProperty(addr[i])) {
			node._children[addr[i]] =
			    new MIBNode(addr.slice(0, i + 1),
			    NODE_TYPES.SUBTREE, node);
		} else if (node._type == NODE_TYPES.SHELL) {
			node._type = NODE_TYPES.SUBTREE;
		}
		node = node._children[addr[i]];
	}

	node.addHandler(prov);
};

MIB.prototype.add = function add(prov) {
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

MIB.prototype._lookup_node = function _lookup_node(addr) {
	var i, node;

	node = this._root;
	for (i = 0; i < addr.length; i++) {
		if (!node._children.hasOwnProperty(addr[i]))
			break;
		node = node._children[addr[i]];
	}

	return (node);
};

MIB.prototype.lookup = function lookup(oid) {
	return (this._lookup_node(data.canonicalizeOID(oid)));
};

function
_walk(node, start)
{
	var child_indices;
	var i;

	if (!node)
		return (null);

	switch (node._type) {
	case NODE_TYPES.COLUMN:
	case NODE_TYPES.SCALAR:
		return (node);

	case NODE_TYPES.SHELL:
	case NODE_TYPES.SUBTREE:
	case NODE_TYPES.ENTRY:
	default:
		child_indices = node.listChildren(start);
		for (i = 0; i < child_indices.length; i++) {
			node = _walk(node._children[child_indices[i]]);
			if (node)
				return (node);
		}
		if (!node._parent)
			return (null);

		return (_walk(node._parent,
		    node._addr[node._addr.length - 1] + 1));
	}
}

MIB.prototype.lookup_next = function lookup_next(oid, exactok) {
	var node;
	var addr = data.canonicalizeOID(oid);
	var start;

	node = this._lookup_node(addr);
	switch (node._type) {
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
			return (node);
		start = node._addr[node._addr.length - 1] + 1;
		node = node._parent;
		node = _walk(node, start);
		break;

	case NODE_TYPES.SCALAR:
		if (node._oid == oid && exactok)
			return (node);
		start = node._addr[node._addr.length - 1] + 1;
		node = node._parent;
		node = _walk(node, start);
		break;

	case NODE_TYPES.SHELL:
	case NODE_TYPES.SUBTREE:
	case NODE_TYPES.ENTRY:
	default:
		if (addr.length <= node._addr.length) {
			node = _walk(node, 0);
		} else {
			start = node._addr[node._addr.length - 1] + 1;
			node = node._parent;
			node = _walk(node, start);
		}
		break;
	}

	return (node);
};

module.exports = function _mib_init() {
	Object.keys(NODE_TYPES).forEach(function (t) {
		MIB.__defineGetter__(t,
		    function () { return (NODE_TYPES[t]); });
	});

	return (MIB);
}();
