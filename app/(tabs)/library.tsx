import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  getCategoryIcon,
  getOrderedContentCategories,
  getPackIcon,
} from '@/constants/pack-presentation';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ImportService } from '@/services/files/import.service';
import type { ContentCategory, ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import { router } from 'expo-router';
import { ChevronRight, FileText, PackageOpen, Plus, Search, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';

type CategoryTile = {
  key: string;
  title: string;
  count: number;
  icon: React.ComponentProps<typeof Icon>['as'];
  href: string;
  description: string;
};

type LibrarySearchResult = {
  key: string;
  title: string;
  description: string;
  meta: string;
  icon: React.ComponentProps<typeof Icon>['as'];
  href: string;
};

export default function LibraryScreen() {
  const [packs, setPacks] = React.useState<ContentPack[]>([]);
  const [documents, setDocuments] = React.useState<ArkDocument[]>([]);
  const [query, setQuery] = React.useState('');
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);

  const libraryPacks = React.useMemo(
    () => packs.filter((pack) => pack.category !== 'AI Models' && pack.category !== 'RSS'),
    [packs]
  );

  const categoryTiles = React.useMemo<CategoryTile[]>(() => {
    const packTiles = getOrderedContentCategories(libraryPacks).map((category) => {
      const categoryPacks = libraryPacks.filter((pack) => pack.category === category);
      return {
        key: category,
        title: category,
        count: categoryPacks.length,
        icon: getCategoryIcon(category),
        href: `/library/${encodeURIComponent(category)}`,
        description: describeCategory(category),
      };
    });

    return [
      ...packTiles,
      {
        key: 'Documents',
        title: 'Documents',
        count: documents.length,
        icon: FileText,
        href: '/library/Documents',
        description: 'Imported PDFs, notes, scans, and local reference files.',
      },
    ];
  }, [documents.length, libraryPacks]);

  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = React.useMemo<LibrarySearchResult[]>(() => {
    if (!normalizedQuery) return [];

    const packResults = libraryPacks
      .filter((pack) =>
        matchesQuery(normalizedQuery, [
          pack.title,
          pack.description,
          pack.category,
          pack.format,
          pack.estimatedSize,
          pack.sourceLabel,
          pack.installed ? 'installed' : 'download',
        ])
      )
      .map((pack) => ({
        key: `pack:${pack.id}`,
        title: pack.title,
        description: pack.description,
        meta: [
          pack.category,
          pack.format.toUpperCase(),
          pack.estimatedSize,
          pack.installed ? 'Installed' : 'Not installed',
        ].join(' - '),
        icon: getPackIcon(pack),
        href: `/library/${encodeURIComponent(pack.category)}`,
      }));

    const documentResults = documents
      .filter((document) =>
        matchesQuery(normalizedQuery, [
          document.title,
          document.mimeType,
          document.source,
          document.extractedText,
          document.ocrText,
          'document',
        ])
      )
      .map((document) => ({
        key: `document:${document.id}`,
        title: document.title,
        description:
          document.extractedText ?? document.ocrText ?? 'Imported document stored offline.',
        meta: document.mimeType ?? 'Document',
        icon: FileText,
        href: `/documents/${document.id}`,
      }));

    return [...packResults, ...documentResults];
  }, [documents, libraryPacks, normalizedQuery]);

  async function load() {
    const [nextPacks, nextDocuments] = await Promise.all([
      ContentPackService.listPacks(),
      ImportService.listDocuments(),
    ]);
    setPacks(nextPacks);
    setDocuments(nextDocuments);
    setInitialLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    if (
      !packs.some(
        (pack) =>
          pack.installStatus === 'queued' ||
          pack.installStatus === 'downloading' ||
          pack.installStatus === 'verifying'
      )
    ) {
      return;
    }
    const interval = setInterval(() => {
      void load();
    }, 1000);
    return () => clearInterval(interval);
  }, [packs]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }>
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="border-border bg-background min-w-0 flex-1 flex-row items-center rounded-md border px-3">
            <Icon as={Search} className="text-muted-foreground size-4" />
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search library"
              returnKeyType="search"
              accessibilityLabel="Search library contents"
              className="min-h-11 flex-1 border-0 bg-transparent px-3 py-2"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear library search"
                className="active:bg-accent size-9 items-center justify-center rounded-md"
                onPress={() => setQuery('')}>
                <Icon as={X} className="text-muted-foreground size-4" />
              </Pressable>
            ) : null}
          </View>
          <Button
            size="sm"
            variant="secondary"
            disabled={workingId === 'import'}
            onPress={async () => {
              setWorkingId('import');
              setError(null);
              try {
                const importedDocument = await ImportService.importDocument();
                await load();
                if (importedDocument) router.push('/library/Documents' as never);
              } catch (importError) {
                setError(
                  importError instanceof Error ? importError.message : 'Unable to import file.'
                );
              } finally {
                setWorkingId(null);
              }
            }}>
            {workingId === 'import' ? <ActivityIndicator /> : <Icon as={Plus} className="size-4" />}
            <Text>Import</Text>
          </Button>
        </View>
      </Card>

      {error ? (
        <Card className="border-destructive/50 gap-2">
          <Text className="text-destructive">{error}</Text>
        </Card>
      ) : null}

      {initialLoading ? (
        <View className="gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </View>
      ) : normalizedQuery ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text variant="large">Search results</Text>
            <Text variant="small" className="text-muted-foreground">
              {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
            </Text>
          </View>
          {searchResults.length ? (
            searchResults.map((result) => (
              <Pressable
                key={result.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${result.title}`}
                className="active:opacity-80"
                onPress={() => router.push(result.href as never)}>
                <Card className="active:bg-accent min-h-24 flex-row items-center gap-4">
                  <View className="bg-primary/15 size-12 items-center justify-center rounded-md">
                    <Icon as={result.icon} className="text-primary size-6" />
                  </View>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text variant="large" numberOfLines={1}>
                      {result.title}
                    </Text>
                    <Text variant="muted" numberOfLines={2}>
                      {result.description}
                    </Text>
                    <Text variant="small" className="text-muted-foreground" numberOfLines={1}>
                      {result.meta}
                    </Text>
                  </View>
                  <Icon as={ChevronRight} className="text-muted-foreground size-5" />
                </Card>
              </Pressable>
            ))
          ) : (
            <Card className="items-center gap-2 py-6">
              <Icon as={PackageOpen} className="text-muted-foreground size-8" />
              <Text variant="large" className="text-center">
                No library matches
              </Text>
              <Text variant="muted" className="text-center">
                Try a pack name, topic, format, or imported document title.
              </Text>
            </Card>
          )}
        </View>
      ) : (
        <View className="gap-3">
          {categoryTiles.map((category) => (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${category.title} category`}
              className="active:opacity-80"
              onPress={() => router.push(category.href as never)}>
              <Card className="active:bg-accent min-h-24 flex-row items-center gap-4">
                <View className="bg-primary/15 size-12 items-center justify-center rounded-md">
                  <Icon as={category.icon} className="text-primary size-6" />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text variant="large">{category.title}</Text>
                  <Text variant="muted" numberOfLines={2}>
                    {category.description}
                  </Text>
                </View>
                <View className="min-w-20 items-end gap-2">
                  <View className="border-border rounded-md border px-3 py-1.5">
                    <Text variant="small" className="text-muted-foreground">
                      <Text className="text-foreground font-semibold tabular-nums">
                        {category.count}
                      </Text>{' '}
                      {category.count === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <View className="bg-secondary flex-row items-center gap-1 rounded-md px-2 py-1">
                    <Text variant="small" className="font-semibold">
                      Open
                    </Text>
                    <Icon as={ChevronRight} className="size-4" />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function describeCategory(category: ContentCategory) {
  switch (category) {
    case 'Medical':
      return 'First aid, clinical references, and care guides.';
    case 'Survival':
      return 'Fieldcraft, shelter, water, fire, and navigation references.';
    case 'Disasters':
      return 'Hazard-specific procedures for outages, floods, fire, and heat.';
    case 'Preparedness':
      return 'Planning references for household and field readiness.';
    case 'Wiki':
      return 'Offline encyclopedia and broad knowledge archives.';
    case 'Maps':
      return 'Offline map packages and travel references.';
    case 'Food':
      return 'Food storage, preservation, and preparation material.';
    case 'Health':
      return 'Public health, sanitation, and wellness references.';
    case 'Safety':
      return 'Risk, security, and safety procedures.';
    case 'Comms':
      return 'Communication and signaling references.';
    default:
      return 'Offline reference material ready for download and use.';
  }
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLowerCase().includes(query));
}
