/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Image, Link, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ReactElement } from "react";
import { CORE_EXTENSIONS } from "@plane/editor";
import { isKeyOf } from "@/lib/is-key-of";
import { attrNumber, attrNumberArray, attrString } from "./attrs";
import { BACKGROUND_COLORS, EDITOR_BACKGROUND_COLORS, resolveColorForPdf, TEXT_COLORS } from "./colors";
import { CheckIcon, ClipboardIcon, DocumentIcon, GlobeIcon, LightbulbIcon, LinkIcon } from "./icons";
import { applyMarks } from "./mark-renderers";
import { pdfStyles } from "./styles";
import type { KeyGenerator, NodeRendererRegistry, PDFExportMetadata, PDFRenderContext, TipTapNode } from "./types";

const getCalloutIcon = (node: TipTapNode, color: string): ReactElement => {
  const logoInUse = attrString(node.attrs, "data-logo-in-use");
  const iconName = attrString(node.attrs, "data-icon-name");
  const iconColor = attrString(node.attrs, "data-icon-color") || color;

  if (logoInUse === "emoji") {
    const emojiUnicode = attrString(node.attrs, "data-emoji-unicode");
    if (emojiUnicode) {
      return <Text style={{ fontSize: 14 }}>{emojiUnicode}</Text>;
    }
  }

  if (iconName) {
    switch (iconName) {
      case "FileText":
      case "File":
        return <DocumentIcon size={16} color={iconColor} />;
      case "Link":
        return <LinkIcon size={16} color={iconColor} />;
      case "Globe":
        return <GlobeIcon size={16} color={iconColor} />;
      case "Clipboard":
        return <ClipboardIcon size={16} color={iconColor} />;
      case "CheckSquare":
      case "Check":
        return <CheckIcon size={16} color={iconColor} />;
      case "Lightbulb":
      default:
        return <LightbulbIcon size={16} color={iconColor} />;
    }
  }

  return <LightbulbIcon size={16} color={color} />;
};

export const createKeyGenerator = (): KeyGenerator => {
  let counter = 0;
  return () => `node-${counter++}`;
};

const renderTextWithMarks = (node: TipTapNode, getKey: KeyGenerator): ReactElement => {
  const style = applyMarks(node.marks, {});
  const hasLink = node.marks?.find((m) => m.type === "link");

  if (hasLink) {
    const href = attrString(hasLink.attrs, "href") || "#";
    return (
      <Link key={getKey()} src={href} style={{ ...pdfStyles.link, ...style }}>
        {node.text || ""}
      </Link>
    );
  }

  return (
    <Text key={getKey()} style={style}>
      {node.text || ""}
    </Text>
  );
};

const TEXT_ALIGNS = ["left", "right", "center", "justify"] as const;

const isTextAlign = (value: string): value is (typeof TEXT_ALIGNS)[number] =>
  TEXT_ALIGNS.some((align) => align === value);

const getTextAlignStyle = (textAlign: string | null | undefined): Style => {
  if (!textAlign) return {};
  return isTextAlign(textAlign) ? { textAlign } : {};
};

const getFlexAlignStyle = (textAlign: string | null | undefined): Style => {
  if (!textAlign) return {};
  if (textAlign === "right") return { alignItems: "flex-end" };
  if (textAlign === "center") return { alignItems: "center" };
  return {};
};

