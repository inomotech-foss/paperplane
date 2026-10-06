
import type { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


import { QueryContext } from "./PQLParser.js";
import { ExpressionContext } from "./PQLParser.js";
import { OrExprContext } from "./PQLParser.js";
import { AndExprContext } from "./PQLParser.js";
import { NotExprContext } from "./PQLParser.js";
import { PrimaryContext } from "./PQLParser.js";
import { PredicateContext } from "./PQLParser.js";
import { FieldNameContext } from "./PQLParser.js";
import { CustomPropertyPredicateContext } from "./PQLParser.js";
import { PropertyReferenceContext } from "./PQLParser.js";
import { ConditionFunctionContext } from "./PQLParser.js";
import { FunctionNameContext } from "./PQLParser.js";
import { CallArgumentsContext } from "./PQLParser.js";
import { CompareOperatorContext } from "./PQLParser.js";
import { InListContext } from "./PQLParser.js";
import { NotInListContext } from "./PQLParser.js";
import { IsNullContext } from "./PQLParser.js";
import { OperatorContext } from "./PQLParser.js";
import { ValueListContext } from "./PQLParser.js";
import { ArgumentsContext } from "./PQLParser.js";
import { StringValueContext } from "./PQLParser.js";
import { NumberValueContext } from "./PQLParser.js";
import { IdentValueContext } from "./PQLParser.js";
import { FunctionValueContext } from "./PQLParser.js";
import { ValueFunctionContext } from "./PQLParser.js";
import { DurationOffsetContext } from "./PQLParser.js";
import { SignContext } from "./PQLParser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `PQLParser`.
 */
export class PQLListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `PQLParser.query`.
     * @param ctx the parse tree
     */
    enterQuery?: (ctx: QueryContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.query`.
     * @param ctx the parse tree
     */
    exitQuery?: (ctx: QueryContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.orExpr`.
     * @param ctx the parse tree
     */
    enterOrExpr?: (ctx: OrExprContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.orExpr`.
     * @param ctx the parse tree
     */
    exitOrExpr?: (ctx: OrExprContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.andExpr`.
     * @param ctx the parse tree
     */
    enterAndExpr?: (ctx: AndExprContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.andExpr`.
     * @param ctx the parse tree
     */
    exitAndExpr?: (ctx: AndExprContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.notExpr`.
     * @param ctx the parse tree
     */
    enterNotExpr?: (ctx: NotExprContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.notExpr`.
     * @param ctx the parse tree
     */
    exitNotExpr?: (ctx: NotExprContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.primary`.
     * @param ctx the parse tree
     */
    enterPrimary?: (ctx: PrimaryContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.primary`.
     * @param ctx the parse tree
     */
    exitPrimary?: (ctx: PrimaryContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.predicate`.
     * @param ctx the parse tree
     */
    enterPredicate?: (ctx: PredicateContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.predicate`.
     * @param ctx the parse tree
     */
    exitPredicate?: (ctx: PredicateContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.fieldName`.
     * @param ctx the parse tree
     */
    enterFieldName?: (ctx: FieldNameContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.fieldName`.
     * @param ctx the parse tree
     */
    exitFieldName?: (ctx: FieldNameContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.customPropertyPredicate`.
     * @param ctx the parse tree
     */
    enterCustomPropertyPredicate?: (ctx: CustomPropertyPredicateContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.customPropertyPredicate`.
     * @param ctx the parse tree
     */
    exitCustomPropertyPredicate?: (ctx: CustomPropertyPredicateContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.propertyReference`.
     * @param ctx the parse tree
     */
    enterPropertyReference?: (ctx: PropertyReferenceContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.propertyReference`.
     * @param ctx the parse tree
     */
    exitPropertyReference?: (ctx: PropertyReferenceContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.conditionFunction`.
     * @param ctx the parse tree
     */
    enterConditionFunction?: (ctx: ConditionFunctionContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.conditionFunction`.
     * @param ctx the parse tree
     */
    exitConditionFunction?: (ctx: ConditionFunctionContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.functionName`.
     * @param ctx the parse tree
     */
    enterFunctionName?: (ctx: FunctionNameContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.functionName`.
     * @param ctx the parse tree
     */
    exitFunctionName?: (ctx: FunctionNameContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.callArguments`.
     * @param ctx the parse tree
     */
    enterCallArguments?: (ctx: CallArgumentsContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.callArguments`.
     * @param ctx the parse tree
     */
    exitCallArguments?: (ctx: CallArgumentsContext) => void;
    /**
     * Enter a parse tree produced by the `compareOperator`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    enterCompareOperator?: (ctx: CompareOperatorContext) => void;
    /**
     * Exit a parse tree produced by the `compareOperator`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    exitCompareOperator?: (ctx: CompareOperatorContext) => void;
    /**
     * Enter a parse tree produced by the `inList`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    enterInList?: (ctx: InListContext) => void;
    /**
     * Exit a parse tree produced by the `inList`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    exitInList?: (ctx: InListContext) => void;
    /**
     * Enter a parse tree produced by the `notInList`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    enterNotInList?: (ctx: NotInListContext) => void;
    /**
     * Exit a parse tree produced by the `notInList`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    exitNotInList?: (ctx: NotInListContext) => void;
    /**
     * Enter a parse tree produced by the `isNull`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    enterIsNull?: (ctx: IsNullContext) => void;
    /**
     * Exit a parse tree produced by the `isNull`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     */
    exitIsNull?: (ctx: IsNullContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.operator`.
     * @param ctx the parse tree
     */
    enterOperator?: (ctx: OperatorContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.operator`.
     * @param ctx the parse tree
     */
    exitOperator?: (ctx: OperatorContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.valueList`.
     * @param ctx the parse tree
     */
    enterValueList?: (ctx: ValueListContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.valueList`.
     * @param ctx the parse tree
     */
    exitValueList?: (ctx: ValueListContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.arguments`.
     * @param ctx the parse tree
     */
    enterArguments?: (ctx: ArgumentsContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.arguments`.
     * @param ctx the parse tree
     */
    exitArguments?: (ctx: ArgumentsContext) => void;
    /**
     * Enter a parse tree produced by the `stringValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    enterStringValue?: (ctx: StringValueContext) => void;
    /**
     * Exit a parse tree produced by the `stringValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    exitStringValue?: (ctx: StringValueContext) => void;
    /**
     * Enter a parse tree produced by the `numberValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    enterNumberValue?: (ctx: NumberValueContext) => void;
    /**
     * Exit a parse tree produced by the `numberValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    exitNumberValue?: (ctx: NumberValueContext) => void;
    /**
     * Enter a parse tree produced by the `identValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    enterIdentValue?: (ctx: IdentValueContext) => void;
    /**
     * Exit a parse tree produced by the `identValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    exitIdentValue?: (ctx: IdentValueContext) => void;
    /**
     * Enter a parse tree produced by the `functionValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    enterFunctionValue?: (ctx: FunctionValueContext) => void;
    /**
     * Exit a parse tree produced by the `functionValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     */
    exitFunctionValue?: (ctx: FunctionValueContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.valueFunction`.
     * @param ctx the parse tree
     */
    enterValueFunction?: (ctx: ValueFunctionContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.valueFunction`.
     * @param ctx the parse tree
     */
    exitValueFunction?: (ctx: ValueFunctionContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.durationOffset`.
     * @param ctx the parse tree
     */
    enterDurationOffset?: (ctx: DurationOffsetContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.durationOffset`.
     * @param ctx the parse tree
     */
    exitDurationOffset?: (ctx: DurationOffsetContext) => void;
    /**
     * Enter a parse tree produced by `PQLParser.sign`.
     * @param ctx the parse tree
     */
    enterSign?: (ctx: SignContext) => void;
    /**
     * Exit a parse tree produced by `PQLParser.sign`.
     * @param ctx the parse tree
     */
    exitSign?: (ctx: SignContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

