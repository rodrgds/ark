import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import type { MapPreset } from '@/constants/map-presets';
import { MapService } from '@/services/maps/map.service';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { useThemeStore } from '@/stores/theme-store';
import * as Location from 'expo-location';
import { Check, Download, Map } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

export default function MapsOnboardingScreen() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const [presets, setPresets] = React.useState<MapPreset[]>(() =>
    MapPresetsService.recommendedForLocation(null)
  );
  const [selected, setSelected] = React.useState(() => new Set(['portugal-overview']));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let canceled = false;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) return null;
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      })
      .then((position) => {
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
        setSelected(new Set(nextPresets.slice(0, 1).map((preset) => preset.id)));
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, []);

  async function startDownloads() {
    setBusy(true);
    setError(null);
    try {
      for (const preset of presets.filter((item) => selected.has(item.id))) {
        const id = await OfflineMapService.createRegionDownload({
          name: preset.name,
          bounds: preset.bounds,
          minZoom: preset.minZoom,
          maxZoom: preset.maxZoom,
          styleUrl: MapService.getDefaultStyleUrl(theme),
        });
        await OfflineMapService.refreshRegion(id);
      }
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Unable to start map downloads.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame
      title="Offline Maps"
      nextHref="/onboarding/power"
      nextLabel={selected.size ? 'Download Selected' : 'Skip Maps'}
      hideBranding
      arkyPose="navigator"
      onNext={startDownloads}>
      <View className="gap-5">
        <View className="bg-primary/10 border-primary/20 rounded-2xl border p-4">
          <Text className="text-primary font-semibold">Recommended for this device</Text>
          <Text variant="muted" className="mt-1 text-sm">
            Start one practical map now. More regions stay available from the Map tab.
          </Text>
        </View>

        <View className="gap-3">
          {presets.map((preset) => (
            <MapPresetCard
              key={preset.id}
              preset={preset}
              selected={selected.has(preset.id)}
              onToggle={() =>
                setSelected((current) => {
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
            <Text variant="muted">Starting map downloads.</Text>
          </View>
        ) : null}

        {error ? <Text className="text-destructive">{error}</Text> : null}
      </View>
    </OnboardingFrame>
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
  return (
    <Pressable onPress={onToggle}>
      <Card className={`gap-3 p-4 ${selected ? 'border-primary/50 bg-primary/5' : ''}`}>
        <View className="flex-row items-start gap-3">
          <View
            className={`mt-1 h-10 w-10 items-center justify-center rounded-xl ${
              selected ? 'bg-primary/20' : 'bg-muted'
            }`}>
            <Icon as={selected ? Check : Map} className="text-primary size-5" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 font-bold">{preset.name}</Text>
              <Text className="text-muted-foreground text-xs">{preset.estimatedSize}</Text>
            </View>
            <Text variant="muted" className="text-sm" numberOfLines={2}>
              {preset.description}
            </Text>
            <View className="flex-row items-center gap-2">
              <Icon as={Download} className="text-muted-foreground size-3.5" />
              <Text className="text-muted-foreground text-xs">
                Zoom {preset.minZoom} - {preset.maxZoom}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
