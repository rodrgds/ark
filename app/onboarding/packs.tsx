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
  'embedding-nomic-v15-q4-k-m',
];

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
  const orderedCategories = React.useMemo(() => getOrderedContentCategories(STARTER_PACKS), []);

  return (
    <OnboardingFrame
      title="Offline Intelligence"
      nextHref="/onboarding/finish"
      nextLabel="Finish Setup"
      onNext={saveSelection}
      hideBranding
      arkyPose="resourceful"
      step={6}
      totalSteps={7}>
      <View className="gap-4">
        <Text className="text-foreground leading-6">
          Arky starts with lightweight essentials. Large archives and AI models can be added later
          from the Library.
        </Text>

        <View className="bg-muted/50 rounded-xl p-4 gap-2">
          <Text className="text-sm font-semibold">How the AI downloads work</Text>
          <Text variant="muted" className="text-xs leading-relaxed">
            <Text className="text-primary font-medium">Search / RAG models</Text> help Ark find the
            right passages in your guides, notes, and imported documents before it answers.
          </Text>
          <Text variant="muted" className="text-xs leading-relaxed">
            <Text className="text-primary font-medium">Chat models</Text> write the full reply you
            read in the chat screen.
          </Text>
          <Text variant="muted" className="text-xs leading-relaxed">
            Most people only need <Text className="text-primary font-medium">one search model</Text>{' '}
            and, if they want local chat, <Text className="text-primary font-medium">one chat model</Text>.
          </Text>
        </View>

        {orderedCategories.map((category) => {
          const packs = packsByCategory[category] ?? [];
          if (category === 'AI Models') {
            const embeddingPacks = packs.filter((pack) => pack.modelRole === 'embedding');
            const chatPacks = packs.filter((pack) => pack.modelRole === 'chat');
            return (
              <View key={category} className="gap-3">
                <CategoryHeader title={category} />
                <ModelGroup
                  title="Search / RAG models"
                  description="Needed for better retrieval from your offline library."
                  packs={embeddingPacks}
                  selected={selected}
                  setSelected={setSelected}
                />
                <ModelGroup
                  title="Chat models"
                  description="Used for full text replies in Ark chat. Larger and optional."
                  packs={chatPacks}
                  selected={selected}
                  setSelected={setSelected}
                />
              </View>
            );
          }

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
      <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
        {title}
      </Text>
      <View className="bg-muted h-px flex-1" />
    </View>
  );
}

function ModelGroup({
  title,
  description,
  packs,
  selected,
  setSelected,
}: {
  title: string;
  description: string;
  packs: ContentPackManifest[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  if (!packs.length) return null;

  return (
    <View className="gap-2">
      <View className="gap-1">
        <Text className="text-sm font-semibold">{title}</Text>
        <Text variant="muted" className="text-xs leading-relaxed">
          {description}
        </Text>
      </View>
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
    <Pressable onPress={onToggle}>
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
