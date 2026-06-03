import { NAV_COLORS } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { Linking, Platform } from 'react-native';
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from 'react-native-enriched-markdown';

type MarkdownTextProps = {
  children: string;
  streaming?: boolean;
};

const markdownFlags = { latexMath: false };

export function MarkdownText({ children, streaming = false }: MarkdownTextProps) {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_COLORS[theme];
  const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

  const markdownStyle = React.useMemo<MarkdownStyle>(
    () => ({
      paragraph: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 8,
      },
      h1: {
        color: colors.foreground,
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 31,
        marginBottom: 8,
        marginTop: 10,
      },
      h2: {
        color: colors.foreground,
        fontSize: 21,
        fontWeight: '700',
        lineHeight: 28,
        marginBottom: 8,
        marginTop: 10,
      },
      h3: {
        color: colors.foreground,
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 25,
        marginBottom: 6,
        marginTop: 8,
      },
      strong: {
        color: colors.foreground,
        fontWeight: 'bold',
      },
      em: {
        color: colors.foreground,
        fontStyle: 'italic',
      },
      link: {
        color: colors.primary,
        underline: true,
      },
      list: {
        color: colors.foreground,
        fontSize: 16,
        gapWidth: 8,
        lineHeight: 24,
        marginBottom: 8,
        marginLeft: 18,
        markerColor: colors.mutedForeground,
      },
      code: {
        backgroundColor: colors.background,
        borderColor: colors.border,
        color: colors.primary,
        fontFamily: monoFont,
        fontSize: 14,
      },
      codeBlock: {
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        color: colors.foreground,
        fontFamily: monoFont,
        fontSize: 14,
        marginBottom: 10,
        padding: 10,
      },
      blockquote: {
        borderColor: colors.primary,
        borderWidth: 3,
        color: colors.mutedForeground,
        fontSize: 16,
        gapWidth: 10,
        lineHeight: 24,
        marginBottom: 10,
      },
      thematicBreak: {
        color: colors.border,
        height: 1,
        marginBottom: 12,
        marginTop: 12,
      },
      table: {
        borderColor: colors.border,
        borderRadius: 6,
        cellPaddingHorizontal: 10,
        cellPaddingVertical: 8,
        color: colors.foreground,
        fontSize: 14,
        headerBackgroundColor: colors.border,
        headerTextColor: colors.foreground,
        rowEvenBackgroundColor: colors.card,
        rowOddBackgroundColor: colors.background,
      },
    }),
    [colors, monoFont]
  );

  const commonProps = {
    allowTrailingMargin: false,
    markdown: children,
    markdownStyle,
    md4cFlags: markdownFlags,
    onLinkPress: ({ url }: { url: string }) => {
      void Linking.openURL(url);
    },
    selectable: true,
  };

  return (
    <EnrichedMarkdownText
      {...commonProps}
      flavor={streaming ? 'commonmark' : 'github'}
      streamingAnimation={streaming}
    />
  );
}
