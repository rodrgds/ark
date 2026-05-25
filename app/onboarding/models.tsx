import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { getPackIcon, getPackModelRoleLabel } from '@/constants/pack-presentation';
import { STARTER_PACKS } from '@/constants/packs';
import { ContentPackService } from '@/services/content/content-pack.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { PreferencesService, type InterfaceMode } from '@/services/preferences/preferences.service';
import type { ContentPackManifest } from '@/types/content';
import type { LucideIcon } from 'lucide-react-native';
import { Check, MessageSquareText, ScanSearch } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const RECOMMENDED_MODEL_IDS = ['embedding-nomic-v15-q4-k-m'];
const MODEL_PACKS = STARTER_PACKS.filter(
  (pack) => !pack.testOnly && pack.category === 'AI Models'
);

export default function ModelsScreen() {
  const [selected, setSelected] = React.useState(() => new Set(RECOMMENDED_MODEL_IDS));
  const [interfaceMode, setInterfaceMode] = React.useState<InterfaceMode>('simple');

  React.useEffect(() => {
    PreferencesService.getInterfaceMode().then(setInterfaceMode).catch(() => undefined);
  }, []);

  async function saveSelection() {
    await Promise.allSettled(
      MODEL_PACKS.filter((item) => selected.has(item.id)).map((pack) =>
        ContentPackService.installPack(pack.id)
      )
    );
    await SettingsRepository.updateOnboardingState({ hasSelectedPacks: true });
  }

  const searchModels = MODEL_PACKS.filter((pack) => pack.modelRole === 'embedding');
  const chatModels = MODEL_PACKS.filter((pack) => pack.modelRole === 'chat');

  return (
    <OnboardingFrame
      title={interfaceMode === 'technical' ? 'Local Models' : 'Offline Intelligence'}
      nextHref="/onboarding/finish"
      nextLabel="Finish Setup"
      onNext={saveSelection}
      hideBranding
      arkyPose="resourceful"
      step={7}
      totalSteps={8}>
      <View className="gap-4">
        <Text className="text-foreground leading-6">
          {interfaceMode === 'technical'
            ? 'Models are optional downloads. Pick one search model now, add chat models later if your phone has enough storage and memory.'
            : 'These optional downloads help Arky search your offline library and write answers without a signal. Start small; you can add more later.'}
        </Text>

        <View className="gap-4">
          <ModelCategory
            icon={ScanSearch}
            title={interfaceMode === 'technical' ? 'Search models' : 'Source search'}
            description="Help Ark find relevant passages in guides, notes, and documents."
            note="Recommended: one"
          />
          <ModelCategory
            icon={MessageSquareText}
            title={interfaceMode === 'technical' ? 'Chat models' : 'Answer writing'}
            description="Write full local replies. Larger, slower, and optional."
            note="Optional"
          />
        </View>

        <ModelGroup
          title={interfaceMode === 'technical' ? 'Search models' : 'Source search'}
          packs={searchModels}
          selected={selected}
          setSelected={setSelected}
          interfaceMode={interfaceMode}
        />
        <ModelGroup
          title={interfaceMode === 'technical' ? 'Chat models' : 'Answer writing'}
          packs={chatModels}
          selected={selected}
          setSelected={setSelected}
          interfaceMode={interfaceMode}
        />
      </View>
    </OnboardingFrame>
  );
}

function ModelCategory({
  icon,
  title,
  description,
  note,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  note: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="bg-muted size-8 items-center justify-center rounded-md">
        <Icon as={icon} className="text-primary size-4" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-sm font-semibold">{title}</Text>
          <Text className="text-primary text-xs font-medium">{note}</Text>
        </View>
        <Text variant="muted" className="text-xs leading-4">
          {description}
        </Text>
      </View>
    </View>
  );
}

function ModelGroup({
  title,
  packs,
  selected,
  setSelected,
  interfaceMode,
}: {
  title: string;
  packs: ContentPackManifest[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  interfaceMode: InterfaceMode;
}) {
  if (!packs.length) return null;

  return (
    <View className="gap-2">
      <CategoryHeader title={title} />
      {packs.map((pack) => (
        <ModelPackCard
          key={pack.id}
          pack={pack}
          isSelected={selected.has(pack.id)}
          interfaceMode={interfaceMode}
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

function ModelPackCard({
  pack,
  isSelected,
  interfaceMode,
  onToggle,
}: {
  pack: ContentPackManifest;
  isSelected: boolean;
  interfaceMode: InterfaceMode;
  onToggle: () => void;
}) {
  const PackIcon = getPackIcon(pack);
  const modelRoleLabel = getPackModelRoleLabel(pack);
  const simple = getSimpleModelPresentation(pack);
  const showTechnical = interfaceMode === 'technical';

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
            <Text className="flex-1 text-sm font-semibold">
              {showTechnical ? pack.title : simple.title}
            </Text>
            <Text className="text-muted-foreground text-xs">{pack.estimatedSize}</Text>
          </View>
          {showTechnical && modelRoleLabel ? (
            <Text className="text-primary text-[11px] font-medium">{modelRoleLabel}</Text>
          ) : null}
          <Text variant="muted" className="text-xs leading-4" numberOfLines={2}>
            {showTechnical ? pack.description : simple.description}
          </Text>
        </View>

        <View
          className={`h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
          {isSelected && <Icon as={Check} className="text-primary-foreground size-3" />}
        </View>
      </Card>
    </Pressable>
  );
}

function getSimpleModelPresentation(pack: ContentPackManifest) {
  switch (pack.id) {
    case 'embedding-nomic-v15-q4-k-m':
      return {
        title: 'Recommended source search',
        description: 'Small download. Helps Arky find matching passages in your offline library.',
      };
    case 'embedding-qwen3-06b-q8':
      return {
        title: 'Multilingual source search',
        description: 'Larger download. Better for mixed English and Portuguese libraries.',
      };
    case 'model-smollm2-17b-q4-0':
      return {
        title: 'Light offline answer writer',
        description: 'Compact option for short local replies on phones with limited space.',
      };
    case 'model-qwen25-15b-q4-0':
      return {
        title: 'Balanced offline answer writer',
        description: 'Good first choice for local answers when your phone has enough room.',
      };
    case 'model-gemma4-e2b-it-q4-k-m':
      return {
        title: 'Stronger offline answer writer',
        description: 'Bigger download for newer phones that can handle more capable local replies.',
      };
    case 'model-gemma4-e4b-it-q4-k-m':
      return {
        title: 'Highest-capacity offline answer writer',
        description: 'Largest option for newer devices with generous storage and memory.',
      };
    default:
      return {
        title: pack.modelRole === 'embedding' ? 'Offline source search' : 'Offline answer writer',
        description: pack.description,
      };
  }
}
