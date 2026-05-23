import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { STARTER_PACKS } from '@/constants/packs';
import { ContentPackService } from '@/services/content/content-pack.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import * as React from 'react';
import { View } from 'react-native';

const RECOMMENDED_PACK_IDS = [
  'hesperian-first-aid',
  'us-army-survival-fm-21-76',
  'wikipedia-en-top100-nopic',
];

export default function PacksScreen() {
  const [selected, setSelected] = React.useState(() => new Set(RECOMMENDED_PACK_IDS));

  async function saveSelection() {
    for (const pack of STARTER_PACKS.filter((item) => selected.has(item.id))) {
      await ContentPackService.installPack(pack.id);
    }
    await SettingsRepository.updateOnboardingState({ hasSelectedPacks: true });
  }

  return (
    <OnboardingFrame title="Starter packs" nextHref="/onboarding/finish" onNext={saveSelection}>
      <Card className="gap-2">
        <Text variant="large">Recommended first download</Text>
        <Text variant="muted">
          Arky starts with small, useful packs. Larger Wikipedia and model files are easier to
          manage from Library when you can see storage and progress.
        </Text>
      </Card>
      {STARTER_PACKS.map((pack) => (
        <Card key={pack.id} className="gap-3">
          <View className="gap-1">
            <Text variant="large">{pack.title}</Text>
            <Text variant="muted">{pack.description}</Text>
            <Text className="text-primary text-sm">
              {pack.category} · {pack.estimatedSize}
            </Text>
          </View>
          {pack.disclaimer ? (
            <Text className="text-destructive text-sm">{pack.disclaimer}</Text>
          ) : null}
          <Button
            variant={selected.has(pack.id) ? 'default' : 'outline'}
            onPress={() =>
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(pack.id)) next.delete(pack.id);
                else next.add(pack.id);
                return next;
              })
            }>
            <Text>{selected.has(pack.id) ? 'Selected' : 'Select'}</Text>
          </Button>
        </Card>
      ))}
    </OnboardingFrame>
  );
}
