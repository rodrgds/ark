import { NAV_COLORS } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import Markdown, { type MarkdownIt } from 'react-native-markdown-display';

type MarkdownTextProps = {
  children: string;
};

export function MarkdownText({ children }: MarkdownTextProps) {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_COLORS[theme];

  return (
    <Markdown
      mergeStyle
      style={{
        body: {
          color: colors.foreground,
          fontSize: 16,
          lineHeight: 24,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: 8,
        },
        strong: {
          fontWeight: '700',
          color: colors.foreground,
        },
        em: {
          fontStyle: 'italic',
          color: colors.foreground,
        },
        bullet_list: {
          marginBottom: 8,
        },
        ordered_list: {
          marginBottom: 8,
        },
        list_item: {
          marginBottom: 4,
        },
        code_inline: {
          backgroundColor: colors.background,
          color: colors.primary,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 1,
        },
        fence: {
          backgroundColor: colors.background,
          color: colors.foreground,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 6,
          padding: 10,
          marginBottom: 10,
        },
        blockquote: {
          borderLeftColor: colors.primary,
          borderLeftWidth: 3,
          paddingLeft: 10,
          opacity: 0.9,
        },
      }}>
      {children}
    </Markdown>
  );
}

export type { MarkdownIt };
