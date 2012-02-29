/*
 * Copyright (c) 2012 Joyent, Inc.  All rights reserved.
 */

var ASN1 = require('asn1').Ber;

function
Lexer()
{
	this.reader = null;
	this.yytext = null;
	this.yyleng = 0;
	this.yylineno = 0;
	this.yylloc = 0;
}

Lexer.prototype.showPosition = function showPosition()
{
	return (this.yylloc);
};

/*
 * When we return something other than undefined:
 *
 * yytext is a Buffer containing only this token.
 * yyleng is yytext.length (for compatibility).
 * yylloc is the offset in the input buffer at which the token starts.
 */
Lexer.prototype.lex = function lex()
{
	var tag = this.reader.peek();
	var soff = this.reader.offset + 1;
	var lenlen = this.reader.readLength(soff) - soff;
	var len = this.reader.length;
	var token = undefined;
	var skip = 0;
	var token_len = 1 + lenlen + len;	/* TLV */
	var i;

	this.yylloc = this.reader.offset;
	this.yytext = undefined;
	this.yyleng = 0;

	switch (tag) {
	case ASN1.Integer:
		token = 'INTEGER';
		break;
	case ASN1.OctetString:
		token = 'OCTET_STRING';
		break;
	case ASN1.Null:
		token = 'NULL';
		break;
	case ASN1.OID:
		token = 'OBJECT_IDENTIFIER';
		break;
	case ASN1.Constructor | ASN1.Sequence:
		token = 'SEQUENCE';
		skip = 1 + lenlen;
		token_len = 0;
		break;
	case 0x40 | 0x00:
		token = 'IP_ADDRESS';
		break;
	case 0x40 | 0x03:
		token = 'TIME_TICKS';
		break;
	case ASN1.Context | ASN1.Constructor | 0x00:
	case ASN1.Context | ASN1.Constructor | 0x01:
	case ASN1.Context | ASN1.Constructor | 0x02:
	case ASN1.Context | ASN1.Constructor | 0x03:
	case ASN1.Context | ASN1.Constructor | 0x04:
	case ASN1.Context | ASN1.Constructor | 0x05:
	case ASN1.Context | ASN1.Constructor | 0x06:
	case ASN1.Context | ASN1.Constructor | 0x07:
	case ASN1.Context | ASN1.Constructor | 0x08:
		token = 'CONTEXT_CONSTRUCTED_' +
		    (tag & ~(ASN1.Context | ASN1.Constructor));
		skip = 1 + lenlen;
		token_len = 0;
		break;
	case null:
		token = null;
		break;
	default:
		token = 'DATA';
		break;
	}

	if (token_len > 0) {
		this.yytext = new Buffer(token_len);
		this.yyleng = token_len;
		this.reader.buffer.copy(this.yytext, 0, 0, token_len);
		skip = token_len;
	}

	for (i = 0; i < skip; i++)
		this.reader.readByte();

	return (token);
};

Lexer.prototype.setInput = function setInput(buffer)
{
	this.buffer = buffer;
	this.reader = new ASN1.Reader(buffer);
};

module.exports = Lexer;
