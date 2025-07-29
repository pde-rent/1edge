import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import { THEME } from "@common/constants";

/**
 * BetBot CodeMirror Theme
 * Custom dark theme for the configuration editor
 * Using app theme colors from globals.css and constants.ts
 */

// Syntax highlighting style
export const betbotHighlightStyle = HighlightStyle.define([
  // JSON property names (keys) - light grey
  { tag: tags.propertyName, color: THEME.text.primary },

  // String values - secondary theme color
  { tag: tags.string, color: THEME.secondary },

  // Numeric and boolean values - primary theme color
  { tag: [tags.number, tags.bool, tags.null], color: THEME.primary },

  // Comments - grey and italic
  { tag: tags.comment, color: THEME.text.secondary, fontStyle: "italic" },

  // Punctuation, brackets, and operators - default text color
  {
    tag: [tags.punctuation, tags.bracket, tags.operator],
    color: THEME.text.primary,
  },

  // Keywords, class names, functions, attributes, and other content - default text color
  {
    tag: [
      tags.keyword,
      tags.className,
      tags.definition(tags.propertyName),
      tags.function(tags.variableName),
      tags.attributeName,
      tags.content,
    ],
    color: THEME.text.primary,
  },
]);

// Editor theme styling
export const betbotEditorTheme = EditorView.theme({
  // Ensure the scrollable code area uses the dark background
  ".cm-scroller": {
    backgroundColor: THEME.background.main,
  },
  "&": {
    backgroundColor: THEME.background.main,
    color: THEME.text.primary,
    height: "100%",
    fontSize: THEME.font.size.sm,
    fontFamily: THEME.font.family,
  },
  ".cm-content": {
    caretColor: THEME.primary,
    fontFamily: THEME.font.mono,
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: THEME.primary,
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: `${THEME.primary}33`, // 20% opacity version of primary color
  },
  ".cm-gutters": {
    backgroundColor: THEME.background.paper,
    color: THEME.text.secondary,
    border: "none",
    borderRight: `1px solid ${THEME.border}`,
    fontSize: THEME.font.size.sm,
    // width: "40px"
  },
  ".cm-lineNumbers": {
    color: THEME.text.secondary,
    fontSize: THEME.font.size.sm,
    backgroundColor: THEME.background.paper,
  },
  ".cm-activeLineGutter": {
    backgroundColor: THEME.background.main,
    color: THEME.secondary,
    // width: "40px"
  },
  ".cm-gutterElement": {
    padding: "0 8px 0 8px", // Better spacing for line numbers
  },
  ".cm-activeLine": {
    backgroundColor: `${THEME.background.paper}80`, // 50% opacity
  },
  // Ensure consistent line styling
  ".cm-line": {
    padding: "2px 4px",
  },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: `${THEME.primary}4D`, // 30% opacity
    color: THEME.text.primary,
    outline: `1px solid ${THEME.primary}80`, // 50% opacity
  },
});

// Combined theme export
export const betbotTheme = [
  syntaxHighlighting(betbotHighlightStyle),
  betbotEditorTheme,
];

export default betbotTheme;