export const nodeRenderers: NodeRendererRegistry = {
  doc: (_node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <View key={ctx.getKey()}>{children}</View>
  ),

  text: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement =>
    renderTextWithMarks(node, ctx.getKey),

  paragraph: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const textAlign = attrString(node.attrs, "textAlign");
    const background = attrString(node.attrs, "backgroundColor");
    const alignStyle = getTextAlignStyle(textAlign);
    const flexStyle = getFlexAlignStyle(textAlign);
    const resolvedBgColor =
      background && background !== "default" ? resolveColorForPdf(background, "background") : null;
    const bgStyle = resolvedBgColor ? { backgroundColor: resolvedBgColor } : {};

    return (
      <View key={ctx.getKey()} style={[pdfStyles.paragraphWrapper, flexStyle, bgStyle]}>
        <Text style={[pdfStyles.paragraph, alignStyle, bgStyle]}>{children}</Text>
      </View>
    );
  },

  heading: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const level = attrNumber(node.attrs, "level") || 1;
    const styleKey = `heading${level}`;
    const style = isKeyOf(pdfStyles, styleKey) ? pdfStyles[styleKey] : pdfStyles.heading1;
    const textAlign = attrString(node.attrs, "textAlign");
    const alignStyle = getTextAlignStyle(textAlign);
    const flexStyle = getFlexAlignStyle(textAlign);

    return (
      <View key={ctx.getKey()} style={flexStyle}>
        <Text style={[style, alignStyle]}>{children}</Text>
      </View>
    );
  },

  blockquote: (_node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <View key={ctx.getKey()} style={pdfStyles.blockquote} wrap={false}>
      {children}
    </View>
  ),

  codeBlock: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const codeContent = node.content?.map((c) => c.text || "").join("") || "";
    return (
      <View key={ctx.getKey()} style={pdfStyles.codeBlock} wrap={false}>
        <Text>{codeContent}</Text>
      </View>
    );
  },

  bulletList: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const nestingLevel = attrNumber(node.attrs, "_nestingLevel") || 0;
    const indentStyle = nestingLevel > 0 ? { marginLeft: 18 } : {};
    return (
      <View key={ctx.getKey()} style={[pdfStyles.bulletList, indentStyle]}>
        {children}
      </View>
    );
  },

  orderedList: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const nestingLevel = attrNumber(node.attrs, "_nestingLevel") || 0;
    const indentStyle = nestingLevel > 0 ? { marginLeft: 18 } : {};
    return (
      <View key={ctx.getKey()} style={[pdfStyles.orderedList, indentStyle]}>
        {children}
      </View>
    );
  },

  listItem: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const isOrdered = node.attrs?._parentType === "orderedList";
    const index = attrNumber(node.attrs, "_listItemIndex") || 0;

    const bullet = isOrdered ? `${index}.` : "•";

    const textAlign = attrString(node.attrs, "_textAlign");
    const flexStyle = getFlexAlignStyle(textAlign);

    return (
      <View key={ctx.getKey()} style={[pdfStyles.listItem, flexStyle]} wrap={false}>
        <View style={pdfStyles.listItemBullet}>
          <Text>{bullet}</Text>
        </View>
        <View style={pdfStyles.listItemContent}>{children}</View>
      </View>
    );
  },

  taskList: (_node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <View key={ctx.getKey()} style={pdfStyles.taskList}>
      {children}
    </View>
  ),

  taskItem: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const checked = node.attrs?.checked === true;
    return (
      <View key={ctx.getKey()} style={pdfStyles.taskItem} wrap={false}>
        <View style={checked ? [pdfStyles.taskCheckbox, pdfStyles.taskCheckboxChecked] : pdfStyles.taskCheckbox}>
          {checked && <CheckIcon size={8} color="#ffffff" />}
        </View>
        <View style={pdfStyles.listItemContent}>{children}</View>
      </View>
    );
  },

  table: (_node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <View key={ctx.getKey()} style={pdfStyles.table}>
      {children}
    </View>
  ),

  tableRow: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const isHeader = node.attrs?._isHeader === true;
    return (
      <View key={ctx.getKey()} style={isHeader ? pdfStyles.tableHeaderRow : pdfStyles.tableRow} wrap={false}>
        {children}
      </View>
    );
  },

  tableHeader: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const colwidth = attrNumberArray(node.attrs, "colwidth");
    const background = attrString(node.attrs, "background");
    const width = colwidth?.[0];
    const widthStyle = width ? { width, flex: undefined } : {};
    const resolvedBgColor = background ? resolveColorForPdf(background, "background") : null;
    const bgStyle = resolvedBgColor ? { backgroundColor: resolvedBgColor } : {};

    return (
      <View key={ctx.getKey()} style={[pdfStyles.tableHeaderCell, widthStyle, bgStyle]}>
        {children}
      </View>
    );
  },

  tableCell: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const colwidth = attrNumberArray(node.attrs, "colwidth");
    const background = attrString(node.attrs, "background");
    const width = colwidth?.[0];
    const widthStyle = width ? { width, flex: undefined } : {};
    const resolvedBgColor = background ? resolveColorForPdf(background, "background") : null;
    const bgStyle = resolvedBgColor ? { backgroundColor: resolvedBgColor } : {};

    return (
      <View key={ctx.getKey()} style={[pdfStyles.tableCell, widthStyle, bgStyle]}>
        {children}
      </View>
    );
  },

  horizontalRule: (_node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <View key={ctx.getKey()} style={pdfStyles.horizontalRule} />
  ),

  hardBreak: (_node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <Text key={ctx.getKey()}>{"\n"}</Text>
  ),

  image: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    if (ctx.metadata?.noAssets) {
      return <View key={ctx.getKey()} />;
    }

    const src = attrString(node.attrs, "src") || "";
    const width = attrNumber(node.attrs, "width");
    const alignment = attrString(node.attrs, "alignment") || "left";

    if (!src) {
      return <View key={ctx.getKey()} />;
    }

    const alignmentStyle =
      alignment === "center"
        ? { alignItems: "center" as const }
        : alignment === "right"
          ? { alignItems: "flex-end" as const }
          : { alignItems: "flex-start" as const };

    return (
      <View key={ctx.getKey()} style={[{ width: "100%" }, alignmentStyle]}>
        <Image
          src={src}
          style={[pdfStyles.image, width ? { width, maxHeight: 500 } : { maxWidth: 400, maxHeight: 500 }]}
        />
      </View>
    );
  },

  imageComponent: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    if (ctx.metadata?.noAssets) {
      return <View key={ctx.getKey()} />;
    }

    const assetId = attrString(node.attrs, "src") || "";
    const rawWidth = node.attrs?.width;
    const width =
      typeof rawWidth === "string" ? parseInt(rawWidth, 10) : typeof rawWidth === "number" ? rawWidth : undefined;
    const alignment = attrString(node.attrs, "alignment") || "left";

    if (!assetId) {
      return <View key={ctx.getKey()} />;
    }

    let resolvedSrc = assetId;
    if (ctx.metadata?.resolvedImageUrls && ctx.metadata.resolvedImageUrls[assetId]) {
      resolvedSrc = ctx.metadata.resolvedImageUrls[assetId];
    }

    const alignmentStyle =
      alignment === "center"
        ? { alignItems: "center" as const }
        : alignment === "right"
          ? { alignItems: "flex-end" as const }
          : { alignItems: "flex-start" as const };

    if (!resolvedSrc.startsWith("http") && !resolvedSrc.startsWith("data:")) {
      return (
        <View key={ctx.getKey()} style={[pdfStyles.imagePlaceholder, alignmentStyle]}>
          <Text style={pdfStyles.imagePlaceholderText}>[Image: {assetId.slice(0, 8)}...]</Text>
        </View>
      );
    }

    const imageStyle = width && !isNaN(width) ? { width, maxHeight: 500 } : { maxWidth: 400, maxHeight: 500 };

    return (
      <View key={ctx.getKey()} style={[{ width: "100%" }, alignmentStyle]}>
        <Image src={resolvedSrc} style={[pdfStyles.image, imageStyle]} />
      </View>
    );
  },

  calloutComponent: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const backgroundKey = attrString(node.attrs, "data-background") || "gray";
    const backgroundColor =
      (isKeyOf(EDITOR_BACKGROUND_COLORS, backgroundKey) && EDITOR_BACKGROUND_COLORS[backgroundKey]) ||
      BACKGROUND_COLORS.layer3;

    return (
      <View key={ctx.getKey()} style={[pdfStyles.callout, { backgroundColor }]}>
        <View style={pdfStyles.calloutIconContainer}>{getCalloutIcon(node, TEXT_COLORS.primary)}</View>
        <View style={[pdfStyles.calloutContent, { color: TEXT_COLORS.primary }]}>{children}</View>
      </View>
    );
  },

  columnsComponent: (_node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => (
    <View key={ctx.getKey()} style={pdfStyles.columns}>
      {children}
    </View>
  ),

  columnComponent: (node: TipTapNode, children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const weight = attrNumber(node.attrs, "_columnWeight") || 1;
    return (
      <View key={ctx.getKey()} style={[pdfStyles.column, { flex: weight }]}>
        {children}
      </View>
    );
  },

  embedComponent: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const url = attrString(node.attrs, "url") || "";

    if (!url) {
      return <View key={ctx.getKey()} />;
    }

    // There is no browser to frame the embedded page in a PDF, so render the
    // URL itself as a link inside a bordered card, in place of an iframe.
    return (
      <View key={ctx.getKey()} style={pdfStyles.embed}>
        <Link src={url} style={pdfStyles.link}>
          {url}
        </Link>
      </View>
    );
  },

  mathInlineComponent: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const latex = attrString(node.attrs, "latex") || "";
    // There is no browser to run KaTeX in a PDF, so render the LaTeX source
    // itself as monospace text, the same fallback the codeBlock renderer uses.
    return (
      <Text key={ctx.getKey()} style={pdfStyles.mathInline}>
        {latex}
      </Text>
    );
  },

  mathBlockComponent: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const latex = attrString(node.attrs, "latex") || "";
    return (
      <View key={ctx.getKey()} style={pdfStyles.mathBlock} wrap={false}>
        <Text>{latex}</Text>
      </View>
    );
  },

  "query-block-component": (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const kind = attrString(node.attrs, "kind") || "recent";
    const labels = attrString(node.attrs, "labels") || "";

    // The query runs against live data, which a PDF has none of, so name the
    // listing rather than leaving a blank where a block used to be.
    return (
      <View key={ctx.getKey()} style={pdfStyles.embed}>
        <Text>{labels ? `Page list (${kind}: ${labels})` : `Page list (${kind})`}</Text>
      </View>
    );
  },

  "issue-embed-component": (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const workItemId = attrString(node.attrs, "entity_identifier") || "";

    // The card is built from live work item data, which a PDF has none of, so
    // name the embed rather than leaving a blank where a block used to be.
    return (
      <View key={ctx.getKey()} style={pdfStyles.embed}>
        <Text>{workItemId ? `Work item (${workItemId})` : "Work item"}</Text>
      </View>
    );
  },

  mention: (node: TipTapNode, _children: ReactElement[], ctx: PDFRenderContext): ReactElement => {
    const id = attrString(node.attrs, "id") || "";
    const entityIdentifier = attrString(node.attrs, "entity_identifier") || "";
    const entityName = attrString(node.attrs, "entity_name") || "";

    let displayText = entityName || id || entityIdentifier;

    if (ctx.metadata && (entityName === "user_mention" || entityName === "user")) {
      const userMention = ctx.metadata.userMentions?.find((u) => u.id === entityIdentifier || u.id === id);
      if (userMention) {
        displayText = userMention.display_name;
      }
    }

    return (
      <Text key={ctx.getKey()} style={pdfStyles.mention}>
        @{displayText}
      </Text>
    );
  },
};

