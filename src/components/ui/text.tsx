import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva(cn('text-foreground text-base', Platform.select({ web: 'select-text' })), {
  variants: {
    variant: {
      default: '',
      h1: cn('text-4xl font-extrabold tracking-normal', Platform.select({ web: 'text-balance' })),
      h2: 'text-3xl font-semibold tracking-normal',
      h3: 'text-2xl font-semibold tracking-normal',
      h4: 'text-xl font-semibold tracking-normal',
      p: 'leading-7',
      blockquote: 'border-border border-l-2 pl-3 italic',
      code: 'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
      lead: 'text-muted-foreground text-xl',
      large: 'text-lg font-semibold',
      small: 'text-sm leading-none font-medium',
      muted: 'text-muted-foreground text-sm',
    },
  },
  defaultVariants: { variant: 'default' },
});

type TextVariantProps = VariantProps<typeof textVariants>;
type TextVariant = NonNullable<TextVariantProps['variant']>;

// SAFETY: the blockquote and code roles are web-only RN accessibility roles,
// which is why they are gated behind Platform.select like the original map.
const ROLE = new Map<TextVariant, Role>([
  ['h1', 'heading'],
  ['h2', 'heading'],
  ['h3', 'heading'],
  ['h4', 'heading'],
  ...(Platform.select({ web: [['blockquote', 'blockquote' as Role] as [TextVariant, Role]] }) ??
    []),
  ...(Platform.select({ web: [['code', 'code' as Role] as [TextVariant, Role]] }) ?? []),
]);

const ARIA_LEVEL = new Map<TextVariant, string>([
  ['h1', '1'],
  ['h2', '2'],
  ['h3', '3'],
  ['h4', '4'],
]);

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & { asChild?: boolean }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE.get(variant) : undefined}
      aria-level={variant ? ARIA_LEVEL.get(variant) : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
