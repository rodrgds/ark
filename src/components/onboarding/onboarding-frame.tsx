import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArkBrandLockup, Arky, ArkyPose } from '@/components/brand/ark-logo';
import { APP_TAGLINE } from '@/constants/app';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { useThemeStore } from '@/stores/theme-store';
import { type Href, router } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OnboardingFrame({
  title,
  children,
  nextHref,
  nextLabel = 'Continue',
  nextDisabled = false,
  onNext,
  hideBranding = false,
  arkyPose,
  step,
  totalSteps,
  skipLabel,
  skipHref,
  onSkip,
}: {
  title: string;
  children: React.ReactNode;
  nextHref?: Href;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => Promise<boolean | void> | boolean | void;
  hideBranding?: boolean;
  arkyPose?: ArkyPose;
  step?: number;
  totalSteps?: number;
  skipLabel?: string;
  skipHref?: Href;
  onSkip?: () => Promise<void> | void;
}) {
  const [motionEnabled, setMotionEnabled] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const insets = useSafeAreaInsets();
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const spinnerColor = effectiveTheme === 'light' ? '#FFFFFF' : '#0A0A0A';

  React.useEffect(() => {
    PreferencesService.getMotionEnabled().then(setMotionEnabled);
  }, []);

  async function handleNext() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const canContinue = await onNext?.();
      if (canContinue === false) return;
      if (nextHref) router.push(nextHref);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    await onSkip?.();
    if (skipHref) router.push(skipHref);
  }

  const progress =
    step && totalSteps && totalSteps > 0 ? Math.min(step / totalSteps, 1) : 0;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        className="bg-background flex-1"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: Math.max(40, insets.top),
          paddingBottom: Math.max(24, insets.bottom),
          paddingLeft: 24,
          paddingRight: 24,
          gap: 20,
          flexGrow: 1,
        }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        {/* Progress bar */}
        {progress > 0 && (
          <View className="gap-2">
            <View className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <View
                className="bg-primary h-1.5 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
            <Text className="text-muted-foreground text-xs font-medium">
              Step {step} of {totalSteps}
            </Text>
          </View>
        )}

        {!hideBranding && (
          <Animated.View
            className="gap-3 py-6"
            entering={
              motionEnabled ? FadeInDown.duration(400).easing(Easing.out(Easing.quad)) : undefined
            }>
            <ArkBrandLockup center />
            <Text variant="muted" className="text-center font-medium">
              {APP_TAGLINE}
            </Text>
          </Animated.View>
        )}

        {hideBranding && arkyPose && (
          <Animated.View
            className="items-center py-2"
            entering={
              motionEnabled ? FadeInDown.duration(400).easing(Easing.out(Easing.quad)) : undefined
            }>
            <Arky pose={arkyPose} size={140} />
          </Animated.View>
        )}

        <View className="gap-1">
          <Text variant="h2">{title}</Text>
          <View className="bg-primary h-1 w-10 rounded-full" />
        </View>

        <Animated.View
          className="flex-1 gap-3"
          entering={
            motionEnabled ? FadeInUp.duration(400).easing(Easing.out(Easing.quad)) : undefined
          }>
          {children}
        </Animated.View>

        <View className="gap-3 pt-2">
          <Button
            size="lg"
            onPress={handleNext}
            disabled={isLoading || nextDisabled}
            className="h-14 rounded-2xl">
            {isLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={spinnerColor} />
                <Text className="text-lg font-semibold">{nextLabel}</Text>
              </View>
            ) : (
              <Text className="text-lg font-semibold">{nextLabel}</Text>
            )}
          </Button>

          {(skipLabel || skipHref || onSkip) && (
            <Button variant="ghost" onPress={handleSkip} disabled={isLoading}>
              <Text className="text-muted-foreground text-sm font-medium">
                {skipLabel ?? 'Skip'}
              </Text>
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
