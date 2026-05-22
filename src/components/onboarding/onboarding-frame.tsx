import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { APP_NAME, APP_SLOGAN, APP_TAGLINE } from '@/constants/app';
import { type Href, router } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

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
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, gap: 20, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <View className="min-h-48 justify-end gap-3">
          <Text variant="h1" className="text-left">
            {APP_NAME}
          </Text>
          <Text variant="lead">{APP_SLOGAN}</Text>
          <Text className="text-primary text-lg font-semibold">{APP_TAGLINE}</Text>
        </View>
        <Text variant="h3">{title}</Text>
        <View className="flex-1 gap-3">{children}</View>
        <Button size="lg" onPress={handleNext}>
          <Text>{nextLabel}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
