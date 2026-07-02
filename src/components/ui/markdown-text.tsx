import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';

type MarkdownTextProps = {
  children: string;
  streaming?: boolean;
  citationLinks?: Partial<Record<number, string>>;
  onLinkPress?: (url: string) => void;
};

const markdownFlags = { latexMath: false };

export function MarkdownText({
  children,
  streaming = false,
  citationLinks,
  onLinkPress,
}: MarkdownTextProps) {
  const colors = useThemeStore((state) => state.colors);
  const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });
  const router = useRouter();
  const markdown = React.useMemo(
    () => linkMarkdownCitationMarkers(children, citationLinks),
    [children, citationLinks]
  );

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
    markdown,
    markdownStyle,
    md4cFlags: markdownFlags,
    onLinkPress: ({ url }: { url: string }) => {
      if (onLinkPress) {
        onLinkPress(url);
        return;
      }
      if (/^https?:\/\//i.test(url)) {
        router.push({
          pathname: '/content/web-reader',
          params: { url },
        });
      } else if (!url.startsWith('file://')) {
        // Only try to open non-file external links (e.g. mailto, tel)
        void Linking.openURL(url);
      }
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

function linkMarkdownCitationMarkers(
  markdown: string,
  citationLinks?: Partial<Record<number, string>>
) {
  if (!citationLinks) return markdown;
  return markdown.replace(/(^|[^\]])\[(\d+)\](?!\()/g, (match, prefix, numberText) => {
    const href = citationLinks[Number(numberText)];
    if (!href) return match;
    return `${prefix}[[${numberText}]](${href})`;
  });
}
