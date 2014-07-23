/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

/*
 * The SNMP base message format is almost completely undefined by the relevant
 * RFCs (1157, most notably, which uses the verboten "ANY").  We do, however,
 * know the following:
 *
 * 1. A message is a CONSTRUCTED SEQUENCE.  If that's not the first thing we
 * see, give up hope.  2. The first element in the sequence is an integer that
 * identifies the SNMP version.  The following values are defined:
 *
 *	0 - SNMPv1
 *	1 - SNMPv2c
 *	3 - SNMPv3
 *
 * After this, it gets spotty.  SNMPv1 (RFC 1157) and SNMPv2c (RFC 1901)
 * specify that the community string follows, then they diverge: SNMPv1 allows
 * anything to follow, while SNMPv2c requires that a PDU follow.  The intent in
 * v1 appears to have been for authentication data to precede PDU(s), but this
 * was never specified in v1 and it seems that a PDU always follows there as
 * well.  In any case, this is all we will support for now.  SNMPv3 (RFC 3412)
 * specifies that the version field is followed by another header that
 * describes, among other things, which security model is in use, followed by
 * security parameters, followed once again by anything (which is
 * "e.g., PDUs..."; thanks for the example, jackass, now how about a
 * specification?).  See also RFC 3416.
 *
 * What we're actually willing to support: v1 and v2c headers followed by a
 * PDU; i.e.,
 *
 * struct message {
 *	int version_minus_one;
 *	string community;
 *	PDU pdu;
 * }
 *
 * The standards provide for a very limited subset of types allowed in varbinds
 * within PDUs; namely, the three types specified by simple_syntax, and a
 * handful of others (all with the ASN.1 Application bit set) that are
 * enumerated explicitly.  However, it does not seem at all implausible that
 * various MIBs out there may incorporate values of other data types.  Therefore
 * we can parse any data type in a varbind that (a) has a data handler
 * registered for it, and (b) does not conflict with one of the non-Application
 * constructed types used by SNMP itself: SEQUENCE, CONTEXT_CONSTRUCTED_[0-9].
 * We do not support any of the latter because the lexer would have to support
 * both treating these as zero-length tokens (where we wish to parse the
 * contents separately, as in this parser) and as large objects to be bulk
 * decoded without interpretation by the parser (where used to instantiate data
 * objects within varbinds).  For simplicity, this is not permitted and any
 * message containing such a varbind will be unparseable.  There is only so much
 * we are willing to do to accommodate blatant standards violations.
 *
 * We can parse v3 messages but don't support them; i.e., we don't attempt to
 * construct and return protocol objects for them.
 *
 * Critical conventions to understand:
 *
 * - yytext is a Buffer.  It it not a String, because it must be able to contain
 * unprintable characters including NUL.
 *
 * - The value of any scalar data object is a descendant of SnmpData.  It is a
 * bug for this parser to interpret the value of any such object.  Instead, all
 * objects with SNMP/ASN.1 data types are constructed into SnmpData objects and
 * passed along as part of the parsed message.
 *
 * - The value of a list is always an array, and the members (if any) are always
 * of the same type as the value of the type the list contains.
 */

%token 'SEQUENCE'
%token 'INTEGER'
%token 'IP_ADDRESS'
%token 'TIME_TICKS'
%token 'NULL'
%token 'OBJECT_IDENTIFIER'
%token 'OCTET_STRING'
%token 'CONTEXT_CONSTRUCTED_0'
%token 'CONTEXT_CONSTRUCTED_1'
%token 'CONTEXT_CONSTRUCTED_2'
%token 'CONTEXT_CONSTRUCTED_3'
%token 'CONTEXT_CONSTRUCTED_4'
%token 'CONTEXT_CONSTRUCTED_5'
%token 'CONTEXT_CONSTRUCTED_6'
%token 'CONTEXT_CONSTRUCTED_7'
%token 'CONTEXT_CONSTRUCTED_8'

%start message

%%

