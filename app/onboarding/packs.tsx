import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { STARTER_PACKS, type ContentPack } from '@/constants/packs';
import { ContentPackService } from '@/services/content/content-pack.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { Book, Shield, Globe, Cpu, Check } from '@/components/ui/icon';

const RECOMMENDED_PACK_IDS = [
  'hesperian-first-aid',
  'us-army-survival-fm-21-76',
  'wikipedia-en-top100-nopic',
];

const CATEGORY_ICONS: Record<string, any> = {
  'Medical': Book,
  'Survival': Shield,
  'Encyclopedia': Globe,
  'AI Model': Cpu,
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
    const groups: Record<string, ContentPack[]> = {};
    for (const pack of STARTER_PACKS) {
      if (!groups[pack.category]) groups[pack.category] = [];
      groups[pack.category].push(pack);
    }
    return groups;
  }, []);

  return (
    <OnboardingFrame title="Offline Intelligence" nextHref="/onboarding/finish" onNext={saveSelection} hideBranding>
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

function PackCard({ pack, isSelected, onToggle }: { pack: ContentPack, isSelected: boolean, onToggle: () => void }) {
  const Icon = CATEGORY_ICONS[pack.category] || Book;

  return (
    <Card 
      className={`p-4 gap-3 ${isSelected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
      onPress={onToggle}
    >
      <View className="flex-row items-start gap-3">
        <View className={`mt-1 h-10 w-10 items-center justify-center rounded-xl ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
          <Icon size={20} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
        </View>
        
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold">{pack.title}</Text>
            <Text className="text-muted-foreground text-xs">{pack.estimatedSize}</Text>
          </View>
          <Text variant="muted" className="text-sm" numberOfLines={2}>
            {pack.description}
          </Text>
        </View>

        <View className={`h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
          {isSelected && <Check size={14} className="text-primary-foreground" />}
        </View>
      </View>
      
      {pack.disclaimer && isSelected && (
        <View className="bg-destructive/10 rounded-lg p-2">
          <Text className="text-destructive text-xs italic">{pack.disclaimer}</Text>
        </View>
      )}
    </Card>
  );
}
