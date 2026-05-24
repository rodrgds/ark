import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import {
  getOrderedContentCategories,
  getPackIcon,
  getPackModelRoleLabel,
} from '@/constants/pack-presentation';
import { STARTER_PACKS } from '@/constants/packs';
import { ContentPackService } from '@/services/content/content-pack.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import type { ContentPackManifest } from '@/types/content';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const RECOMMENDED_PACK_IDS = [
  'hesperian-first-aid',
  'us-army-survival-fm-21-76',
  'wikipedia-en-top100-nopic',
];

export default function PacksScreen() {
  const [selected, setSelected] = React.useState(() => new Set(RECOMMENDED_PACK_IDS));

  async function saveSelection() {
    await Promise.allSettled(
      STARTER_PACKS.filter((item) => selected.has(item.id)).map((pack) =>
        ContentPackService.installPack(pack.id)
      )
    );
    await SettingsRepository.updateOnboardingState({ hasSelectedPacks: true });
  }

  const packsByCategory = React.useMemo(() => {
    const groups: Record<string, ContentPackManifest[]> = {};
    for (const pack of STARTER_PACKS) {
      if (!groups[pack.category]) groups[pack.category] = [];
      groups[pack.category].push(pack);
    }
    return groups;
  }, []);
  const orderedCategories = React.useMemo(() => getOrderedContentCategories(STARTER_PACKS), []);
  const contentCategories = orderedCategories.filter((category) => category !== 'AI Models');

  return (
    <OnboardingFrame
      title="Starter Library"
      nextHref="/onboarding/models"
      nextLabel="Continue"
      onNext={saveSelection}
      hideBranding
      arkyPose="resourceful"
      step={6}
      totalSteps={8}>
      <View className="gap-4">
        <Text className="text-foreground leading-6">
          Choose a few references to keep available offline. You can add larger archives later from
          the Library.
        </Text>

        {contentCategories.map((category) => {
          const packs = packsByCategory[category] ?? [];
          return (
            <View key={category} className="gap-2">
              <CategoryHeader title={category} />
              <View className="gap-2">
                {packs.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    isSelected={selected.has(pack.id)}
                    onToggle={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(pack.id)) next.delete(pack.id);
                        else next.add(pack.id);
                        return next;
                      })
                    }
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}

function CategoryHeader({ title }: { title: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
        {title}
      </Text>
      <View className="bg-muted h-px flex-1" />
    </View>
  );
}

function PackCard({
  pack,
  isSelected,
  onToggle,
}: {
  pack: ContentPackManifest;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const PackIcon = getPackIcon(pack);
  const modelRoleLabel = getPackModelRoleLabel(pack);

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Card
        className={`flex-row items-center gap-3 p-3 ${isSelected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
        <View
          className={`h-9 w-9 items-center justify-center rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
          <Icon
            as={PackIcon}
            className={isSelected ? 'text-primary size-4' : 'text-muted-foreground size-4'}
          />
        </View>

        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold">{pack.title}</Text>
            <Text className="text-muted-foreground text-xs">{pack.estimatedSize}</Text>
          </View>
          {modelRoleLabel ? (
            <Text className="text-primary text-[11px] font-medium">{modelRoleLabel}</Text>
          ) : null}
          <Text variant="muted" className="text-xs leading-4" numberOfLines={2}>
            {pack.description}
          </Text>
        </View>

        <View
          className={`h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
          {isSelected && <Icon as={Check} className="text-primary-foreground size-3" />}
        </View>
      </Card>
    </Pressable>
  );
}
