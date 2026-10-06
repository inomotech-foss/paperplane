
import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { PQLListener } from "./PQLListener.js";
import { PQLVisitor } from "./PQLVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class PQLParser extends antlr.Parser {
    public static readonly AND = 1;
    public static readonly OR = 2;
    public static readonly NOT = 3;
    public static readonly IN = 4;
    public static readonly IS = 5;
    public static readonly NULL = 6;
    public static readonly CF = 7;
    public static readonly CURRENTUSER = 8;
    public static readonly NOW = 9;
    public static readonly CHILDOF = 10;
    public static readonly DESCENDANTOF = 11;
    public static readonly NEQ = 12;
    public static readonly GTE = 13;
    public static readonly LTE = 14;
    public static readonly EQ = 15;
    public static readonly GT = 16;
    public static readonly LT = 17;
    public static readonly TILDE = 18;
    public static readonly LPAREN = 19;
    public static readonly RPAREN = 20;
    public static readonly LBRACKET = 21;
    public static readonly RBRACKET = 22;
    public static readonly COMMA = 23;
    public static readonly PLUS = 24;
    public static readonly MINUS = 25;
    public static readonly STRING = 26;
    public static readonly DURATION = 27;
    public static readonly NUMBER = 28;
    public static readonly IDENT = 29;
    public static readonly WS = 30;
    public static readonly RULE_query = 0;
    public static readonly RULE_expression = 1;
    public static readonly RULE_orExpr = 2;
    public static readonly RULE_andExpr = 3;
    public static readonly RULE_notExpr = 4;
    public static readonly RULE_primary = 5;
    public static readonly RULE_predicate = 6;
    public static readonly RULE_fieldName = 7;
    public static readonly RULE_customPropertyPredicate = 8;
    public static readonly RULE_propertyReference = 9;
    public static readonly RULE_conditionFunction = 10;
    public static readonly RULE_functionName = 11;
    public static readonly RULE_callArguments = 12;
    public static readonly RULE_comparison = 13;
    public static readonly RULE_operator = 14;
    public static readonly RULE_valueList = 15;
    public static readonly RULE_arguments = 16;
    public static readonly RULE_value = 17;
    public static readonly RULE_valueFunction = 18;
    public static readonly RULE_durationOffset = 19;
    public static readonly RULE_sign = 20;

    public static readonly literalNames = [
        null, "'and'", "'or'", "'not'", "'in'", "'is'", "'null'", "'cf'", 
        "'currentuser'", "'now'", "'childof'", "'descendantof'", "'!='", 
        "'>='", "'<='", "'='", "'>'", "'<'", "'~'", "'('", "')'", "'['", 
        "']'", "','", "'+'", "'-'"
    ];

    public static readonly symbolicNames = [
        null, "AND", "OR", "NOT", "IN", "IS", "NULL", "CF", "CURRENTUSER", 
        "NOW", "CHILDOF", "DESCENDANTOF", "NEQ", "GTE", "LTE", "EQ", "GT", 
        "LT", "TILDE", "LPAREN", "RPAREN", "LBRACKET", "RBRACKET", "COMMA", 
        "PLUS", "MINUS", "STRING", "DURATION", "NUMBER", "IDENT", "WS"
    ];
    public static readonly ruleNames = [
        "query", "expression", "orExpr", "andExpr", "notExpr", "primary", 
        "predicate", "fieldName", "customPropertyPredicate", "propertyReference", 
        "conditionFunction", "functionName", "callArguments", "comparison", 
        "operator", "valueList", "arguments", "value", "valueFunction", 
        "durationOffset", "sign",
    ];

    public get grammarFileName(): string { return "PQL.g4"; }
    public get literalNames(): (string | null)[] { return PQLParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return PQLParser.symbolicNames; }
    public get ruleNames(): string[] { return PQLParser.ruleNames; }
    public get serializedATN(): number[] { return PQLParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, PQLParser._ATN, PQLParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public query(): QueryContext {
        let localContext = new QueryContext(this.context, this.state);
        this.enterRule(localContext, 0, PQLParser.RULE_query);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 42;
            this.expression();
            this.state = 43;
            this.match(PQLParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expression(): ExpressionContext {
        let localContext = new ExpressionContext(this.context, this.state);
        this.enterRule(localContext, 2, PQLParser.RULE_expression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 45;
            this.orExpr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public orExpr(): OrExprContext {
        let localContext = new OrExprContext(this.context, this.state);
        this.enterRule(localContext, 4, PQLParser.RULE_orExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 47;
            this.andExpr();
            this.state = 52;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 2) {
                {
                {
                this.state = 48;
                this.match(PQLParser.OR);
                this.state = 49;
                this.andExpr();
                }
                }
                this.state = 54;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public andExpr(): AndExprContext {
        let localContext = new AndExprContext(this.context, this.state);
        this.enterRule(localContext, 6, PQLParser.RULE_andExpr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 55;
            this.notExpr();
            this.state = 60;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 1) {
                {
                {
                this.state = 56;
                this.match(PQLParser.AND);
                this.state = 57;
                this.notExpr();
                }
                }
                this.state = 62;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public notExpr(): NotExprContext {
        let localContext = new NotExprContext(this.context, this.state);
        this.enterRule(localContext, 8, PQLParser.RULE_notExpr);
        try {
            this.state = 66;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case PQLParser.NOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 63;
                this.match(PQLParser.NOT);
                this.state = 64;
                this.notExpr();
                }
                break;
            case PQLParser.CF:
            case PQLParser.CURRENTUSER:
            case PQLParser.NOW:
            case PQLParser.CHILDOF:
            case PQLParser.DESCENDANTOF:
            case PQLParser.LPAREN:
            case PQLParser.IDENT:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 65;
                this.primary();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public primary(): PrimaryContext {
        let localContext = new PrimaryContext(this.context, this.state);
        this.enterRule(localContext, 10, PQLParser.RULE_primary);
        try {
            this.state = 74;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case PQLParser.LPAREN:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 68;
                this.match(PQLParser.LPAREN);
                this.state = 69;
                this.expression();
                this.state = 70;
                this.match(PQLParser.RPAREN);
                }
                break;
            case PQLParser.CURRENTUSER:
            case PQLParser.NOW:
            case PQLParser.CHILDOF:
            case PQLParser.DESCENDANTOF:
            case PQLParser.IDENT:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 72;
                this.predicate();
                }
                break;
            case PQLParser.CF:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 73;
                this.customPropertyPredicate();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public predicate(): PredicateContext {
        let localContext = new PredicateContext(this.context, this.state);
        this.enterRule(localContext, 12, PQLParser.RULE_predicate);
        try {
            this.state = 80;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case PQLParser.IDENT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 76;
                this.fieldName();
                this.state = 77;
                this.comparison();
                }
                break;
            case PQLParser.CURRENTUSER:
            case PQLParser.NOW:
            case PQLParser.CHILDOF:
            case PQLParser.DESCENDANTOF:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 79;
                this.conditionFunction();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fieldName(): FieldNameContext {
        let localContext = new FieldNameContext(this.context, this.state);
        this.enterRule(localContext, 14, PQLParser.RULE_fieldName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 82;
            this.match(PQLParser.IDENT);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public customPropertyPredicate(): CustomPropertyPredicateContext {
        let localContext = new CustomPropertyPredicateContext(this.context, this.state);
        this.enterRule(localContext, 16, PQLParser.RULE_customPropertyPredicate);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 84;
            this.match(PQLParser.CF);
            this.state = 85;
            this.match(PQLParser.LBRACKET);
            this.state = 86;
            this.propertyReference();
            this.state = 87;
            this.match(PQLParser.RBRACKET);
            this.state = 88;
            this.comparison();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public propertyReference(): PropertyReferenceContext {
        let localContext = new PropertyReferenceContext(this.context, this.state);
        this.enterRule(localContext, 18, PQLParser.RULE_propertyReference);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 90;
            this.match(PQLParser.STRING);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public conditionFunction(): ConditionFunctionContext {
        let localContext = new ConditionFunctionContext(this.context, this.state);
        this.enterRule(localContext, 20, PQLParser.RULE_conditionFunction);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 92;
            this.functionName();
            this.state = 93;
            this.callArguments();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public functionName(): FunctionNameContext {
        let localContext = new FunctionNameContext(this.context, this.state);
        this.enterRule(localContext, 22, PQLParser.RULE_functionName);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 95;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 3840) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public callArguments(): CallArgumentsContext {
        let localContext = new CallArgumentsContext(this.context, this.state);
        this.enterRule(localContext, 24, PQLParser.RULE_callArguments);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 97;
            this.match(PQLParser.LPAREN);
            this.state = 99;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 905973504) !== 0)) {
                {
                this.state = 98;
                this.arguments();
                }
            }

            this.state = 101;
            this.match(PQLParser.RPAREN);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public comparison(): ComparisonContext {
        let localContext = new ComparisonContext(this.context, this.state);
        this.enterRule(localContext, 26, PQLParser.RULE_comparison);
        let _la: number;
        try {
            this.state = 116;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case PQLParser.NEQ:
            case PQLParser.GTE:
            case PQLParser.LTE:
            case PQLParser.EQ:
            case PQLParser.GT:
            case PQLParser.LT:
            case PQLParser.TILDE:
                localContext = new CompareOperatorContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 103;
                this.operator();
                this.state = 104;
                this.value();
                }
                break;
            case PQLParser.IN:
                localContext = new InListContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 106;
                this.match(PQLParser.IN);
                this.state = 107;
                this.valueList();
                }
                break;
            case PQLParser.NOT:
                localContext = new NotInListContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 108;
                this.match(PQLParser.NOT);
                this.state = 109;
                this.match(PQLParser.IN);
                this.state = 110;
                this.valueList();
                }
                break;
            case PQLParser.IS:
                localContext = new IsNullContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 111;
                this.match(PQLParser.IS);
                this.state = 113;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 3) {
                    {
                    this.state = 112;
                    this.match(PQLParser.NOT);
                    }
                }

                this.state = 115;
                this.match(PQLParser.NULL);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public operator(): OperatorContext {
        let localContext = new OperatorContext(this.context, this.state);
        this.enterRule(localContext, 28, PQLParser.RULE_operator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 118;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 520192) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public valueList(): ValueListContext {
        let localContext = new ValueListContext(this.context, this.state);
        this.enterRule(localContext, 30, PQLParser.RULE_valueList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 120;
            this.match(PQLParser.LPAREN);
            this.state = 129;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 905973504) !== 0)) {
                {
                this.state = 121;
                this.value();
                this.state = 126;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 23) {
                    {
                    {
                    this.state = 122;
                    this.match(PQLParser.COMMA);
                    this.state = 123;
                    this.value();
                    }
                    }
                    this.state = 128;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
            }

            this.state = 131;
            this.match(PQLParser.RPAREN);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arguments(): ArgumentsContext {
        let localContext = new ArgumentsContext(this.context, this.state);
        this.enterRule(localContext, 32, PQLParser.RULE_arguments);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 133;
            this.value();
            this.state = 138;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 23) {
                {
                {
                this.state = 134;
                this.match(PQLParser.COMMA);
                this.state = 135;
                this.value();
                }
                }
                this.state = 140;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public value(): ValueContext {
        let localContext = new ValueContext(this.context, this.state);
        this.enterRule(localContext, 34, PQLParser.RULE_value);
        let _la: number;
        try {
            this.state = 154;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case PQLParser.STRING:
                localContext = new StringValueContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 141;
                this.match(PQLParser.STRING);
                }
                break;
            case PQLParser.MINUS:
            case PQLParser.NUMBER:
                localContext = new NumberValueContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 143;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 25) {
                    {
                    this.state = 142;
                    this.match(PQLParser.MINUS);
                    }
                }

                this.state = 145;
                this.match(PQLParser.NUMBER);
                }
                break;
            case PQLParser.IDENT:
                localContext = new IdentValueContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 146;
                this.match(PQLParser.IDENT);
                }
                break;
            case PQLParser.CURRENTUSER:
            case PQLParser.NOW:
            case PQLParser.CHILDOF:
            case PQLParser.DESCENDANTOF:
                localContext = new FunctionValueContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 147;
                this.valueFunction();
                this.state = 151;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 24 || _la === 25) {
                    {
                    {
                    this.state = 148;
                    this.durationOffset();
                    }
                    }
                    this.state = 153;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public valueFunction(): ValueFunctionContext {
        let localContext = new ValueFunctionContext(this.context, this.state);
        this.enterRule(localContext, 36, PQLParser.RULE_valueFunction);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 156;
            this.functionName();
            this.state = 157;
            this.callArguments();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public durationOffset(): DurationOffsetContext {
        let localContext = new DurationOffsetContext(this.context, this.state);
        this.enterRule(localContext, 38, PQLParser.RULE_durationOffset);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 159;
            this.sign();
            this.state = 160;
            this.match(PQLParser.DURATION);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public sign(): SignContext {
        let localContext = new SignContext(this.context, this.state);
        this.enterRule(localContext, 40, PQLParser.RULE_sign);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 162;
            _la = this.tokenStream.LA(1);
            if(!(_la === 24 || _la === 25)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public static readonly _serializedATN: number[] = [
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
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!PQLParser.__ATN) {
            PQLParser.__ATN = new antlr.ATNDeserializer().deserialize(PQLParser._serializedATN);
        }

        return PQLParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(PQLParser.literalNames, PQLParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return PQLParser.vocabulary;
    }

    private static readonly decisionsToDFA = PQLParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class QueryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(PQLParser.EOF, 0)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_query;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterQuery) {
             listener.enterQuery(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitQuery) {
             listener.exitQuery(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitQuery) {
            return visitor.visitQuery(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public orExpr(): OrExprContext {
        return this.getRuleContext(0, OrExprContext)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_expression;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterExpression) {
             listener.enterExpression(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitExpression) {
             listener.exitExpression(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitExpression) {
            return visitor.visitExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OrExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public andExpr(): AndExprContext[];
    public andExpr(i: number): AndExprContext | null;
    public andExpr(i?: number): AndExprContext[] | AndExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AndExprContext);
        }

        return this.getRuleContext(i, AndExprContext);
    }
    public OR(): antlr.TerminalNode[];
    public OR(i: number): antlr.TerminalNode | null;
    public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(PQLParser.OR);
    	} else {
    		return this.getToken(PQLParser.OR, i);
    	}
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_orExpr;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterOrExpr) {
             listener.enterOrExpr(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitOrExpr) {
             listener.exitOrExpr(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitOrExpr) {
            return visitor.visitOrExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AndExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public notExpr(): NotExprContext[];
    public notExpr(i: number): NotExprContext | null;
    public notExpr(i?: number): NotExprContext[] | NotExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(NotExprContext);
        }

        return this.getRuleContext(i, NotExprContext);
    }
    public AND(): antlr.TerminalNode[];
    public AND(i: number): antlr.TerminalNode | null;
    public AND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(PQLParser.AND);
    	} else {
    		return this.getToken(PQLParser.AND, i);
    	}
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_andExpr;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterAndExpr) {
             listener.enterAndExpr(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitAndExpr) {
             listener.exitAndExpr(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitAndExpr) {
            return visitor.visitAndExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NotExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.NOT, 0);
    }
    public notExpr(): NotExprContext | null {
        return this.getRuleContext(0, NotExprContext);
    }
    public primary(): PrimaryContext | null {
        return this.getRuleContext(0, PrimaryContext);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_notExpr;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterNotExpr) {
             listener.enterNotExpr(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitNotExpr) {
             listener.exitNotExpr(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitNotExpr) {
            return visitor.visitNotExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PrimaryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.LPAREN, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.RPAREN, 0);
    }
    public predicate(): PredicateContext | null {
        return this.getRuleContext(0, PredicateContext);
    }
    public customPropertyPredicate(): CustomPropertyPredicateContext | null {
        return this.getRuleContext(0, CustomPropertyPredicateContext);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_primary;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterPrimary) {
             listener.enterPrimary(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitPrimary) {
             listener.exitPrimary(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitPrimary) {
            return visitor.visitPrimary(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PredicateContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fieldName(): FieldNameContext | null {
        return this.getRuleContext(0, FieldNameContext);
    }
    public comparison(): ComparisonContext | null {
        return this.getRuleContext(0, ComparisonContext);
    }
    public conditionFunction(): ConditionFunctionContext | null {
        return this.getRuleContext(0, ConditionFunctionContext);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_predicate;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterPredicate) {
             listener.enterPredicate(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitPredicate) {
             listener.exitPredicate(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitPredicate) {
            return visitor.visitPredicate(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FieldNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENT(): antlr.TerminalNode {
        return this.getToken(PQLParser.IDENT, 0)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_fieldName;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterFieldName) {
             listener.enterFieldName(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitFieldName) {
             listener.exitFieldName(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitFieldName) {
            return visitor.visitFieldName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CustomPropertyPredicateContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CF(): antlr.TerminalNode {
        return this.getToken(PQLParser.CF, 0)!;
    }
    public LBRACKET(): antlr.TerminalNode {
        return this.getToken(PQLParser.LBRACKET, 0)!;
    }
    public propertyReference(): PropertyReferenceContext {
        return this.getRuleContext(0, PropertyReferenceContext)!;
    }
    public RBRACKET(): antlr.TerminalNode {
        return this.getToken(PQLParser.RBRACKET, 0)!;
    }
    public comparison(): ComparisonContext {
        return this.getRuleContext(0, ComparisonContext)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_customPropertyPredicate;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterCustomPropertyPredicate) {
             listener.enterCustomPropertyPredicate(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitCustomPropertyPredicate) {
             listener.exitCustomPropertyPredicate(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitCustomPropertyPredicate) {
            return visitor.visitCustomPropertyPredicate(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PropertyReferenceContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(PQLParser.STRING, 0)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_propertyReference;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterPropertyReference) {
             listener.enterPropertyReference(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitPropertyReference) {
             listener.exitPropertyReference(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitPropertyReference) {
            return visitor.visitPropertyReference(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConditionFunctionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public functionName(): FunctionNameContext {
        return this.getRuleContext(0, FunctionNameContext)!;
    }
    public callArguments(): CallArgumentsContext {
        return this.getRuleContext(0, CallArgumentsContext)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_conditionFunction;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterConditionFunction) {
             listener.enterConditionFunction(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitConditionFunction) {
             listener.exitConditionFunction(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitConditionFunction) {
            return visitor.visitConditionFunction(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FunctionNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CHILDOF(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.CHILDOF, 0);
    }
    public DESCENDANTOF(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.DESCENDANTOF, 0);
    }
    public CURRENTUSER(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.CURRENTUSER, 0);
    }
    public NOW(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.NOW, 0);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_functionName;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterFunctionName) {
             listener.enterFunctionName(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitFunctionName) {
             listener.exitFunctionName(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitFunctionName) {
            return visitor.visitFunctionName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CallArgumentsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(PQLParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(PQLParser.RPAREN, 0)!;
    }
    public arguments(): ArgumentsContext | null {
        return this.getRuleContext(0, ArgumentsContext);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_callArguments;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterCallArguments) {
             listener.enterCallArguments(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitCallArguments) {
             listener.exitCallArguments(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitCallArguments) {
            return visitor.visitCallArguments(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ComparisonContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_comparison;
    }
    public override copyFrom(ctx: ComparisonContext): void {
        super.copyFrom(ctx);
    }
}
export class CompareOperatorContext extends ComparisonContext {
    public constructor(ctx: ComparisonContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public operator(): OperatorContext {
        return this.getRuleContext(0, OperatorContext)!;
    }
    public value(): ValueContext {
        return this.getRuleContext(0, ValueContext)!;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterCompareOperator) {
             listener.enterCompareOperator(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitCompareOperator) {
             listener.exitCompareOperator(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitCompareOperator) {
            return visitor.visitCompareOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class InListContext extends ComparisonContext {
    public constructor(ctx: ComparisonContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public IN(): antlr.TerminalNode {
        return this.getToken(PQLParser.IN, 0)!;
    }
    public valueList(): ValueListContext {
        return this.getRuleContext(0, ValueListContext)!;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterInList) {
             listener.enterInList(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitInList) {
             listener.exitInList(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitInList) {
            return visitor.visitInList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class NotInListContext extends ComparisonContext {
    public constructor(ctx: ComparisonContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public NOT(): antlr.TerminalNode {
        return this.getToken(PQLParser.NOT, 0)!;
    }
    public IN(): antlr.TerminalNode {
        return this.getToken(PQLParser.IN, 0)!;
    }
    public valueList(): ValueListContext {
        return this.getRuleContext(0, ValueListContext)!;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterNotInList) {
             listener.enterNotInList(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitNotInList) {
             listener.exitNotInList(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitNotInList) {
            return visitor.visitNotInList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class IsNullContext extends ComparisonContext {
    public constructor(ctx: ComparisonContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public IS(): antlr.TerminalNode {
        return this.getToken(PQLParser.IS, 0)!;
    }
    public NULL(): antlr.TerminalNode {
        return this.getToken(PQLParser.NULL, 0)!;
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.NOT, 0);
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterIsNull) {
             listener.enterIsNull(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitIsNull) {
             listener.exitIsNull(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitIsNull) {
            return visitor.visitIsNull(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EQ(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.EQ, 0);
    }
    public NEQ(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.NEQ, 0);
    }
    public GT(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.GT, 0);
    }
    public GTE(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.GTE, 0);
    }
    public LT(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.LT, 0);
    }
    public LTE(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.LTE, 0);
    }
    public TILDE(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.TILDE, 0);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_operator;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterOperator) {
             listener.enterOperator(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitOperator) {
             listener.exitOperator(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitOperator) {
            return visitor.visitOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ValueListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(PQLParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(PQLParser.RPAREN, 0)!;
    }
    public value(): ValueContext[];
    public value(i: number): ValueContext | null;
    public value(i?: number): ValueContext[] | ValueContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ValueContext);
        }

        return this.getRuleContext(i, ValueContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(PQLParser.COMMA);
    	} else {
    		return this.getToken(PQLParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_valueList;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterValueList) {
             listener.enterValueList(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitValueList) {
             listener.exitValueList(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitValueList) {
            return visitor.visitValueList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArgumentsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public value(): ValueContext[];
    public value(i: number): ValueContext | null;
    public value(i?: number): ValueContext[] | ValueContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ValueContext);
        }

        return this.getRuleContext(i, ValueContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(PQLParser.COMMA);
    	} else {
    		return this.getToken(PQLParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_arguments;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterArguments) {
             listener.enterArguments(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitArguments) {
             listener.exitArguments(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitArguments) {
            return visitor.visitArguments(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_value;
    }
    public override copyFrom(ctx: ValueContext): void {
        super.copyFrom(ctx);
    }
}
export class StringValueContext extends ValueContext {
    public constructor(ctx: ValueContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(PQLParser.STRING, 0)!;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterStringValue) {
             listener.enterStringValue(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitStringValue) {
             listener.exitStringValue(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitStringValue) {
            return visitor.visitStringValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class NumberValueContext extends ValueContext {
    public constructor(ctx: ValueContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public NUMBER(): antlr.TerminalNode {
        return this.getToken(PQLParser.NUMBER, 0)!;
    }
    public MINUS(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.MINUS, 0);
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterNumberValue) {
             listener.enterNumberValue(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitNumberValue) {
             listener.exitNumberValue(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitNumberValue) {
            return visitor.visitNumberValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class IdentValueContext extends ValueContext {
    public constructor(ctx: ValueContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public IDENT(): antlr.TerminalNode {
        return this.getToken(PQLParser.IDENT, 0)!;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterIdentValue) {
             listener.enterIdentValue(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitIdentValue) {
             listener.exitIdentValue(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitIdentValue) {
            return visitor.visitIdentValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FunctionValueContext extends ValueContext {
    public constructor(ctx: ValueContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public valueFunction(): ValueFunctionContext {
        return this.getRuleContext(0, ValueFunctionContext)!;
    }
    public durationOffset(): DurationOffsetContext[];
    public durationOffset(i: number): DurationOffsetContext | null;
    public durationOffset(i?: number): DurationOffsetContext[] | DurationOffsetContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DurationOffsetContext);
        }

        return this.getRuleContext(i, DurationOffsetContext);
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterFunctionValue) {
             listener.enterFunctionValue(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitFunctionValue) {
             listener.exitFunctionValue(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitFunctionValue) {
            return visitor.visitFunctionValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ValueFunctionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public functionName(): FunctionNameContext {
        return this.getRuleContext(0, FunctionNameContext)!;
    }
    public callArguments(): CallArgumentsContext {
        return this.getRuleContext(0, CallArgumentsContext)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_valueFunction;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterValueFunction) {
             listener.enterValueFunction(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitValueFunction) {
             listener.exitValueFunction(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitValueFunction) {
            return visitor.visitValueFunction(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DurationOffsetContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public sign(): SignContext {
        return this.getRuleContext(0, SignContext)!;
    }
    public DURATION(): antlr.TerminalNode {
        return this.getToken(PQLParser.DURATION, 0)!;
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_durationOffset;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterDurationOffset) {
             listener.enterDurationOffset(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitDurationOffset) {
             listener.exitDurationOffset(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitDurationOffset) {
            return visitor.visitDurationOffset(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SignContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PLUS(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.PLUS, 0);
    }
    public MINUS(): antlr.TerminalNode | null {
        return this.getToken(PQLParser.MINUS, 0);
    }
    public override get ruleIndex(): number {
        return PQLParser.RULE_sign;
    }
    public override enterRule(listener: PQLListener): void {
        if(listener.enterSign) {
             listener.enterSign(this);
        }
    }
    public override exitRule(listener: PQLListener): void {
        if(listener.exitSign) {
             listener.exitSign(this);
        }
    }
    public override accept<Result>(visitor: PQLVisitor<Result>): Result | null {
        if (visitor.visitSign) {
            return visitor.visitSign(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
