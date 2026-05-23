import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ArkBrandLockup, Arky } from '@/components/brand/ark-logo';
import { APP_TAGLINE } from '@/constants/app';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { type Href, router } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp } from 'react-native-reanimated';

export function OnboardingFrame({
  title,
  children,
  nextHref,
  nextLabel = 'Continue',
  onNext,
}: {
  title: string;
  children: React.ReactNode;
  nextHref?: Href;
  nextLabel?: string;
  onNext?: () => Promise<boolean | void> | boolean | void;
}) {
  const [motionEnabled, setMotionEnabled] = React.useState(true);

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
        contentContainerStyle={{ padding: 20, gap: 20, flexGrow: 1 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <Animated.View
          className="min-h-48 justify-end gap-3"
          entering={
            motionEnabled ? FadeInDown.duration(280).easing(Easing.out(Easing.quad)) : undefined
          }>
          <Arky compact size={72} />
          <ArkBrandLockup />
          <Text className="text-primary text-lg font-semibold">{APP_TAGLINE}</Text>
        </Animated.View>
        <Text variant="h3">{title}</Text>
        <Animated.View
          className="flex-1 gap-3"
          entering={
            motionEnabled ? FadeInUp.duration(260).easing(Easing.out(Easing.quad)) : undefined
          }>
          {children}
        </Animated.View>
        <Button size="lg" onPress={handleNext}>
          <Text>{nextLabel}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
