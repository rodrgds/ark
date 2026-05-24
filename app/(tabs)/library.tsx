import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { getCategoryIcon, getOrderedContentCategories } from '@/constants/pack-presentation';
import { ContentPackService } from '@/services/content/content-pack.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ImportService } from '@/services/files/import.service';
import type { ContentCategory, ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import { router } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';
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

export default function LibraryScreen() {
  const [packs, setPacks] = React.useState<ContentPack[]>([]);
  const [documents, setDocuments] = React.useState<ArkDocument[]>([]);
  const [storageCapacity, setStorageCapacity] = React.useState<Awaited<
    ReturnType<typeof FileSystemService.getDiskCapacity>
  > | null>(null);
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

  async function load() {
    const [nextPacks, nextDocuments, nextStorageCapacity] = await Promise.all([
      ContentPackService.listPacks(),
      ImportService.listDocuments(),
      FileSystemService.getDiskCapacity(),
    ]);
    setPacks(nextPacks);
    setDocuments(nextDocuments);
    setStorageCapacity(nextStorageCapacity);
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
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 gap-2 pr-4">
          <Text variant="h1">Library</Text>
          <Text variant="muted">
            Offline references grouped by mission area. Open a category to manage its material.
          </Text>
        </View>
        <Arky pose="download" size={80} />
      </View>

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          {storageCapacity?.freeBytes != null ? (
            <Text variant="small" className="text-muted-foreground min-w-0 flex-1">
              {FileSystemService.formatBytes(storageCapacity.freeBytes)} free for new material
            </Text>
          ) : (
            <View className="flex-1" />
          )}
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
      ) : (
        <View className="gap-3">
          {categoryTiles.map((category) => (
            <Pressable
              key={category.key}
              accessibilityRole="button"
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
                <View className="border-border min-w-16 items-center rounded-md border px-3 py-2">
                  <Text variant="h3" className="tabular-nums">
                    {category.count}
                  </Text>
                  <Text variant="small" className="text-muted-foreground">
                    {category.count === 1 ? 'item' : 'items'}
                  </Text>
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