type InternalRenderContext = {
  parentType?: string;
  nestingLevel: number;
  listItemIndex: number;
  textAlign?: string | null;
  columnWeight?: number;
  pdfContext: PDFRenderContext;
};

/**
 * `layout` is a dash-separated list of column weights, e.g. "1-2". Falls back
 * to equal weights when it is missing or names a different number of columns
 * than the block actually holds.
 */
const getColumnWeights = (layout: unknown, count: number): number[] => {
  if (typeof layout === "string") {
    const weights = layout
      .split("-")
      .filter((entry) => /^[1-9]\d*$/.test(entry))
      .map((entry) => parseInt(entry, 10));
    if (weights.length === count) return weights;
  }
  return Array.from({ length: count }, () => 1);
};

const renderNodeWithContext = (node: TipTapNode, context: InternalRenderContext): ReactElement => {
  const { parentType, nestingLevel, listItemIndex, textAlign, columnWeight, pdfContext } = context;

  const isListContainer = node.type === CORE_EXTENSIONS.BULLET_LIST || node.type === CORE_EXTENSIONS.ORDERED_LIST;
  const isColumnsContainer = node.type === CORE_EXTENSIONS.COLUMNS;

  let childTextAlign = textAlign;
  const paragraphAlign = attrString(node.attrs, "textAlign");
  if (node.type === CORE_EXTENSIONS.PARAGRAPH && paragraphAlign) {
    childTextAlign = paragraphAlign;
  }

  const nodeWithContext = {
    ...node,
    attrs: {
      ...node.attrs,
      _parentType: parentType,
      _nestingLevel: nestingLevel,
      _listItemIndex: listItemIndex,
      _textAlign: childTextAlign,
      _isHeader: node.content?.some((child) => child.type === CORE_EXTENSIONS.TABLE_HEADER),
      _columnWeight: columnWeight,
    },
  };

  let childNestingLevel = nestingLevel;
  if (isListContainer && parentType === CORE_EXTENSIONS.LIST_ITEM) {
    childNestingLevel = nestingLevel + 1;
  }

  const columnWeights = isColumnsContainer ? getColumnWeights(node.attrs?.layout, node.content?.length ?? 0) : [];

  let currentListItemIndex = 0;
  const children: ReactElement[] =
    node.content?.map((child, index) => {
      const childContext: InternalRenderContext = {
        parentType: node.type,
        nestingLevel: childNestingLevel,
        listItemIndex: 0,
        textAlign: childTextAlign,
        columnWeight: isColumnsContainer ? columnWeights[index] : undefined,
        pdfContext,
      };

      if (isListContainer && child.type === CORE_EXTENSIONS.LIST_ITEM) {
        currentListItemIndex++;
        childContext.listItemIndex = currentListItemIndex;
      }

      return renderNodeWithContext(child, childContext);
    }) || [];

  const renderer = nodeRenderers[node.type];
  if (renderer) {
    return renderer(nodeWithContext, children, pdfContext);
  }

  if (children.length > 0) {
    return <View key={pdfContext.getKey()}>{children}</View>;
  }

  return <View key={pdfContext.getKey()} />;
};

export const renderNode = (
  node: TipTapNode,
  parentType?: string,
  _index?: number,
  metadata?: PDFExportMetadata,
  getKey?: KeyGenerator
): ReactElement => {
  const keyGen = getKey ?? createKeyGenerator();

  return renderNodeWithContext(node, {
    parentType,
    nestingLevel: 0,
    listItemIndex: 0,
    pdfContext: { getKey: keyGen, metadata },
  });
};
