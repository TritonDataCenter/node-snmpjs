#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

#
# Tools
#
NPM		:= npm
TAP		:= ./node_modules/.bin/tap
JISON		:= ./node_modules/.bin/jison

#
# Files
#
DOC_FILES	 = \
		agent.restdown \
		index.restdown \
		mib.restdown \
		protocol.restdown \
		provider.restdown \
		snmp.restdown

JS_FILES	:= \
		snmpbulkget.js \
		snmpget.js \
		snmpset.js \
		snmptrap.js \
		snmpwalk.js \
		tl.js \
		agent.js \
		lib/agent.js \
		lib/client.js \
		lib/index.js \
		lib/lexer.js \
		lib/errors/message.js \
		lib/errors/varbind.js \
		lib/listener.js \
		lib/mib/index.js \
		lib/mib/mib-2/system.js \
		lib/mib.js \
		lib/protocol/data.js \
		lib/protocol/message.js \
		lib/protocol/pdu.js \
		lib/protocol/uint64_t.js \
		lib/protocol/varbind.js \
		lib/receiver.js \
		lib/trap_listener.js \
		lib/provider.js
		
JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -o indent=tab,doxygen,unparenthesized-return=1
SMF_MANIFESTS	 = smf/manifests/snmpd.xml

CLEAN_FILES	+= lib/parser.js

#
# Repo-specific targets
#
.PHONY: all
all: rebuild lib/parser.js

.PHONY: rebuild
rebuild:
	$(NPM) rebuild

.PHONY: test
test: $(TAP)
	TAP=1 $(TAP) test

lib/parser.js: lib/snmp.jison rebuild
	$(JISON) -o $@ $<

include ./Makefile.deps
include ./Makefile.targ
