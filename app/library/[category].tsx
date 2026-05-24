import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { getPackIcon } from '@/constants/pack-presentation';
import { ContentPackService } from '@/services/content/content-pack.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { ImportService } from '@/services/files/import.service';
import type { ContentCategory, ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import { formatDistanceToNow } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check, Download, FileText, Pause, Play, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, RefreshControl, View } from 'react-native';

function actionLabel(pack: ContentPack) {
  if (pack.installStatus === 'downloading' || pack.installStatus === 'queued') return 'Downloading';
  if (pack.installStatus === 'verifying') return 'Verifying';
  if (pack.installStatus === 'paused') return 'Resume';
  if (pack.installStatus === 'failed') return 'Retry download';
  if (pack.installed) return 'Installed';
  return 'Download';
}

function storageWarning(pack: ContentPack, freeBytes?: number | null) {
  if (!pack.sizeBytes || freeBytes == null || pack.installed) return null;
  const reserveBytes = Math.max(200 * 1024 * 1024, Math.round(pack.sizeBytes * 0.1));
  if (freeBytes >= pack.sizeBytes + reserveBytes) return null;
  return `Needs about ${FileSystemService.formatBytes(pack.sizeBytes)} plus working room. ${FileSystemService.formatBytes(
    freeBytes
  )} free.`;
}

export default function LibraryCategoryScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = decodeCategory(params.category);
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
  const visiblePacks = React.useMemo(
    () =>
      category === 'Documents' ? [] : libraryPacks.filter((pack) => pack.category === category),
    [category, libraryPacks]
  );
  const showDocuments = category === 'Documents';
  const materialCount = showDocuments ? documents.length : visiblePacks.length;
  const title = showDocuments ? 'Documents' : category;

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
    <>
      <Stack.Screen options={{ title }} />
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
        <View className="gap-2">
          <Text variant="h1">{title}</Text>
          <Text variant="muted">
            {materialCount} {materialCount === 1 ? 'material' : 'materials'} available in this
            category.
          </Text>
        </View>

        {showDocuments ? (
          <Card className="gap-3">
            <View className="flex-row items-center gap-3">
              <Text variant="small" className="text-muted-foreground min-w-0 flex-1">
                Import files into Ark storage for offline reading and search.
              </Text>
              <Button
                size="sm"
                variant="secondary"
                disabled={workingId === 'import'}
                onPress={async () => {
                  setWorkingId('import');
                  setError(null);
                  try {
                    await ImportService.importDocument();
                    await load();
                  } catch (importError) {
                    setError(
                      importError instanceof Error ? importError.message : 'Unable to import file.'
                    );
                  } finally {
                    setWorkingId(null);
                  }
                }}>
                {workingId === 'import' ? (
                  <ActivityIndicator />
                ) : (
                  <Icon as={FileText} className="size-4" />
                )}
                <Text>Import</Text>
              </Button>
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-destructive/50 gap-2">
            <Text className="text-destructive">{error}</Text>
          </Card>
        ) : null}

        {initialLoading ? (
          <View className="gap-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </View>
        ) : null}

        {!initialLoading && showDocuments ? (
          <DocumentList
            documents={documents}
            workingId={workingId}
            setWorkingId={setWorkingId}
            setError={setError}
            reload={load}
          />
        ) : null}

        {!initialLoading && !showDocuments ? (
          visiblePacks.length === 0 ? (
            <View className="items-center gap-4 py-8">
              <Arky pose="archivist" size={160} />
              <Text variant="h3" className="text-center">
                No material in this category
              </Text>
              <Text variant="muted" className="text-center">
                Return to the Library overview to choose another category or import a file.
              </Text>
            </View>
          ) : (
            visiblePacks.map((pack) => {
              const packStorageWarning = storageWarning(pack, storageCapacity?.freeBytes);
              const isWorkingDownload =
                pack.installStatus === 'queued' ||
                pack.installStatus === 'downloading' ||
                pack.installStatus === 'verifying' ||
                pack.installStatus === 'paused' ||
                pack.installStatus === 'failed';
              return (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  isWorkingDownload={isWorkingDownload}
                  packStorageWarning={packStorageWarning}
                  workingId={workingId}
                  setWorkingId={setWorkingId}
                  setError={setError}
                  reload={load}
                />
              );
            })
          )
        ) : null}
      </Screen>
    </>
  );
}

