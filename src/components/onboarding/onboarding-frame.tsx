import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArkBrandLockup, Arky, ArkyPose } from '@/components/brand/ark-logo';
import { APP_TAGLINE } from '@/constants/app';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { type Href, router } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OnboardingFrame({
  title,
  children,
  nextHref,
  nextLabel = 'Continue',
  onNext,
  hideBranding = false,
  arkyPose,
}: {
  title: string;
  children: React.ReactNode;
  nextHref?: Href;
  nextLabel?: string;
  onNext?: () => Promise<boolean | void> | boolean | void;
  hideBranding?: boolean;
  arkyPose?: ArkyPose;
}) {
  const [motionEnabled, setMotionEnabled] = React.useState(true);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    PreferencesService.getMotionEnabled().then(setMotionEnabled);
  }, []);

  async function handleNext() {
    const canContinue = await onNext?.();
    if (canContinue === false) return;
    if (nextHref) router.push(nextHref);
  }

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
          paddingTop: Math.max(24, insets.top),
          paddingBottom: Math.max(24, insets.bottom),
          paddingLeft: 24,
          paddingRight: 24,
          gap: 24,
          flexGrow: 1,
        }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        {!hideBranding && (
          <Animated.View
            className="gap-4 py-8"
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
            className="items-center py-4"
            entering={
              motionEnabled ? FadeInDown.duration(400).easing(Easing.out(Easing.quad)) : undefined
            }>
            <Arky pose={arkyPose} size={160} />
          </Animated.View>
        )}

        <View className="gap-2">
          <Text variant="h2">{title}</Text>
          <View className="bg-primary h-1 w-12 rounded-full" />
        </View>

        <Animated.View
          className="flex-1 gap-4"
          entering={
            motionEnabled ? FadeInUp.duration(400).easing(Easing.out(Easing.quad)) : undefined
          }>
          {children}
        </Animated.View>

        <View className="pt-4">
          <Button size="lg" onPress={handleNext} className="h-14 rounded-2xl">
            <Text className="text-lg font-semibold">{nextLabel}</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
