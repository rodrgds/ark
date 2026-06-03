import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import type { MapPreset } from '@/constants/map-presets';
import { getUnsupportedMapPackReason } from '@/services/maps/map-pack-format';
import { startPresetRegionDownload } from '@/services/maps/map-region-downloads';
import { MapLocationService } from '@/services/maps/map-location.service';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { useThemeStore } from '@/stores/theme-store';
import { Check, Map } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

export default function MapsOnboardingScreen() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const [presets, setPresets] = React.useState<MapPreset[]>(() =>
    MapPresetsService.recommendedForLocation(null)
  );
  const [selected, setSelected] = React.useState(
    () => defaultSelectedPresetIds(MapPresetsService.recommendedForLocation(null))
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let canceled = false;
    async function loadRecommendations() {
      const [, position] = await Promise.all([
        MapPresetsService.refreshCatalog().catch(() => undefined),
        MapLocationService.getGrantedLocation().catch(() => null),
      ]);
      if (canceled) return;
      const nextPresets = MapPresetsService.recommendedForLocation(
        position
          ? {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }
          : null
      );
      setPresets(nextPresets);
      setSelected(defaultSelectedPresetIds(nextPresets));
    }
    loadRecommendations().catch(() => {
      if (!canceled) {
        const nextPresets = MapPresetsService.recommendedForLocation(null);
        setPresets(nextPresets);
        setSelected(defaultSelectedPresetIds(nextPresets));
      }
    });
    return () => {
      canceled = true;
    };
  }, []);

  async function startDownloads() {
    if (selected.size === 0) return true;
    setBusy(true);
    setError(null);
    try {
      for (const preset of presets.filter((item) => selected.has(item.id))) {
        const unsupportedReason = getUnsupportedMapPackReason(preset);
        if (unsupportedReason) throw new Error(unsupportedReason);
        const result = await startPresetRegionDownload(preset, { theme });
        if (!result.ok && !result.queued) {
          throw new Error(result.reason ?? 'Unable to start this map download.');
        }
      }
      return true;
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Unable to start map downloads.'
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  const nothingSelected = selected.size === 0;

  return (
    <OnboardingFrame
      title="Offline Maps"
      nextHref="/onboarding/power"
      nextLabel={nothingSelected ? 'Skip Maps' : 'Download'}
      hideBranding
      arkyPose="navigator"
      step={4}
      totalSteps={8}
      onNext={startDownloads}>
      <View className="gap-4">
        <Text className="text-foreground leading-6">
          Pick a region to download now. You can always add more from the Map tab later.
        </Text>

        <View className="gap-3">
          {presets.map((preset) => (
            <MapPresetCard
              key={preset.id}
              preset={preset}
              selected={selected.has(preset.id)}
              onToggle={() =>
                setSelected((current) => {
                  if (getUnsupportedMapPackReason(preset)) return current;
                  const next = new Set(current);
                  if (next.has(preset.id)) next.delete(preset.id);
                  else next.add(preset.id);
                  return next;
                })
              }
            />
          ))}
        </View>

        {busy ? (
          <View className="bg-muted/40 flex-row items-center gap-3 rounded-xl p-4">
            <ActivityIndicator />
            <Text variant="muted">Starting downloads…</Text>
          </View>
        ) : null}

        {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      </View>
    </OnboardingFrame>
  );
}

function defaultSelectedPresetIds(presets: MapPreset[]) {
  return new Set(
    presets
      .filter((preset) => !getUnsupportedMapPackReason(preset))
      .slice(0, 1)
      .map((preset) => preset.id)
  );
}

function MapPresetCard({
  preset,
  selected,
  onToggle,
}: {
  preset: MapPreset;
  selected: boolean;
  onToggle: () => void;
}) {
  const unsupportedReason = getUnsupportedMapPackReason(preset);
  return (
    <Pressable disabled={!!unsupportedReason} onPress={onToggle}>
      <Card
        className={`flex-row items-center gap-3 p-4 ${
          selected
            ? 'border-primary/50 bg-primary/5'
            : unsupportedReason
              ? 'opacity-70'
              : ''
        }`}>
        <View
          className={`h-10 w-10 items-center justify-center rounded-xl ${
            selected ? 'bg-primary/20' : 'bg-muted'
          }`}>
          <Icon as={selected ? Check : Map} className="text-primary size-5" />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-semibold">{preset.name}</Text>
            <Text className="text-muted-foreground text-xs">{preset.estimatedSize}</Text>
          </View>
          <Text variant="muted" className="text-sm" numberOfLines={1}>
            {unsupportedReason ?? preset.description}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
