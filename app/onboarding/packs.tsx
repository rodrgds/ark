import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { STARTER_PACKS } from '@/constants/packs';
import { ContentPackService } from '@/services/content/content-pack.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import * as React from 'react';

export default function PacksScreen() {
  const [selected, setSelected] = React.useState(
    () => new Set(STARTER_PACKS.slice(0, 3).map((pack) => pack.id))
  );

  async function saveSelection() {
    for (const pack of STARTER_PACKS.filter((item) => selected.has(item.id))) {
      await ContentPackService.installMockPack(pack.id, pack.title);
    }
    await SettingsRepository.updateOnboardingState({ hasSelectedPacks: true });
  }

  return (
    <OnboardingFrame title="Starter packs" nextHref="/onboarding/finish" onNext={saveSelection}>
      {STARTER_PACKS.map((pack) => (
        <Card key={pack.id} className="gap-2">
          <Text variant="large">{pack.title}</Text>
          <Text variant="muted">{pack.description}</Text>
          <Text className="text-primary text-sm">
            {pack.category} · {pack.estimatedSize}
          </Text>
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
