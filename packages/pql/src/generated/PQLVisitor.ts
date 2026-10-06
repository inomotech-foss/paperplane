
import { AbstractParseTreeVisitor } from "antlr4ng";


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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `PQLParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class PQLVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `PQLParser.query`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQuery?: (ctx: QueryContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.orExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOrExpr?: (ctx: OrExprContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.andExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAndExpr?: (ctx: AndExprContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.notExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNotExpr?: (ctx: NotExprContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.primary`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimary?: (ctx: PrimaryContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.predicate`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPredicate?: (ctx: PredicateContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.fieldName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldName?: (ctx: FieldNameContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.customPropertyPredicate`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCustomPropertyPredicate?: (ctx: CustomPropertyPredicateContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.propertyReference`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPropertyReference?: (ctx: PropertyReferenceContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.conditionFunction`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionFunction?: (ctx: ConditionFunctionContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.functionName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionName?: (ctx: FunctionNameContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.callArguments`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallArguments?: (ctx: CallArgumentsContext) => Result;
    /**
     * Visit a parse tree produced by the `compareOperator`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCompareOperator?: (ctx: CompareOperatorContext) => Result;
    /**
     * Visit a parse tree produced by the `inList`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInList?: (ctx: InListContext) => Result;
    /**
     * Visit a parse tree produced by the `notInList`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNotInList?: (ctx: NotInListContext) => Result;
    /**
     * Visit a parse tree produced by the `isNull`
     * labeled alternative in `PQLParser.comparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIsNull?: (ctx: IsNullContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.operator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOperator?: (ctx: OperatorContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.valueList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValueList?: (ctx: ValueListContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.arguments`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArguments?: (ctx: ArgumentsContext) => Result;
    /**
     * Visit a parse tree produced by the `stringValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStringValue?: (ctx: StringValueContext) => Result;
    /**
     * Visit a parse tree produced by the `numberValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNumberValue?: (ctx: NumberValueContext) => Result;
    /**
     * Visit a parse tree produced by the `identValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdentValue?: (ctx: IdentValueContext) => Result;
    /**
     * Visit a parse tree produced by the `functionValue`
     * labeled alternative in `PQLParser.value`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionValue?: (ctx: FunctionValueContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.valueFunction`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValueFunction?: (ctx: ValueFunctionContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.durationOffset`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDurationOffset?: (ctx: DurationOffsetContext) => Result;
    /**
     * Visit a parse tree produced by `PQLParser.sign`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSign?: (ctx: SignContext) => Result;
}

