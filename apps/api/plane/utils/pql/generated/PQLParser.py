# encoding: utf-8
from antlr4 import *
from io import StringIO
import sys
if sys.version_info[1] > 5:
	from typing import TextIO
else:
	from typing.io import TextIO

def serializedATN():
    return [
        4,1,30,165,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,1,0,1,0,1,0,1,1,1,1,1,2,1,2,1,2,5,2,51,8,2,10,2,12,2,54,9,2,
        1,3,1,3,1,3,5,3,59,8,3,10,3,12,3,62,9,3,1,4,1,4,1,4,3,4,67,8,4,1,
        5,1,5,1,5,1,5,1,5,1,5,3,5,75,8,5,1,6,1,6,1,6,1,6,3,6,81,8,6,1,7,
        1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,9,1,9,1,10,1,10,1,10,1,11,1,11,1,12,
        1,12,3,12,100,8,12,1,12,1,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,
        1,13,1,13,1,13,3,13,114,8,13,1,13,3,13,117,8,13,1,14,1,14,1,15,1,
        15,1,15,1,15,5,15,125,8,15,10,15,12,15,128,9,15,3,15,130,8,15,1,
        15,1,15,1,16,1,16,1,16,5,16,137,8,16,10,16,12,16,140,9,16,1,17,1,
        17,3,17,144,8,17,1,17,1,17,1,17,1,17,5,17,150,8,17,10,17,12,17,153,
        9,17,3,17,155,8,17,1,18,1,18,1,18,1,19,1,19,1,19,1,20,1,20,1,20,
        0,0,21,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,
        0,3,1,0,8,11,1,0,12,18,1,0,24,25,162,0,42,1,0,0,0,2,45,1,0,0,0,4,
        47,1,0,0,0,6,55,1,0,0,0,8,66,1,0,0,0,10,74,1,0,0,0,12,80,1,0,0,0,
        14,82,1,0,0,0,16,84,1,0,0,0,18,90,1,0,0,0,20,92,1,0,0,0,22,95,1,
        0,0,0,24,97,1,0,0,0,26,116,1,0,0,0,28,118,1,0,0,0,30,120,1,0,0,0,
        32,133,1,0,0,0,34,154,1,0,0,0,36,156,1,0,0,0,38,159,1,0,0,0,40,162,
        1,0,0,0,42,43,3,2,1,0,43,44,5,0,0,1,44,1,1,0,0,0,45,46,3,4,2,0,46,
        3,1,0,0,0,47,52,3,6,3,0,48,49,5,2,0,0,49,51,3,6,3,0,50,48,1,0,0,
        0,51,54,1,0,0,0,52,50,1,0,0,0,52,53,1,0,0,0,53,5,1,0,0,0,54,52,1,
        0,0,0,55,60,3,8,4,0,56,57,5,1,0,0,57,59,3,8,4,0,58,56,1,0,0,0,59,
        62,1,0,0,0,60,58,1,0,0,0,60,61,1,0,0,0,61,7,1,0,0,0,62,60,1,0,0,
        0,63,64,5,3,0,0,64,67,3,8,4,0,65,67,3,10,5,0,66,63,1,0,0,0,66,65,
        1,0,0,0,67,9,1,0,0,0,68,69,5,19,0,0,69,70,3,2,1,0,70,71,5,20,0,0,
        71,75,1,0,0,0,72,75,3,12,6,0,73,75,3,16,8,0,74,68,1,0,0,0,74,72,
        1,0,0,0,74,73,1,0,0,0,75,11,1,0,0,0,76,77,3,14,7,0,77,78,3,26,13,
        0,78,81,1,0,0,0,79,81,3,20,10,0,80,76,1,0,0,0,80,79,1,0,0,0,81,13,
        1,0,0,0,82,83,5,29,0,0,83,15,1,0,0,0,84,85,5,7,0,0,85,86,5,21,0,
        0,86,87,3,18,9,0,87,88,5,22,0,0,88,89,3,26,13,0,89,17,1,0,0,0,90,
        91,5,26,0,0,91,19,1,0,0,0,92,93,3,22,11,0,93,94,3,24,12,0,94,21,
        1,0,0,0,95,96,7,0,0,0,96,23,1,0,0,0,97,99,5,19,0,0,98,100,3,32,16,
        0,99,98,1,0,0,0,99,100,1,0,0,0,100,101,1,0,0,0,101,102,5,20,0,0,
        102,25,1,0,0,0,103,104,3,28,14,0,104,105,3,34,17,0,105,117,1,0,0,
        0,106,107,5,4,0,0,107,117,3,30,15,0,108,109,5,3,0,0,109,110,5,4,
        0,0,110,117,3,30,15,0,111,113,5,5,0,0,112,114,5,3,0,0,113,112,1,
        0,0,0,113,114,1,0,0,0,114,115,1,0,0,0,115,117,5,6,0,0,116,103,1,
        0,0,0,116,106,1,0,0,0,116,108,1,0,0,0,116,111,1,0,0,0,117,27,1,0,
        0,0,118,119,7,1,0,0,119,29,1,0,0,0,120,129,5,19,0,0,121,126,3,34,
        17,0,122,123,5,23,0,0,123,125,3,34,17,0,124,122,1,0,0,0,125,128,
        1,0,0,0,126,124,1,0,0,0,126,127,1,0,0,0,127,130,1,0,0,0,128,126,
        1,0,0,0,129,121,1,0,0,0,129,130,1,0,0,0,130,131,1,0,0,0,131,132,
        5,20,0,0,132,31,1,0,0,0,133,138,3,34,17,0,134,135,5,23,0,0,135,137,
        3,34,17,0,136,134,1,0,0,0,137,140,1,0,0,0,138,136,1,0,0,0,138,139,
        1,0,0,0,139,33,1,0,0,0,140,138,1,0,0,0,141,155,5,26,0,0,142,144,
        5,25,0,0,143,142,1,0,0,0,143,144,1,0,0,0,144,145,1,0,0,0,145,155,
        5,28,0,0,146,155,5,29,0,0,147,151,3,36,18,0,148,150,3,38,19,0,149,
        148,1,0,0,0,150,153,1,0,0,0,151,149,1,0,0,0,151,152,1,0,0,0,152,
        155,1,0,0,0,153,151,1,0,0,0,154,141,1,0,0,0,154,143,1,0,0,0,154,
        146,1,0,0,0,154,147,1,0,0,0,155,35,1,0,0,0,156,157,3,22,11,0,157,
        158,3,24,12,0,158,37,1,0,0,0,159,160,3,40,20,0,160,161,5,27,0,0,
        161,39,1,0,0,0,162,163,7,2,0,0,163,41,1,0,0,0,14,52,60,66,74,80,
        99,113,116,126,129,138,143,151,154
    ]

