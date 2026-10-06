// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// Plane Query Language, syntax only. Field names, operator support, function
// arity, string escapes and duration units are checked by the Python visitor.

grammar PQL;

options {
    caseInsensitive = true;
}

query
    : expression EOF
    ;

expression
    : orExpr
    ;

orExpr
    : andExpr (OR andExpr)*
    ;

andExpr
    : notExpr (AND notExpr)*
    ;

notExpr
    : NOT notExpr
    | primary
    ;

primary
    : LPAREN expression RPAREN
    | predicate
    | customPropertyPredicate
    ;

predicate
    : fieldName comparison
    | conditionFunction
    ;

fieldName
    : IDENT
    ;

customPropertyPredicate
    : CF LBRACKET propertyReference RBRACKET comparison
    ;

propertyReference
    : STRING
    ;

conditionFunction
    : functionName callArguments
    ;

functionName
    : CHILDOF
    | DESCENDANTOF
    | CURRENTUSER
    | NOW
    ;

callArguments
    : LPAREN arguments? RPAREN
    ;

comparison
    : operator value                 # compareOperator
    | IN valueList                   # inList
    | NOT IN valueList               # notInList
    | IS NOT? NULL                   # isNull
    ;

operator
    : EQ | NEQ | GT | GTE | LT | LTE | TILDE
    ;

valueList
    : LPAREN (value (COMMA value)*)? RPAREN
    ;

arguments
    : value (COMMA value)*
    ;

value
    : STRING                         # stringValue
    | MINUS? NUMBER                  # numberValue
    | IDENT                          # identValue
    | valueFunction durationOffset*  # functionValue
    ;

valueFunction
    : functionName callArguments
    ;

durationOffset
    : sign DURATION
    ;

sign
    : PLUS | MINUS
    ;

AND: 'and';
OR: 'or';
NOT: 'not';
IN: 'in';
IS: 'is';
NULL: 'null';
CF: 'cf';
CURRENTUSER: 'currentuser';
NOW: 'now';
CHILDOF: 'childof';
DESCENDANTOF: 'descendantof';

NEQ: '!=';
GTE: '>=';
LTE: '<=';
EQ: '=';
GT: '>';
LT: '<';
TILDE: '~';
LPAREN: '(';
RPAREN: ')';
LBRACKET: '[';
RBRACKET: ']';
COMMA: ',';
PLUS: '+';
MINUS: '-';

// Any escape is accepted; the visitor reports the offset of a bad one.
STRING
    : '"' ('\\' . | ~["\\])* '"'
    | '\'' ('\\' . | ~['\\])* '\''
    ;

// Any unit is accepted; the visitor reports the offset of a bad one.
DURATION
    : [0-9]+ [a-z]+
    ;

NUMBER
    : [0-9]+ ('.' [0-9]+)?
    ;

IDENT
    : [\p{L}_] [\p{L}\p{N}_]*
    ;

WS
    : [\p{White_Space}]+ -> skip
    ;
