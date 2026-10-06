from antlr4 import *
if "." in __name__:
    from .PQLParser import PQLParser
else:
    from PQLParser import PQLParser

# This class defines a complete generic visitor for a parse tree produced by PQLParser.

class PQLVisitor(ParseTreeVisitor):

    # Visit a parse tree produced by PQLParser#query.
    def visitQuery(self, ctx:PQLParser.QueryContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#expression.
    def visitExpression(self, ctx:PQLParser.ExpressionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#orExpr.
    def visitOrExpr(self, ctx:PQLParser.OrExprContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#andExpr.
    def visitAndExpr(self, ctx:PQLParser.AndExprContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#notExpr.
    def visitNotExpr(self, ctx:PQLParser.NotExprContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#primary.
    def visitPrimary(self, ctx:PQLParser.PrimaryContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#predicate.
    def visitPredicate(self, ctx:PQLParser.PredicateContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#fieldName.
    def visitFieldName(self, ctx:PQLParser.FieldNameContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#customPropertyPredicate.
    def visitCustomPropertyPredicate(self, ctx:PQLParser.CustomPropertyPredicateContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#propertyReference.
    def visitPropertyReference(self, ctx:PQLParser.PropertyReferenceContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#conditionFunction.
    def visitConditionFunction(self, ctx:PQLParser.ConditionFunctionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#functionName.
    def visitFunctionName(self, ctx:PQLParser.FunctionNameContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#callArguments.
    def visitCallArguments(self, ctx:PQLParser.CallArgumentsContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#compareOperator.
    def visitCompareOperator(self, ctx:PQLParser.CompareOperatorContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#inList.
    def visitInList(self, ctx:PQLParser.InListContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#notInList.
    def visitNotInList(self, ctx:PQLParser.NotInListContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#isNull.
    def visitIsNull(self, ctx:PQLParser.IsNullContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#operator.
    def visitOperator(self, ctx:PQLParser.OperatorContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#valueList.
    def visitValueList(self, ctx:PQLParser.ValueListContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#arguments.
    def visitArguments(self, ctx:PQLParser.ArgumentsContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#stringValue.
    def visitStringValue(self, ctx:PQLParser.StringValueContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#numberValue.
    def visitNumberValue(self, ctx:PQLParser.NumberValueContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#identValue.
    def visitIdentValue(self, ctx:PQLParser.IdentValueContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#functionValue.
    def visitFunctionValue(self, ctx:PQLParser.FunctionValueContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#valueFunction.
    def visitValueFunction(self, ctx:PQLParser.ValueFunctionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#durationOffset.
    def visitDurationOffset(self, ctx:PQLParser.DurationOffsetContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by PQLParser#sign.
    def visitSign(self, ctx:PQLParser.SignContext):
        return self.visitChildren(ctx)



del PQLParser