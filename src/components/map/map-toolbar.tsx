import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { OfflineMapSearchResult } from '@/types/maps';
import { AlertTriangle, Layers, MapPin, Route, Search, X } from 'lucide-react-native';
import * as React from 'react';
import type { TextInput } from 'react-native';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

export type TopMapMode = 'compact' | 'search' | 'map';

const TOP_TRANSITION = LinearTransition.duration(180).easing(Easing.out(Easing.quad));

export function TopMapControls({
  mode,
  noDownloadedRegions,
  offlineResults,
  searchInputRef,
  search,
  onChangeFocus,
  onChangeMode,
  onChangeSearch,
  onCloseSearch,
  onOpenResult,
}: {
  mode: TopMapMode;
  noDownloadedRegions: boolean;
  offlineResults: OfflineMapSearchResult[];
  searchInputRef: React.RefObject<TextInput | null>;
  search: string;
  onChangeFocus: (focused: boolean) => void;
  onChangeMode: (mode: TopMapMode) => void;
  onChangeSearch: (value: string) => void;
  onCloseSearch: () => void;
  onOpenResult: (result: OfflineMapSearchResult) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Animated.View layout={TOP_TRANSITION} className="flex-1">
          <View className="border-border bg-card/95 h-12 flex-row items-center gap-2 rounded-lg border px-3">
            <Icon as={Search} className="text-muted-foreground size-4" />
            <Input
              ref={searchInputRef}
              accessibilityLabel="Search map places and saved data"
              className="h-8 min-h-0 flex-1 border-0 bg-transparent px-0 py-0"
              value={search}
              onChangeText={onChangeSearch}
              onFocus={() => {
                onChangeFocus(true);
                onChangeMode('search');
              }}
              onBlur={() => {
                onChangeFocus(false);
              }}
              placeholder="Search places, maps, saved data"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {mode === 'search' || search ? (
              <Button
                accessibilityLabel="Close map search"
                size="icon"
                variant="ghost"
                className="size-8"
                onPress={() => {
                  onChangeSearch('');
                  onCloseSearch();
                }}>
                <Icon as={X} className="size-4" />
              </Button>
            ) : null}
          </View>
        </Animated.View>
      </View>

      {noDownloadedRegions ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
          <View className="border-primary/40 bg-card/95 flex-row items-center gap-2 self-start rounded-full border px-3 py-2">
            <Icon as={AlertTriangle} className="text-primary size-4" />
            <Text variant="small">No downloaded map regions</Text>
          </View>
        </Animated.View>
      ) : null}

      {mode === 'search' && search.trim().length >= 2 ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
          <Card className="gap-1 p-2">
            {offlineResults.length ? (
              offlineResults.map((result) => (
                <OfflineSearchResultRow
                  key={`${result.kind}:${result.id}`}
                  result={result}
                  onOpen={() => onOpenResult(result)}
                />
              ))
            ) : (
              <Text variant="muted" className="px-2 py-1">
                No map matches.
              </Text>
            )}
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

const OfflineSearchResultRow = React.memo(function OfflineSearchResultRow({
  result,
  onOpen,
}: {
  result: OfflineMapSearchResult;
  onOpen: () => void;
}) {
  return (
    <Button
      className="h-auto min-h-14 items-start justify-start px-2 py-2"
      variant="ghost"
      onPress={onOpen}>
      <Icon as={iconForSearchResult(result.kind)} className="text-primary mt-0.5 size-4" />
      <View className="min-w-0 flex-1 items-start gap-1">
        <Text className="text-sm leading-5" numberOfLines={1}>
          {result.title}
        </Text>
        <Text variant="small" className="text-muted-foreground leading-4" numberOfLines={2}>
          {labelForSearchResult(result)} · {result.subtitle}
        </Text>
      </View>
    </Button>
  );
});

function iconForSearchResult(kind: OfflineMapSearchResult['kind']) {
  if (kind === 'route') return Route;
  if (kind === 'track') return Route;
  if (kind === 'region') return Layers;
  return MapPin;
}

function labelForSearchResult(result: OfflineMapSearchResult) {
  if (result.kind === 'route') return 'Route';
  if (result.kind === 'track') return 'Track';
  if (result.kind === 'region') return 'Region';
  if (result.kind === 'place') {
    if (result.placeSource === 'offline') return 'Offline place';
    return result.placeSource === 'cached' ? 'Cached place' : 'Online place';
  }
  return 'Spot';
}