message
	: 'SEQUENCE' integer content {{
		var msg = yy.message.createMessage({ version: $2,
		    community: $3.community, pdu: $3.pdu });
		yy.setContent(msg);
	}}
	;

content
	: string pdu {{
		$$ = {
			community: $1,
			pdu: $2
		};
	}}
	| v3_header v3_sec v3_pdu {{
		throw new RangeError('SNMPv3 is not supported yet');
	}}
	;

v3_header
	: 'SEQUENCE' integer integer string integer
	;

v3_sec
	: string
	;

v3_pdu
	: scoped_pdu
	| string
	;

scoped_pdu
	: 'SEQUENCE' string string pdu
	;

pdu
	: std_pdu_tag integer integer integer varbind_list {{
		$$ = yy.pdu.createPDU({ op: $1, request_id: $2,
		    varbinds: $5 });
		$$.error_status = $3;
		$$.error_index = $4;
	}}
	| obsolete_trap_pdu_tag oid ip_address integer integer time_ticks
	  varbind_list_v1 {{
		$$ = yy.pdu.createPDU({ op: $1, varbinds: $7 });
		$$.enterprise = $2;
		$$.agent_addr = $3;
		$$.generic_trap = $4;
		$$.specific_trap = $5;
		$$.time_stamp = $6;
	}}
	;

std_pdu_tag
	: 'CONTEXT_CONSTRUCTED_0' {{ $$ = yy.pdu.GetRequest; }}
	| 'CONTEXT_CONSTRUCTED_1' {{ $$ = yy.pdu.GetNextRequest; }}
	| 'CONTEXT_CONSTRUCTED_2' {{ $$ = yy.pdu.Response; }}
	| 'CONTEXT_CONSTRUCTED_3' {{ $$ = yy.pdu.SetRequest; }}
	| 'CONTEXT_CONSTRUCTED_5' {{ $$ = yy.pdu.GetBulkRequest; }}
	| 'CONTEXT_CONSTRUCTED_6' {{ $$ = yy.pdu.InformRequest; }}
	| 'CONTEXT_CONSTRUCTED_7' {{ $$ = yy.pdu.SNMPv2_Trap; }}
	| 'CONTEXT_CONSTRUCTED_8' {{ $$ = yy.pdu.Report; }}
	;

obsolete_trap_pdu_tag
	: 'CONTEXT_CONSTRUCTED_4' {{ $$ = yy.pdu.Trap; }}
	;

varbind_list_v1
	: 'SEQUENCE' varbinds {{
		$$ = $2;
	}}
	| 'SEQUENCE'
	|
	;

varbind_list
	: 'SEQUENCE' varbinds {{
		$$ = $2;
	}}
	|
	;

varbinds
	: varbinds varbind {{
		$$ = $1;
		$$.push($2);
	}}
	| varbind {{
		$$ = [ $1 ];
	}}
	;

varbind
	: 'SEQUENCE' oid value {{
		$$ = yy.varbind.createVarbind({ oid: $2, data: $3 });
	}}
	;

value
	: object_syntax
	| null
	;

object_syntax
	: simple_syntax
	| application_syntax
	;

simple_syntax
	: integer
	| string
	| oid
	;

application_syntax
	: ip_address
	| time_ticks
	| data
	;

integer
	: 'INTEGER' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader, type: 'Integer' });
	}}
	;

string
	: 'OCTET_STRING' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader,
		    type: 'OctetString' });
	}}
	;

oid
	: 'OBJECT_IDENTIFIER' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader,
		    type: 'ObjectIdentifier'});
	}}
	;

ip_address
	: 'IP_ADDRESS' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader,
		    type: 'IpAddress' });
	}}
	;

time_ticks
	: 'TIME_TICKS' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader,
		    type: 'TimeTicks' });
	}}
	;

null
	: 'NULL' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader, type: 'Null' });
	}}
	;

data
	: 'DATA' {{
		var reader = new yy.ASN1.Reader(yytext);
		$$ = yy.data.createData({ value: reader });
	}}
	;
