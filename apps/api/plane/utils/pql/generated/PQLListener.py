from antlr4 import *
if "." in __name__:
    from .PQLParser import PQLParser
else:
    from PQLParser import PQLParser

# This class defines a complete listener for a parse tree produced by PQLParser.
class PQLListener(ParseTreeListener):

    # Enter a parse tree produced by PQLParser#query.
    def enterQuery(self, ctx:PQLParser.QueryContext):
        pass

    # Exit a parse tree produced by PQLParser#query.
    def exitQuery(self, ctx:PQLParser.QueryContext):
        pass


    # Enter a parse tree produced by PQLParser#expression.
    def enterExpression(self, ctx:PQLParser.ExpressionContext):
        pass

    # Exit a parse tree produced by PQLParser#expression.
    def exitExpression(self, ctx:PQLParser.ExpressionContext):
        pass


    # Enter a parse tree produced by PQLParser#orExpr.
    def enterOrExpr(self, ctx:PQLParser.OrExprContext):
        pass

    # Exit a parse tree produced by PQLParser#orExpr.
    def exitOrExpr(self, ctx:PQLParser.OrExprContext):
        pass


    # Enter a parse tree produced by PQLParser#andExpr.
    def enterAndExpr(self, ctx:PQLParser.AndExprContext):
        pass

    # Exit a parse tree produced by PQLParser#andExpr.
    def exitAndExpr(self, ctx:PQLParser.AndExprContext):
        pass


    # Enter a parse tree produced by PQLParser#notExpr.
    def enterNotExpr(self, ctx:PQLParser.NotExprContext):
        pass

    # Exit a parse tree produced by PQLParser#notExpr.
    def exitNotExpr(self, ctx:PQLParser.NotExprContext):
        pass


    # Enter a parse tree produced by PQLParser#primary.
    def enterPrimary(self, ctx:PQLParser.PrimaryContext):
        pass

    # Exit a parse tree produced by PQLParser#primary.
    def exitPrimary(self, ctx:PQLParser.PrimaryContext):
        pass


    # Enter a parse tree produced by PQLParser#predicate.
    def enterPredicate(self, ctx:PQLParser.PredicateContext):
        pass

    # Exit a parse tree produced by PQLParser#predicate.
    def exitPredicate(self, ctx:PQLParser.PredicateContext):
        pass


    # Enter a parse tree produced by PQLParser#fieldName.
    def enterFieldName(self, ctx:PQLParser.FieldNameContext):
        pass

    # Exit a parse tree produced by PQLParser#fieldName.
    def exitFieldName(self, ctx:PQLParser.FieldNameContext):
        pass


    # Enter a parse tree produced by PQLParser#customPropertyPredicate.
    def enterCustomPropertyPredicate(self, ctx:PQLParser.CustomPropertyPredicateContext):
        pass

    # Exit a parse tree produced by PQLParser#customPropertyPredicate.
    def exitCustomPropertyPredicate(self, ctx:PQLParser.CustomPropertyPredicateContext):
        pass


    # Enter a parse tree produced by PQLParser#propertyReference.
    def enterPropertyReference(self, ctx:PQLParser.PropertyReferenceContext):
        pass

    # Exit a parse tree produced by PQLParser#propertyReference.
    def exitPropertyReference(self, ctx:PQLParser.PropertyReferenceContext):
        pass


    # Enter a parse tree produced by PQLParser#conditionFunction.
    def enterConditionFunction(self, ctx:PQLParser.ConditionFunctionContext):
        pass

    # Exit a parse tree produced by PQLParser#conditionFunction.
    def exitConditionFunction(self, ctx:PQLParser.ConditionFunctionContext):
        pass


    # Enter a parse tree produced by PQLParser#functionName.
    def enterFunctionName(self, ctx:PQLParser.FunctionNameContext):
        pass

    # Exit a parse tree produced by PQLParser#functionName.
    def exitFunctionName(self, ctx:PQLParser.FunctionNameContext):
        pass


    # Enter a parse tree produced by PQLParser#callArguments.
    def enterCallArguments(self, ctx:PQLParser.CallArgumentsContext):
        pass

    # Exit a parse tree produced by PQLParser#callArguments.
    def exitCallArguments(self, ctx:PQLParser.CallArgumentsContext):
        pass


    # Enter a parse tree produced by PQLParser#compareOperator.
    def enterCompareOperator(self, ctx:PQLParser.CompareOperatorContext):
        pass

    # Exit a parse tree produced by PQLParser#compareOperator.
    def exitCompareOperator(self, ctx:PQLParser.CompareOperatorContext):
        pass


    # Enter a parse tree produced by PQLParser#inList.
    def enterInList(self, ctx:PQLParser.InListContext):
        pass

    # Exit a parse tree produced by PQLParser#inList.
    def exitInList(self, ctx:PQLParser.InListContext):
        pass


    # Enter a parse tree produced by PQLParser#notInList.
    def enterNotInList(self, ctx:PQLParser.NotInListContext):
        pass

    # Exit a parse tree produced by PQLParser#notInList.
    def exitNotInList(self, ctx:PQLParser.NotInListContext):
        pass


    # Enter a parse tree produced by PQLParser#isNull.
    def enterIsNull(self, ctx:PQLParser.IsNullContext):
        pass

    # Exit a parse tree produced by PQLParser#isNull.
    def exitIsNull(self, ctx:PQLParser.IsNullContext):
        pass


    # Enter a parse tree produced by PQLParser#operator.
    def enterOperator(self, ctx:PQLParser.OperatorContext):
        pass

    # Exit a parse tree produced by PQLParser#operator.
    def exitOperator(self, ctx:PQLParser.OperatorContext):
        pass


    # Enter a parse tree produced by PQLParser#valueList.
    def enterValueList(self, ctx:PQLParser.ValueListContext):
        pass

    # Exit a parse tree produced by PQLParser#valueList.
    def exitValueList(self, ctx:PQLParser.ValueListContext):
        pass


    # Enter a parse tree produced by PQLParser#arguments.
    def enterArguments(self, ctx:PQLParser.ArgumentsContext):
        pass

    # Exit a parse tree produced by PQLParser#arguments.
    def exitArguments(self, ctx:PQLParser.ArgumentsContext):
        pass


    # Enter a parse tree produced by PQLParser#stringValue.
    def enterStringValue(self, ctx:PQLParser.StringValueContext):
        pass

    # Exit a parse tree produced by PQLParser#stringValue.
    def exitStringValue(self, ctx:PQLParser.StringValueContext):
        pass


    # Enter a parse tree produced by PQLParser#numberValue.
    def enterNumberValue(self, ctx:PQLParser.NumberValueContext):
        pass

    # Exit a parse tree produced by PQLParser#numberValue.
    def exitNumberValue(self, ctx:PQLParser.NumberValueContext):
        pass


    # Enter a parse tree produced by PQLParser#identValue.
    def enterIdentValue(self, ctx:PQLParser.IdentValueContext):
        pass

    # Exit a parse tree produced by PQLParser#identValue.
    def exitIdentValue(self, ctx:PQLParser.IdentValueContext):
        pass


    # Enter a parse tree produced by PQLParser#functionValue.
    def enterFunctionValue(self, ctx:PQLParser.FunctionValueContext):
        pass

    # Exit a parse tree produced by PQLParser#functionValue.
    def exitFunctionValue(self, ctx:PQLParser.FunctionValueContext):
        pass


    # Enter a parse tree produced by PQLParser#valueFunction.
    def enterValueFunction(self, ctx:PQLParser.ValueFunctionContext):
        pass

    # Exit a parse tree produced by PQLParser#valueFunction.
    def exitValueFunction(self, ctx:PQLParser.ValueFunctionContext):
        pass


    # Enter a parse tree produced by PQLParser#durationOffset.
    def enterDurationOffset(self, ctx:PQLParser.DurationOffsetContext):
        pass

    # Exit a parse tree produced by PQLParser#durationOffset.
    def exitDurationOffset(self, ctx:PQLParser.DurationOffsetContext):
        pass


    # Enter a parse tree produced by PQLParser#sign.
    def enterSign(self, ctx:PQLParser.SignContext):
        pass

    # Exit a parse tree produced by PQLParser#sign.
    def exitSign(self, ctx:PQLParser.SignContext):
        pass



del PQLParser