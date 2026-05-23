import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { STARTER_PACKS } from '@/constants/packs';
import { ContentPackService } from '@/services/content/content-pack.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import type { ContentPack, ContentPackManifest } from '@/types/content';
import type { LucideIcon } from 'lucide-react-native';
import { Book, Bot, Check, Globe, Shield } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const RECOMMENDED_PACK_IDS = [
  'hesperian-first-aid',
  'us-army-survival-fm-21-76',
  'wikipedia-en-top100-nopic',
];

const CATEGORY_ICONS: Partial<Record<ContentPack['category'], LucideIcon>> = {
  Medical: Book,
  Survival: Shield,
  Wiki: Globe,
  'AI Models': Bot,
};

export default function PacksScreen() {
  const [selected, setSelected] = React.useState(() => new Set(RECOMMENDED_PACK_IDS));

  async function saveSelection() {
    for (const pack of STARTER_PACKS.filter((item) => selected.has(item.id))) {
      await ContentPackService.installPack(pack.id);
    }
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

  return (
    <OnboardingFrame title="Offline Intelligence" nextHref="/onboarding/finish" onNext={saveSelection} hideBranding arkyPose="resourceful">
      <View className="gap-6">
        <View className="bg-primary/10 border-primary/20 rounded-2xl border p-4">
          <Text className="text-primary font-semibold">Recommended Downloads</Text>
          <Text variant="muted" className="mt-1 text-sm">
            Arky starts with essential, low-footprint packs. You can download multi-GB Wikipedia archives and LLMs later from the Library.
          </Text>
        </View>

        {Object.entries(packsByCategory).map(([category, packs]) => (
          <View key={category} className="gap-3">
            <View className="flex-row items-center gap-2 px-1">
              <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                {category}
              </Text>
            </View>
            
            <View className="gap-3">
              {packs.map((pack) => (
                <PackCard 
                  key={pack.id} 
                  pack={pack} 
                  isSelected={selected.has(pack.id)}
                  onToggle={() => setSelected(current => {
                    const next = new Set(current);
                    if (next.has(pack.id)) next.delete(pack.id);
                    else next.add(pack.id);
                    return next;
                  })}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </OnboardingFrame>
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
  const CategoryIcon = CATEGORY_ICONS[pack.category] || Book;

  return (
    <Pressable onPress={onToggle}>
      <Card
        className={`gap-3 p-4 ${isSelected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
        <View className="flex-row items-start gap-3">
          <View
            className={`mt-1 h-10 w-10 items-center justify-center rounded-xl ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon
              as={CategoryIcon}
              className={isSelected ? 'text-primary size-5' : 'text-muted-foreground size-5'}
            />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 font-bold">{pack.title}</Text>
              <Text className="text-muted-foreground text-xs">{pack.estimatedSize}</Text>
            </View>
            <Text variant="muted" className="text-sm" numberOfLines={2}>
              {pack.description}
            </Text>
          </View>

          <View
            className={`h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
            {isSelected && <Icon as={Check} className="text-primary-foreground size-3.5" />}
          </View>
        </View>

        {pack.disclaimer && isSelected && (
          <View className="bg-destructive/10 rounded-lg p-2">
            <Text className="text-destructive text-xs italic">{pack.disclaimer}</Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