function DocumentList({
  documents,
  workingId,
  setWorkingId,
  setError,
  reload,
}: {
  documents: ArkDocument[];
  workingId: string | null;
  setWorkingId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reload: () => Promise<void>;
}) {
  if (!documents.length) {
    return (
      <Card className="gap-2">
        <Text variant="large">No imported documents</Text>
        <Text variant="muted">
          Import PDFs, checklists, maps, or field notes to keep them inside Ark storage.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      {documents.map((document) => (
        <Card key={document.id} className="gap-3">
          <View className="flex-row gap-3">
            <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
              <Icon as={FileText} className="text-primary size-6" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="large" className="min-w-0">
                {document.title}
              </Text>
              <Text variant="muted" numberOfLines={1}>
                {document.sizeBytes
                  ? FileSystemService.formatBytes(document.sizeBytes)
                  : 'Unknown size'}{' '}
                - imported {formatDistanceToNow(document.createdAt, { addSuffix: true })}
              </Text>
              <Text variant="small">{documentSearchStatus(document)}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              variant="secondary"
              onPress={() => router.push(`/documents/${document.id}` as never)}>
              <Text>View</Text>
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={workingId === document.id}
              onPress={() => {
                Alert.alert('Delete document?', document.title, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      setWorkingId(document.id);
                      setError(null);
                      try {
                        await ImportService.deleteDocument(document.id);
                        await reload();
                      } catch (deleteError) {
                        setError(
                          deleteError instanceof Error
                            ? deleteError.message
                            : 'Unable to delete document.'
                        );
                      } finally {
                        setWorkingId(null);
                      }
                    },
                  },
                ]);
              }}>
              <Icon as={Trash2} className="size-4" />
            </Button>
          </View>
        </Card>
      ))}
    </View>
  );
}