class PQLParser ( Parser ):

    grammarFileName = "PQL.g4"

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [ DFA(ds, i) for i, ds in enumerate(atn.decisionToState) ]

    sharedContextCache = PredictionContextCache()

    literalNames = [ "<INVALID>", "'and'", "'or'", "'not'", "'in'", "'is'", 
                     "'null'", "'cf'", "'currentuser'", "'now'", "'childof'", 
                     "'descendantof'", "'!='", "'>='", "'<='", "'='", "'>'", 
                     "'<'", "'~'", "'('", "')'", "'['", "']'", "','", "'+'", 
                     "'-'" ]

    symbolicNames = [ "<INVALID>", "AND", "OR", "NOT", "IN", "IS", "NULL", 
                      "CF", "CURRENTUSER", "NOW", "CHILDOF", "DESCENDANTOF", 
                      "NEQ", "GTE", "LTE", "EQ", "GT", "LT", "TILDE", "LPAREN", 
                      "RPAREN", "LBRACKET", "RBRACKET", "COMMA", "PLUS", 
                      "MINUS", "STRING", "DURATION", "NUMBER", "IDENT", 
                      "WS" ]

    RULE_query = 0
    RULE_expression = 1
    RULE_orExpr = 2
    RULE_andExpr = 3
    RULE_notExpr = 4
    RULE_primary = 5
    RULE_predicate = 6
    RULE_fieldName = 7
    RULE_customPropertyPredicate = 8
    RULE_propertyReference = 9
    RULE_conditionFunction = 10
    RULE_functionName = 11
    RULE_callArguments = 12
    RULE_comparison = 13
    RULE_operator = 14
    RULE_valueList = 15
    RULE_arguments = 16
    RULE_value = 17
    RULE_valueFunction = 18
    RULE_durationOffset = 19
    RULE_sign = 20

    ruleNames =  [ "query", "expression", "orExpr", "andExpr", "notExpr", 
                   "primary", "predicate", "fieldName", "customPropertyPredicate", 
                   "propertyReference", "conditionFunction", "functionName", 
                   "callArguments", "comparison", "operator", "valueList", 
                   "arguments", "value", "valueFunction", "durationOffset", 
                   "sign" ]

    EOF = Token.EOF
    AND=1
    OR=2
    NOT=3
    IN=4
    IS=5
    NULL=6
    CF=7
    CURRENTUSER=8
    NOW=9
    CHILDOF=10
    DESCENDANTOF=11
    NEQ=12
    GTE=13
    LTE=14
    EQ=15
    GT=16
    LT=17
    TILDE=18
    LPAREN=19
    RPAREN=20
    LBRACKET=21
    RBRACKET=22
    COMMA=23
    PLUS=24
    MINUS=25
    STRING=26
    DURATION=27
    NUMBER=28
    IDENT=29
    WS=30

    def __init__(self, input:TokenStream, output:TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.13.2")
        self._interp = ParserATNSimulator(self, self.atn, self.decisionsToDFA, self.sharedContextCache)
        self._predicates = None




    class QueryContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def expression(self):
            return self.getTypedRuleContext(PQLParser.ExpressionContext,0)


        def EOF(self):
            return self.getToken(PQLParser.EOF, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_query

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterQuery" ):
                listener.enterQuery(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitQuery" ):
                listener.exitQuery(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitQuery" ):
                return visitor.visitQuery(self)
            else:
                return visitor.visitChildren(self)




    def query(self):

        localctx = PQLParser.QueryContext(self, self._ctx, self.state)
        self.enterRule(localctx, 0, self.RULE_query)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 42
            self.expression()
            self.state = 43
            self.match(PQLParser.EOF)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ExpressionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def orExpr(self):
            return self.getTypedRuleContext(PQLParser.OrExprContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_expression

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterExpression" ):
                listener.enterExpression(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitExpression" ):
                listener.exitExpression(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitExpression" ):
                return visitor.visitExpression(self)
            else:
                return visitor.visitChildren(self)




    def expression(self):

        localctx = PQLParser.ExpressionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 2, self.RULE_expression)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 45
            self.orExpr()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class OrExprContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def andExpr(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PQLParser.AndExprContext)
            else:
                return self.getTypedRuleContext(PQLParser.AndExprContext,i)


        def OR(self, i:int=None):
            if i is None:
                return self.getTokens(PQLParser.OR)
            else:
                return self.getToken(PQLParser.OR, i)

        def getRuleIndex(self):
            return PQLParser.RULE_orExpr

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterOrExpr" ):
                listener.enterOrExpr(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitOrExpr" ):
                listener.exitOrExpr(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitOrExpr" ):
                return visitor.visitOrExpr(self)
            else:
                return visitor.visitChildren(self)




    def orExpr(self):

        localctx = PQLParser.OrExprContext(self, self._ctx, self.state)
        self.enterRule(localctx, 4, self.RULE_orExpr)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 47
            self.andExpr()
            self.state = 52
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==2:
                self.state = 48
                self.match(PQLParser.OR)
                self.state = 49
                self.andExpr()
                self.state = 54
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class AndExprContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def notExpr(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PQLParser.NotExprContext)
            else:
                return self.getTypedRuleContext(PQLParser.NotExprContext,i)


        def AND(self, i:int=None):
            if i is None:
                return self.getTokens(PQLParser.AND)
            else:
                return self.getToken(PQLParser.AND, i)

        def getRuleIndex(self):
            return PQLParser.RULE_andExpr

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterAndExpr" ):
                listener.enterAndExpr(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitAndExpr" ):
                listener.exitAndExpr(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitAndExpr" ):
                return visitor.visitAndExpr(self)
            else:
                return visitor.visitChildren(self)




    def andExpr(self):

        localctx = PQLParser.AndExprContext(self, self._ctx, self.state)
        self.enterRule(localctx, 6, self.RULE_andExpr)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 55
            self.notExpr()
            self.state = 60
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==1:
                self.state = 56
                self.match(PQLParser.AND)
                self.state = 57
                self.notExpr()
                self.state = 62
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class NotExprContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def NOT(self):
            return self.getToken(PQLParser.NOT, 0)

        def notExpr(self):
            return self.getTypedRuleContext(PQLParser.NotExprContext,0)


        def primary(self):
            return self.getTypedRuleContext(PQLParser.PrimaryContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_notExpr

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterNotExpr" ):
                listener.enterNotExpr(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitNotExpr" ):
                listener.exitNotExpr(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitNotExpr" ):
                return visitor.visitNotExpr(self)
            else:
                return visitor.visitChildren(self)




    def notExpr(self):

        localctx = PQLParser.NotExprContext(self, self._ctx, self.state)
        self.enterRule(localctx, 8, self.RULE_notExpr)
        try:
            self.state = 66
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [3]:
                self.enterOuterAlt(localctx, 1)
                self.state = 63
                self.match(PQLParser.NOT)
                self.state = 64
                self.notExpr()
                pass
            elif token in [7, 8, 9, 10, 11, 19, 29]:
                self.enterOuterAlt(localctx, 2)
                self.state = 65
                self.primary()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PrimaryContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def LPAREN(self):
            return self.getToken(PQLParser.LPAREN, 0)

        def expression(self):
            return self.getTypedRuleContext(PQLParser.ExpressionContext,0)


        def RPAREN(self):
            return self.getToken(PQLParser.RPAREN, 0)

        def predicate(self):
            return self.getTypedRuleContext(PQLParser.PredicateContext,0)


        def customPropertyPredicate(self):
            return self.getTypedRuleContext(PQLParser.CustomPropertyPredicateContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_primary

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPrimary" ):
                listener.enterPrimary(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPrimary" ):
                listener.exitPrimary(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitPrimary" ):
                return visitor.visitPrimary(self)
            else:
                return visitor.visitChildren(self)




    def primary(self):

        localctx = PQLParser.PrimaryContext(self, self._ctx, self.state)
        self.enterRule(localctx, 10, self.RULE_primary)
        try:
            self.state = 74
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [19]:
                self.enterOuterAlt(localctx, 1)
                self.state = 68
                self.match(PQLParser.LPAREN)
                self.state = 69
                self.expression()
                self.state = 70
                self.match(PQLParser.RPAREN)
                pass
            elif token in [8, 9, 10, 11, 29]:
                self.enterOuterAlt(localctx, 2)
                self.state = 72
                self.predicate()
                pass
            elif token in [7]:
                self.enterOuterAlt(localctx, 3)
                self.state = 73
                self.customPropertyPredicate()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PredicateContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def fieldName(self):
            return self.getTypedRuleContext(PQLParser.FieldNameContext,0)


        def comparison(self):
            return self.getTypedRuleContext(PQLParser.ComparisonContext,0)


        def conditionFunction(self):
            return self.getTypedRuleContext(PQLParser.ConditionFunctionContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_predicate

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPredicate" ):
                listener.enterPredicate(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPredicate" ):
                listener.exitPredicate(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitPredicate" ):
                return visitor.visitPredicate(self)
            else:
                return visitor.visitChildren(self)




    def predicate(self):

        localctx = PQLParser.PredicateContext(self, self._ctx, self.state)
        self.enterRule(localctx, 12, self.RULE_predicate)
        try:
            self.state = 80
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [29]:
                self.enterOuterAlt(localctx, 1)
                self.state = 76
                self.fieldName()
                self.state = 77
                self.comparison()
                pass
            elif token in [8, 9, 10, 11]:
                self.enterOuterAlt(localctx, 2)
                self.state = 79
                self.conditionFunction()
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class FieldNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def IDENT(self):
            return self.getToken(PQLParser.IDENT, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_fieldName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterFieldName" ):
                listener.enterFieldName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitFieldName" ):
                listener.exitFieldName(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitFieldName" ):
                return visitor.visitFieldName(self)
            else:
                return visitor.visitChildren(self)




    def fieldName(self):

        localctx = PQLParser.FieldNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 14, self.RULE_fieldName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 82
            self.match(PQLParser.IDENT)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CustomPropertyPredicateContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CF(self):
            return self.getToken(PQLParser.CF, 0)

        def LBRACKET(self):
            return self.getToken(PQLParser.LBRACKET, 0)

        def propertyReference(self):
            return self.getTypedRuleContext(PQLParser.PropertyReferenceContext,0)


        def RBRACKET(self):
            return self.getToken(PQLParser.RBRACKET, 0)

        def comparison(self):
            return self.getTypedRuleContext(PQLParser.ComparisonContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_customPropertyPredicate

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCustomPropertyPredicate" ):
                listener.enterCustomPropertyPredicate(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCustomPropertyPredicate" ):
                listener.exitCustomPropertyPredicate(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitCustomPropertyPredicate" ):
                return visitor.visitCustomPropertyPredicate(self)
            else:
                return visitor.visitChildren(self)




    def customPropertyPredicate(self):

        localctx = PQLParser.CustomPropertyPredicateContext(self, self._ctx, self.state)
        self.enterRule(localctx, 16, self.RULE_customPropertyPredicate)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 84
            self.match(PQLParser.CF)
            self.state = 85
            self.match(PQLParser.LBRACKET)
            self.state = 86
            self.propertyReference()
            self.state = 87
            self.match(PQLParser.RBRACKET)
            self.state = 88
            self.comparison()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PropertyReferenceContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def STRING(self):
            return self.getToken(PQLParser.STRING, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_propertyReference

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPropertyReference" ):
                listener.enterPropertyReference(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPropertyReference" ):
                listener.exitPropertyReference(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitPropertyReference" ):
                return visitor.visitPropertyReference(self)
            else:
                return visitor.visitChildren(self)




    def propertyReference(self):

        localctx = PQLParser.PropertyReferenceContext(self, self._ctx, self.state)
        self.enterRule(localctx, 18, self.RULE_propertyReference)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 90
            self.match(PQLParser.STRING)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ConditionFunctionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def functionName(self):
            return self.getTypedRuleContext(PQLParser.FunctionNameContext,0)


        def callArguments(self):
            return self.getTypedRuleContext(PQLParser.CallArgumentsContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_conditionFunction

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterConditionFunction" ):
                listener.enterConditionFunction(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitConditionFunction" ):
                listener.exitConditionFunction(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitConditionFunction" ):
                return visitor.visitConditionFunction(self)
            else:
                return visitor.visitChildren(self)




    def conditionFunction(self):

        localctx = PQLParser.ConditionFunctionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 20, self.RULE_conditionFunction)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 92
            self.functionName()
            self.state = 93
            self.callArguments()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class FunctionNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def CHILDOF(self):
            return self.getToken(PQLParser.CHILDOF, 0)

        def DESCENDANTOF(self):
            return self.getToken(PQLParser.DESCENDANTOF, 0)

        def CURRENTUSER(self):
            return self.getToken(PQLParser.CURRENTUSER, 0)

        def NOW(self):
            return self.getToken(PQLParser.NOW, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_functionName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterFunctionName" ):
                listener.enterFunctionName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitFunctionName" ):
                listener.exitFunctionName(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitFunctionName" ):
                return visitor.visitFunctionName(self)
            else:
                return visitor.visitChildren(self)




    def functionName(self):

        localctx = PQLParser.FunctionNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 22, self.RULE_functionName)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 95
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & 3840) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CallArgumentsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def LPAREN(self):
            return self.getToken(PQLParser.LPAREN, 0)

        def RPAREN(self):
            return self.getToken(PQLParser.RPAREN, 0)

        def arguments(self):
            return self.getTypedRuleContext(PQLParser.ArgumentsContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_callArguments

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCallArguments" ):
                listener.enterCallArguments(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCallArguments" ):
                listener.exitCallArguments(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitCallArguments" ):
                return visitor.visitCallArguments(self)
            else:
                return visitor.visitChildren(self)




    def callArguments(self):

        localctx = PQLParser.CallArgumentsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 24, self.RULE_callArguments)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 97
            self.match(PQLParser.LPAREN)
            self.state = 99
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if (((_la) & ~0x3f) == 0 and ((1 << _la) & 905973504) != 0):
                self.state = 98
                self.arguments()


            self.state = 101
            self.match(PQLParser.RPAREN)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ComparisonContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser


        def getRuleIndex(self):
            return PQLParser.RULE_comparison

     
        def copyFrom(self, ctx:ParserRuleContext):
            super().copyFrom(ctx)



    class CompareOperatorContext(ComparisonContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ComparisonContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def operator(self):
            return self.getTypedRuleContext(PQLParser.OperatorContext,0)

        def value(self):
            return self.getTypedRuleContext(PQLParser.ValueContext,0)


        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCompareOperator" ):
                listener.enterCompareOperator(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCompareOperator" ):
                listener.exitCompareOperator(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitCompareOperator" ):
                return visitor.visitCompareOperator(self)
            else:
                return visitor.visitChildren(self)


    class InListContext(ComparisonContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ComparisonContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def IN(self):
            return self.getToken(PQLParser.IN, 0)
        def valueList(self):
            return self.getTypedRuleContext(PQLParser.ValueListContext,0)


        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterInList" ):
                listener.enterInList(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitInList" ):
                listener.exitInList(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitInList" ):
                return visitor.visitInList(self)
            else:
                return visitor.visitChildren(self)


    class NotInListContext(ComparisonContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ComparisonContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def NOT(self):
            return self.getToken(PQLParser.NOT, 0)
        def IN(self):
            return self.getToken(PQLParser.IN, 0)
        def valueList(self):
            return self.getTypedRuleContext(PQLParser.ValueListContext,0)


        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterNotInList" ):
                listener.enterNotInList(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitNotInList" ):
                listener.exitNotInList(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitNotInList" ):
                return visitor.visitNotInList(self)
            else:
                return visitor.visitChildren(self)


    class IsNullContext(ComparisonContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ComparisonContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def IS(self):
            return self.getToken(PQLParser.IS, 0)
        def NULL(self):
            return self.getToken(PQLParser.NULL, 0)
        def NOT(self):
            return self.getToken(PQLParser.NOT, 0)

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterIsNull" ):
                listener.enterIsNull(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitIsNull" ):
                listener.exitIsNull(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitIsNull" ):
                return visitor.visitIsNull(self)
            else:
                return visitor.visitChildren(self)



    def comparison(self):

        localctx = PQLParser.ComparisonContext(self, self._ctx, self.state)
        self.enterRule(localctx, 26, self.RULE_comparison)
        self._la = 0 # Token type
        try:
            self.state = 116
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [12, 13, 14, 15, 16, 17, 18]:
                localctx = PQLParser.CompareOperatorContext(self, localctx)
                self.enterOuterAlt(localctx, 1)
                self.state = 103
                self.operator()
                self.state = 104
                self.value()
                pass
            elif token in [4]:
                localctx = PQLParser.InListContext(self, localctx)
                self.enterOuterAlt(localctx, 2)
                self.state = 106
                self.match(PQLParser.IN)
                self.state = 107
                self.valueList()
                pass
            elif token in [3]:
                localctx = PQLParser.NotInListContext(self, localctx)
                self.enterOuterAlt(localctx, 3)
                self.state = 108
                self.match(PQLParser.NOT)
                self.state = 109
                self.match(PQLParser.IN)
                self.state = 110
                self.valueList()
                pass
            elif token in [5]:
                localctx = PQLParser.IsNullContext(self, localctx)
                self.enterOuterAlt(localctx, 4)
                self.state = 111
                self.match(PQLParser.IS)
                self.state = 113
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==3:
                    self.state = 112
                    self.match(PQLParser.NOT)


                self.state = 115
                self.match(PQLParser.NULL)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class OperatorContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def EQ(self):
            return self.getToken(PQLParser.EQ, 0)

        def NEQ(self):
            return self.getToken(PQLParser.NEQ, 0)

        def GT(self):
            return self.getToken(PQLParser.GT, 0)

        def GTE(self):
            return self.getToken(PQLParser.GTE, 0)

        def LT(self):
            return self.getToken(PQLParser.LT, 0)

        def LTE(self):
            return self.getToken(PQLParser.LTE, 0)

        def TILDE(self):
            return self.getToken(PQLParser.TILDE, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_operator

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterOperator" ):
                listener.enterOperator(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitOperator" ):
                listener.exitOperator(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitOperator" ):
                return visitor.visitOperator(self)
            else:
                return visitor.visitChildren(self)




    def operator(self):

        localctx = PQLParser.OperatorContext(self, self._ctx, self.state)
        self.enterRule(localctx, 28, self.RULE_operator)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 118
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & 520192) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ValueListContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def LPAREN(self):
            return self.getToken(PQLParser.LPAREN, 0)

        def RPAREN(self):
            return self.getToken(PQLParser.RPAREN, 0)

        def value(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PQLParser.ValueContext)
            else:
                return self.getTypedRuleContext(PQLParser.ValueContext,i)


        def COMMA(self, i:int=None):
            if i is None:
                return self.getTokens(PQLParser.COMMA)
            else:
                return self.getToken(PQLParser.COMMA, i)

        def getRuleIndex(self):
            return PQLParser.RULE_valueList

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterValueList" ):
                listener.enterValueList(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitValueList" ):
                listener.exitValueList(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitValueList" ):
                return visitor.visitValueList(self)
            else:
                return visitor.visitChildren(self)




    def valueList(self):

        localctx = PQLParser.ValueListContext(self, self._ctx, self.state)
        self.enterRule(localctx, 30, self.RULE_valueList)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 120
            self.match(PQLParser.LPAREN)
            self.state = 129
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if (((_la) & ~0x3f) == 0 and ((1 << _la) & 905973504) != 0):
                self.state = 121
                self.value()
                self.state = 126
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==23:
                    self.state = 122
                    self.match(PQLParser.COMMA)
                    self.state = 123
                    self.value()
                    self.state = 128
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)



            self.state = 131
            self.match(PQLParser.RPAREN)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ArgumentsContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def value(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PQLParser.ValueContext)
            else:
                return self.getTypedRuleContext(PQLParser.ValueContext,i)


        def COMMA(self, i:int=None):
            if i is None:
                return self.getTokens(PQLParser.COMMA)
            else:
                return self.getToken(PQLParser.COMMA, i)

        def getRuleIndex(self):
            return PQLParser.RULE_arguments

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterArguments" ):
                listener.enterArguments(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitArguments" ):
                listener.exitArguments(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitArguments" ):
                return visitor.visitArguments(self)
            else:
                return visitor.visitChildren(self)




    def arguments(self):

        localctx = PQLParser.ArgumentsContext(self, self._ctx, self.state)
        self.enterRule(localctx, 32, self.RULE_arguments)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 133
            self.value()
            self.state = 138
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==23:
                self.state = 134
                self.match(PQLParser.COMMA)
                self.state = 135
                self.value()
                self.state = 140
                self._errHandler.sync(self)
                _la = self._input.LA(1)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser


        def getRuleIndex(self):
            return PQLParser.RULE_value

     
        def copyFrom(self, ctx:ParserRuleContext):
            super().copyFrom(ctx)



    class StringValueContext(ValueContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ValueContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def STRING(self):
            return self.getToken(PQLParser.STRING, 0)

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterStringValue" ):
                listener.enterStringValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitStringValue" ):
                listener.exitStringValue(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitStringValue" ):
                return visitor.visitStringValue(self)
            else:
                return visitor.visitChildren(self)


    class NumberValueContext(ValueContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ValueContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def NUMBER(self):
            return self.getToken(PQLParser.NUMBER, 0)
        def MINUS(self):
            return self.getToken(PQLParser.MINUS, 0)

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterNumberValue" ):
                listener.enterNumberValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitNumberValue" ):
                listener.exitNumberValue(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitNumberValue" ):
                return visitor.visitNumberValue(self)
            else:
                return visitor.visitChildren(self)


    class IdentValueContext(ValueContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ValueContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def IDENT(self):
            return self.getToken(PQLParser.IDENT, 0)

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterIdentValue" ):
                listener.enterIdentValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitIdentValue" ):
                listener.exitIdentValue(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitIdentValue" ):
                return visitor.visitIdentValue(self)
            else:
                return visitor.visitChildren(self)


    class FunctionValueContext(ValueContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a PQLParser.ValueContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def valueFunction(self):
            return self.getTypedRuleContext(PQLParser.ValueFunctionContext,0)

        def durationOffset(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(PQLParser.DurationOffsetContext)
            else:
                return self.getTypedRuleContext(PQLParser.DurationOffsetContext,i)


        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterFunctionValue" ):
                listener.enterFunctionValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitFunctionValue" ):
                listener.exitFunctionValue(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitFunctionValue" ):
                return visitor.visitFunctionValue(self)
            else:
                return visitor.visitChildren(self)



    def value(self):

        localctx = PQLParser.ValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 34, self.RULE_value)
        self._la = 0 # Token type
        try:
            self.state = 154
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [26]:
                localctx = PQLParser.StringValueContext(self, localctx)
                self.enterOuterAlt(localctx, 1)
                self.state = 141
                self.match(PQLParser.STRING)
                pass
            elif token in [25, 28]:
                localctx = PQLParser.NumberValueContext(self, localctx)
                self.enterOuterAlt(localctx, 2)
                self.state = 143
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==25:
                    self.state = 142
                    self.match(PQLParser.MINUS)


                self.state = 145
                self.match(PQLParser.NUMBER)
                pass
            elif token in [29]:
                localctx = PQLParser.IdentValueContext(self, localctx)
                self.enterOuterAlt(localctx, 3)
                self.state = 146
                self.match(PQLParser.IDENT)
                pass
            elif token in [8, 9, 10, 11]:
                localctx = PQLParser.FunctionValueContext(self, localctx)
                self.enterOuterAlt(localctx, 4)
                self.state = 147
                self.valueFunction()
                self.state = 151
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==24 or _la==25:
                    self.state = 148
                    self.durationOffset()
                    self.state = 153
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)

                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ValueFunctionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def functionName(self):
            return self.getTypedRuleContext(PQLParser.FunctionNameContext,0)


        def callArguments(self):
            return self.getTypedRuleContext(PQLParser.CallArgumentsContext,0)


        def getRuleIndex(self):
            return PQLParser.RULE_valueFunction

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterValueFunction" ):
                listener.enterValueFunction(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitValueFunction" ):
                listener.exitValueFunction(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitValueFunction" ):
                return visitor.visitValueFunction(self)
            else:
                return visitor.visitChildren(self)




    def valueFunction(self):

        localctx = PQLParser.ValueFunctionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 36, self.RULE_valueFunction)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 156
            self.functionName()
            self.state = 157
            self.callArguments()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DurationOffsetContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def sign(self):
            return self.getTypedRuleContext(PQLParser.SignContext,0)


        def DURATION(self):
            return self.getToken(PQLParser.DURATION, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_durationOffset

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDurationOffset" ):
                listener.enterDurationOffset(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDurationOffset" ):
                listener.exitDurationOffset(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitDurationOffset" ):
                return visitor.visitDurationOffset(self)
            else:
                return visitor.visitChildren(self)




    def durationOffset(self):

        localctx = PQLParser.DurationOffsetContext(self, self._ctx, self.state)
        self.enterRule(localctx, 38, self.RULE_durationOffset)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 159
            self.sign()
            self.state = 160
            self.match(PQLParser.DURATION)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class SignContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def PLUS(self):
            return self.getToken(PQLParser.PLUS, 0)

        def MINUS(self):
            return self.getToken(PQLParser.MINUS, 0)

        def getRuleIndex(self):
            return PQLParser.RULE_sign

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterSign" ):
                listener.enterSign(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitSign" ):
                listener.exitSign(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitSign" ):
                return visitor.visitSign(self)
            else:
                return visitor.visitChildren(self)




    def sign(self):

        localctx = PQLParser.SignContext(self, self._ctx, self.state)
        self.enterRule(localctx, 40, self.RULE_sign)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 162
            _la = self._input.LA(1)
            if not(_la==24 or _la==25):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx





