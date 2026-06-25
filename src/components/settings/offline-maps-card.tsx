import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import type { MapPreset } from '@/constants/map-presets';
import { getUnsupportedMapPackReason } from '@/services/maps/map-pack-format';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { formatMapRegionStorage, routingStatusLabel } from '@/services/maps/map-storage';
import type { MapRegion } from '@/types/maps';
import {
  CheckCircle2,
  ChevronLeft,
  Download,
  Folder,
  Map as MapIcon,
  MoreVertical,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

type MapCountryGroup = {
  key: string;
  name: string;
  letter: string;
  presets: MapPreset[];
  regions: MapRegion[];
  downloadedRegions: MapRegion[];
};

const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina',
  AU: 'Australia',
  BR: 'Brazil',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  IE: 'Ireland',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  MA: 'Morocco',
  MX: 'Mexico',
  NZ: 'New Zealand',
  PT: 'Portugal',
  TR: 'Turkey',
  UK: 'United Kingdom',
  US: 'United States',
};

function buildMapCountryGroups(presets: MapPreset[], regions: MapRegion[]): MapCountryGroup[] {
  const groups = new Map<string, MapCountryGroup>();
  for (const preset of presets) {
    if (isStructuralMapPreset(preset)) continue;
    const countryName = countryNameForPreset(preset);
    const key = countryName.toLowerCase();
    const group = groups.get(key) ?? {
      key,
      name: countryName,
      letter: countryName.charAt(0).toUpperCase(),
      presets: [],
      regions: [],
      downloadedRegions: [],
    };
    group.presets.push(preset);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.presets.sort((a, b) => levelSort(a) - levelSort(b) || a.name.localeCompare(b.name));
    group.regions = regions.filter((region) => {
      return group.presets.some(
        (preset) => preset.id === region.manifestRegionId || preset.name === region.name
      );
    });
    group.downloadedRegions = group.regions.filter((region) => region.status === 'downloaded');
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getGroupRows(group: MapCountryGroup, showCatalog: boolean, searchText: string) {
  return group.presets
    .filter((preset) => {
      const region = findRegionForPreset(preset, group.regions);
      if (!showCatalog && region?.status !== 'downloaded') return false;
      return !searchText || mapPresetMatches(preset, searchText, group.name);
    })
    .map((preset) => ({ preset, region: findRegionForPreset(preset, group.regions) }));
}

function findRegionForPreset(preset: MapPreset, regions: MapRegion[]) {
  return regions.find(
    (region) => region.manifestRegionId === preset.id || region.name === preset.name
  );
}

function findPresetForRegion(region: MapRegion, presets: MapPreset[]) {
  return (
    presets.find(
      (preset) => preset.id === region.manifestRegionId || preset.name === region.name
    ) ?? null
  );
}

function mapPresetMatches(preset: MapPreset, searchText: string, countryName: string) {
  return [countryName, preset.name, preset.description, ...preset.tags]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(searchText));
}

function countryNameForPreset(preset: MapPreset) {
  if (preset.countryCode && COUNTRY_NAMES[preset.countryCode])
    return COUNTRY_NAMES[preset.countryCode];
  const tagCountry = preset.tags.find((tag) => Object.values(COUNTRY_NAMES).includes(tag));
  if (tagCountry) return tagCountry;
  if (preset.tags.includes('Iberia')) return 'Iberia';
  return 'Other Regions';
}

function isStructuralMapPreset(preset: MapPreset) {
  return preset.id.includes('base') || preset.id.includes('low-detail');
}

function levelSort(preset: MapPreset) {
  if (preset.level === 'country') return 0;
  if (preset.level === 'region') return 1;
  return 2;
}

function regionBoundsLabel(region: MapRegion) {
  if (region.north == null || region.south == null || region.east == null || region.west == null) {
    return null;
  }
  return `${region.south.toFixed(2)}, ${region.west.toFixed(2)} to ${region.north.toFixed(2)}, ${region.east.toFixed(2)}`;
}

function MapCountryRow({
  group,
  showCatalog,
  onPress,
}: {
  group: MapCountryGroup;
  showCatalog: boolean;
  onPress: () => void;
}) {
  const downloadedCount = group.downloadedRegions.length;
  const totalCount = group.presets.length;
  return (
    <Pressable
      className="border-border bg-card flex-row items-center gap-3 border-b px-3 py-3 last:border-b-0"
      onPress={onPress}>
      <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
        <Text className="text-primary font-semibold">{group.letter}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Icon as={Folder} className="text-muted-foreground size-4" />
          <Text className="font-medium" numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <Text variant="small" className="text-muted-foreground">
          {downloadedCount
            ? `${downloadedCount} of ${totalCount} downloaded`
            : showCatalog
              ? `${totalCount} map${totalCount === 1 ? '' : 's'} available`
              : 'Downloaded maps'}
        </Text>
      </View>
    </Pressable>
  );
}

function MapPresetRow({
  busy,
  preset,
  region,
  onDownload,
  onOpenRegion,
}: {
  busy: boolean;
  preset: MapPreset;
  region?: MapRegion | null;
  onDownload: () => Promise<void>;
  onOpenRegion: () => void;
}) {
  const downloaded = region?.status === 'downloaded';
  const downloading = region?.status === 'downloading';
  const queued = region?.status === 'queued';
  const unsupportedReason = getUnsupportedMapPackReason(preset);
  return (
    <View className="border-border bg-muted/25 gap-2 rounded-lg border px-3 py-3">
      <View className="flex-row items-start gap-3">
        <View className="bg-background size-10 items-center justify-center rounded-md">
          <Icon as={downloaded ? CheckCircle2 : MapIcon} className="text-primary size-5" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-medium" numberOfLines={1}>
            {preset.name}
          </Text>
          <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
            {preset.description}
          </Text>
          <Text variant="small" className="text-muted-foreground">
            {region
              ? region.status.replace('_', ' ')
              : `${preset.estimatedSize}${preset.routingPackUrl ? ' + navigation' : ''}`}
          </Text>
          {region && preset.routingPackUrl ? (
            <Text variant="small" className="text-muted-foreground">
              {routingStatusLabel(region) ?? ''}
            </Text>
          ) : null}
        </View>
        {downloaded && region ? (
          <Button size="icon" variant="ghost" onPress={onOpenRegion}>
            <Icon as={MoreVertical} className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !!unsupportedReason}
            onPress={() => void onDownload()}>
            {busy ? <ActivityIndicator size="small" /> : <Icon as={Download} className="size-4" />}
            <Text>
              {downloading
                ? `${Math.round((region?.progress ?? 0) * 100)}%`
                : queued
                  ? 'Queued'
                  : 'Get'}
            </Text>
          </Button>
        )}
      </View>
      {region && !downloaded ? <Progress value={region.progress ?? 0} /> : null}
      {unsupportedReason ? (
        <Text variant="small" className="text-muted-foreground">
          {unsupportedReason}
        </Text>
      ) : null}
    </View>
  );
}