function PackCard({
  pack,
  isWorkingDownload,
  packStorageWarning,
  workingId,
  setWorkingId,
  setError,
  reload,
}: {
  pack: ContentPack;
  isWorkingDownload: boolean;
  packStorageWarning: string | null;
  workingId: string | null;
  setWorkingId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reload: () => Promise<void>;
}) {
  return (
    <Card className="gap-4">
      <View className="flex-row gap-3">
        <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
          <Icon as={getPackIcon(pack)} className="text-primary size-6" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text variant="large" className="min-w-0 flex-1">
              {pack.title}
            </Text>
            {pack.installed ? <Icon as={Check} className="text-primary size-5" /> : null}
          </View>
          <Text variant="muted" numberOfLines={2}>
            {pack.description}
          </Text>
          <Text variant="small" className="text-muted-foreground" numberOfLines={1}>
            {[pack.format.toUpperCase(), pack.estimatedSize].join(' - ')}
            {pack.sourceLabel ? ` - ${pack.sourceLabel}` : ''}
          </Text>
        </View>
      </View>

      {isWorkingDownload ? (
        <View className="gap-2">
          <Progress value={pack.progress} />
          <Text variant="small">
            {pack.installStatus === 'failed'
              ? 'Download failed. Check connection and retry.'
              : pack.installStatus === 'verifying'
                ? 'Verifying file before installing'
                : `${Math.round(pack.progress * 100)}% - ${pack.installStatus.replace('_', ' ')}`}
          </Text>
        </View>
      ) : null}

      {packStorageWarning ? (
        <Text variant="small" className="text-destructive">
          {packStorageWarning}
        </Text>
      ) : null}

      {pack.disclaimer ? <Text className="text-destructive text-sm">{pack.disclaimer}</Text> : null}

      {pack.installStatus === 'downloading' || pack.installStatus === 'queued' ? (
        <View className="flex-row gap-2">
          {pack.format !== 'html' ? (
            <Button
              className="flex-1"
              variant="outline"
              disabled={workingId === pack.id}
              onPress={async () => {
                setWorkingId(pack.id);
                setError(null);
                try {
                  await ContentPackService.pausePackDownload(pack.id);
                  await reload();
                } catch (pauseError) {
                  setError(
                    pauseError instanceof Error ? pauseError.message : 'Unable to pause download.'
                  );
                } finally {
                  setWorkingId(null);
                }
              }}>
              {workingId === pack.id ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Pause} className="size-4" />
              )}
              <Text>Pause</Text>
            </Button>
          ) : null}
          <Button
            className={pack.format === 'html' ? 'flex-1' : undefined}
            size={pack.format === 'html' ? undefined : 'icon'}
            variant="outline"
            onPress={() =>
              Alert.alert('Cancel download?', pack.title, [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel',
                  style: 'destructive',
                  onPress: async () => {
                    setWorkingId(pack.id);
                    setError(null);
                    try {
                      await ContentPackService.cancelPackDownload(pack.id);
                      await reload();
                    } catch (cancelError) {
                      setError(
                        cancelError instanceof Error
                          ? cancelError.message
                          : 'Unable to cancel download.'
                      );
                    } finally {
                      setWorkingId(null);
                    }
                  },
                },
              ])
            }>
            <Icon as={Trash2} className="size-4" />
            {pack.format === 'html' ? <Text>Cancel</Text> : null}
          </Button>
        </View>
      ) : pack.installStatus === 'verifying' ? (
        <View className="flex-row gap-2">
          <Button className="flex-1" disabled>
            <ActivityIndicator />
            <Text>Verifying</Text>
          </Button>
          <Button
            size="icon"
            variant="outline"
            disabled={workingId === pack.id}
            onPress={() =>
              Alert.alert('Cancel verification?', pack.title, [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel',
                  style: 'destructive',
                  onPress: async () => {
                    setWorkingId(pack.id);
                    setError(null);
                    try {
                      await ContentPackService.cancelPackDownload(pack.id);
                      await reload();
                    } catch (cancelError) {
                      setError(
                        cancelError instanceof Error
                          ? cancelError.message
                          : 'Unable to cancel verification.'
                      );
                    } finally {
                      setWorkingId(null);
                    }
                  },
                },
              ])
            }>
            <Icon as={Trash2} className="size-4" />
          </Button>
        </View>
      ) : pack.installStatus === 'paused' ? (
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            disabled={workingId === pack.id}
            onPress={async () => {
              setWorkingId(pack.id);
              setError(null);
              try {
                await ContentPackService.resumePackDownload(pack.id);
                await reload();
              } catch (resumeError) {
                setError(
                  resumeError instanceof Error ? resumeError.message : 'Unable to resume download.'
                );
              } finally {
                setWorkingId(null);
              }
            }}>
            {workingId === pack.id ? <ActivityIndicator /> : <Icon as={Play} className="size-4" />}
            <Text>Resume</Text>
          </Button>
          <Button
            size="icon"
            variant="outline"
            onPress={() =>
              Alert.alert('Cancel download?', pack.title, [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel',
                  style: 'destructive',
                  onPress: async () => {
                    setWorkingId(pack.id);
                    setError(null);
                    try {
                      await ContentPackService.cancelPackDownload(pack.id);
                      await reload();
                    } catch (cancelError) {
                      setError(
                        cancelError instanceof Error
                          ? cancelError.message
                          : 'Unable to cancel download.'
                      );
                    } finally {
                      setWorkingId(null);
                    }
                  },
                },
              ])
            }>
            <Icon as={Trash2} className="size-4" />
          </Button>
        </View>
      ) : pack.installed ? (
        <View className="flex-row gap-2">
          {pack.format !== 'gguf' ? (
            <Button
              className="flex-1"
              variant="secondary"
              onPress={() => {
                if (pack.format === 'pdf' || pack.format === 'html' || pack.format === 'txt') {
                  router.push({
                    pathname: '/content/reader',
                    params: { packId: pack.id },
                  } as never);
                } else {
                  router.push(`/content/${pack.id}` as never);
                }
              }}>
              <Text>Open</Text>
            </Button>
          ) : null}
          <Button
            className={pack.format === 'gguf' ? 'flex-1' : undefined}
            size={pack.format === 'gguf' ? undefined : 'icon'}
            variant="outline"
            onPress={() =>
              Alert.alert('Remove pack?', pack.title, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    setWorkingId(pack.id);
                    setError(null);
                    try {
                      await ContentPackService.removePack(pack.id);
                      await reload();
                    } finally {
                      setWorkingId(null);
                    }
                  },
                },
              ])
            }>
            <Icon as={Trash2} className="size-4" />
            {pack.format === 'gguf' ? <Text className="ml-2">Remove</Text> : null}
          </Button>
        </View>
      ) : (
        <Button
          variant={pack.installStatus === 'failed' ? 'outline' : 'default'}
          disabled={workingId === pack.id || !!packStorageWarning}
          onPress={async () => {
            setWorkingId(pack.id);
            setError(null);
            try {
              await ContentPackService.installPack(pack.id);
              await reload();
            } catch (downloadError) {
              setError(
                downloadError instanceof Error ? downloadError.message : 'Unable to download pack.'
              );
            } finally {
              setWorkingId(null);
            }
          }}>
          {workingId === pack.id ? (
            <ActivityIndicator />
          ) : (
            <Icon as={Download} className="size-4" />
          )}
          <Text>{actionLabel(pack)}</Text>
        </Button>
      )}
    </Card>
  );
}

function decodeCategory(category?: string) {
  const value = category ? decodeURIComponent(category) : 'Documents';
  return value === 'Documents' ? 'Documents' : (value as ContentCategory);
}

function documentSearchStatus(document: ArkDocument) {
  if (document.extractedText) return 'Text indexed for offline search';
  if (document.ocrText) return 'Image text indexed for offline search';
  if (document.ocrStatus === 'processing') return 'Reading image text';
  if (document.ocrStatus === 'extracting_text') return 'Reading PDF text';
  if (document.ocrStatus === 'ocr_running') return 'Running PDF OCR';
  if (document.ocrStatus === 'ocr_needed') return 'PDF OCR available';
  if (document.ocrStatus === 'searchable') return 'Indexed for offline search';
  if (document.ocrStatus === 'pending') return 'Queued for text extraction';
  if (document.ocrStatus === 'unavailable') return 'OCR available on supported Android builds';
  if (document.ocrStatus === 'failed') return 'OCR needs attention';
  return 'Stored offline';
}
