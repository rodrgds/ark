import { TextClassContext } from '@/components/ui/text';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary active:bg-primary/90 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-primary/90' })
        ),
        destructive: cn(
          'bg-destructive active:bg-destructive/90 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-destructive/90' })
        ),
        outline: cn(
          'border-border bg-background active:bg-accent border shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-accent' })
        ),
        secondary: cn(
          'bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-secondary/80' })
        ),
        ghost: cn('active:bg-accent', Platform.select({ web: 'hover:bg-accent' })),
        link: '',
      },
      size: {
        default: cn('h-12 px-4 py-2 sm:h-10', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn(
          'h-10 gap-1.5 rounded-md px-3 sm:h-9',
          Platform.select({ web: 'has-[>svg]:px-2.5' })
        ),
        lg: cn('h-14 rounded-md px-6 sm:h-12', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-12 w-12 sm:h-10 sm:w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const buttonTextVariants = cva('text-foreground text-base font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-white',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary',
    },
    size: {
      default: '',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: '',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, onPressIn, onPressOut, style, ...props }: ButtonProps) {
  const motionEnabled = useMotionEnabled();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = React.useCallback<NonNullable<ButtonProps['onPressIn']>>(
    (event) => {
      if (motionEnabled && !props.disabled) {
        scale.value = withTiming(0.98, {
          duration: 90,
          easing: Easing.out(Easing.quad),
        });
      }
      onPressIn?.(event);
    },
    [motionEnabled, onPressIn, props.disabled, scale]
  );

  const handlePressOut = React.useCallback<NonNullable<ButtonProps['onPressOut']>>(
    (event) => {
      if (motionEnabled) {
        scale.value = withTiming(1, {
          duration: 140,
          easing: Easing.out(Easing.quad),
        });
      }
      onPressOut?.(event);
    },
    [motionEnabled, onPressOut, scale]
  );

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <AnimatedPressable
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        style={[animatedStyle, style]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Button };
export type { ButtonProps };