function MapDownloadedRegionRow({ region, onOpen }: { region: MapRegion; onOpen: () => void }) {
  return (
    <View className="border-border flex-row items-center gap-3 border-b px-3 py-3 last:border-b-0">
      <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
        <Text className="text-primary font-semibold">{region.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-medium" numberOfLines={1}>
          {region.name}
        </Text>
        <Text variant="small" className="text-muted-foreground">
          {formatMapRegionStorage(region)}
        </Text>
      </View>
      <Button size="icon" variant="ghost" onPress={onOpen}>
        <Icon as={MoreVertical} className="size-4" />
      </Button>
    </View>
  );
}

function MapRegionDetailsSheet({
  region,
  preset,
  onDismiss,
  onDelete,
}: {
  region: MapRegion | null;
  preset: MapPreset | null;
  onDismiss: () => void;
  onDelete: (region: MapRegion) => void;
}) {
  return (
    <ArkBottomSheet visible={!!region} onDismiss={onDismiss} snapPoints={['48%']}>
      {region ? (
        <View className="gap-4">
          <View className="gap-1">
            <Text variant="h3">{region.name}</Text>
            <Text variant="muted">{formatMapRegionStorage(region)}</Text>
          </View>
          <View className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
            <Text variant="small" className="text-muted-foreground">
              Regions contained
            </Text>
            <Text>
              {preset
                ? preset.description
                : (regionBoundsLabel(region) ?? 'Custom saved map region.')}
            </Text>
            {preset?.tags.length ? (
              <Text variant="small" className="text-muted-foreground">
                {preset.tags.slice(0, 5).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Button variant="destructive" onPress={() => onDelete(region)}>
            <Icon as={Trash2} className="size-4" />
            <Text>Delete map</Text>
          </Button>
        </View>
      ) : (
        <View />
      )}
    </ArkBottomSheet>
  );
}

export function OfflineMapsCard({
  mapRegions,
  busy,
  onDownloadPreset,
  onDeleteRegion,
}: {
  mapRegions: MapRegion[];
  busy: string | null;
  onDownloadPreset: (preset: MapPreset) => Promise<void>;
  onDeleteRegion: (region: MapRegion) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [browseMode, setBrowseMode] = React.useState(false);
  const [selectedCountryKey, setSelectedCountryKey] = React.useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = React.useState<MapRegion | null>(null);
  const presets = React.useMemo(() => MapPresetsService.listPresets(), []);
  const searchText = search.trim().toLowerCase();
  const showingCatalog = browseMode || searchText.length > 0;
  const groups = React.useMemo(
    () => buildMapCountryGroups(presets, mapRegions),
    [mapRegions, presets]
  );

  const visibleGroups = React.useMemo(() => {
    let nextGroups = groups;
    if (searchText) {
      nextGroups = groups
        .map((group) => ({
          ...group,
          presets: group.presets.filter((preset) =>
            mapPresetMatches(preset, searchText, group.name)
          ),
        }))
        .filter(
          (group) =>
            group.name.toLowerCase().includes(searchText) ||
            group.presets.length ||
            group.downloadedRegions.some((region) => region.name.toLowerCase().includes(searchText))
        );
    }
    if (showingCatalog) return nextGroups;
    return nextGroups.filter((group) => group.downloadedRegions.length > 0);
  }, [groups, searchText, showingCatalog]);

  const selectedGroup = selectedCountryKey
    ? (groups.find((group) => group.key === selectedCountryKey) ?? null)
    : null;
  const detailRegions = selectedGroup
    ? getGroupRows(selectedGroup, showingCatalog, searchText)
    : [];
  const customDownloadedRegions = mapRegions.filter(
    (region) =>
      region.status === 'downloaded' &&
      !presets.some(
        (preset) => preset.id === region.manifestRegionId || preset.name === region.name
      )
  );
  const visibleCustomRegions = customDownloadedRegions.filter(
    (region) => !searchText || region.name.toLowerCase().includes(searchText)
  );

  return (
    <Card className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Icon as={MapIcon} className="text-primary size-5" />
            <Text variant="large">Offline Maps</Text>
          </View>
          <Text variant="muted">
            {showingCatalog
              ? 'Search and add bundled map regions.'
              : 'Downloaded map packs stored on this device.'}
          </Text>
        </View>
        <Button
          size="sm"
          variant={showingCatalog ? 'outline' : 'default'}
          onPress={() => {
            setSelectedCountryKey(null);
            setBrowseMode((current) => !current);
          }}>
          <Text>{showingCatalog && !searchText ? 'Downloaded' : 'Add map'}</Text>
        </Button>
      </View>

      <View className="bg-muted/45 flex-row items-center gap-2 rounded-lg px-3 py-2">
        <Icon as={Search} className="text-muted-foreground size-5" />
        <Input
          className="h-8 flex-1 border-0 bg-transparent px-0"
          placeholder="Search countries and maps"
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            if (value.trim()) setSelectedCountryKey(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} className="p-1">
            <Icon as={X} className="text-muted-foreground size-4" />
          </Pressable>
        ) : null}
      </View>

      {selectedGroup ? (
        <View className="gap-3">
          <Button
            className="self-start"
            size="sm"
            variant="ghost"
            onPress={() => setSelectedCountryKey(null)}>
            <Icon as={ChevronLeft} className="size-4" />
            <Text>{selectedGroup.name}</Text>
          </Button>
          <View className="gap-2">
            {detailRegions.length ? (
              detailRegions.map(({ preset, region }) => (
                <MapPresetRow
                  key={preset.id}
                  busy={
                    busy === `map-download-${preset.id}` ||
                    (region ? Boolean(busy?.endsWith(region.id)) : false)
                  }
                  preset={preset}
                  region={region}
                  onDownload={() => onDownloadPreset(preset)}
                  onOpenRegion={() => region && setSelectedRegion(region)}
                />
              ))
            ) : (
              <Text variant="muted">
                {showingCatalog
                  ? 'No maps match this search.'
                  : 'No downloaded maps in this folder yet.'}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View className="border-border overflow-hidden rounded-lg border">
          {visibleGroups.length || visibleCustomRegions.length ? (
            <>
              {visibleGroups.map((group) => (
                <MapCountryRow
                  key={group.key}
                  group={group}
                  showCatalog={showingCatalog}
                  onPress={() => setSelectedCountryKey(group.key)}
                />
              ))}
              {visibleCustomRegions.map((region) => (
                <MapDownloadedRegionRow
                  key={region.id}
                  region={region}
                  onOpen={() => setSelectedRegion(region)}
                />
              ))}
            </>
          ) : (
            <View className="gap-2 px-3 py-4">
              <Text>No downloaded maps yet.</Text>
              <Text variant="muted">Use Add map or search to choose a region.</Text>
            </View>
          )}
        </View>
      )}

      <MapRegionDetailsSheet
        region={selectedRegion}
        preset={selectedRegion ? findPresetForRegion(selectedRegion, presets) : null}
        onDismiss={() => setSelectedRegion(null)}
        onDelete={(region) => {
          setSelectedRegion(null);
          onDeleteRegion(region);
        }}
      />
    </Card>
  );
}
