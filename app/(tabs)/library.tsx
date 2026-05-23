import { Screen } from '@/components/layout/screen';
import { Arky } from '@/components/brand/ark-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ImportService } from '@/services/files/import.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { RssService } from '@/services/rss/rss.service';
import type { ContentCategory, ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';
import { formatDistanceToNow } from 'date-fns';
import { router } from 'expo-router';
import {
  BookOpen,
  Bot,
  Check,
  Download,
  FileText,
  Map,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Rss,
  Stethoscope,
  Trash2,
  Upload,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, RefreshControl, View } from 'react-native';

const filters: Array<ContentCategory | 'All' | 'Documents'> = [
  'All',
  'Wiki',
  'Medical',
  'Survival',
  'Maps',
  'AI Models',
  'Documents',
];

function iconFor(pack: ContentPack) {
  if (pack.category === 'AI Models') return Bot;
  if (pack.category === 'Medical') return Stethoscope;
  if (pack.category === 'Maps') return Map;
  if (pack.format === 'pdf') return FileText;
  return BookOpen;
}

function actionLabel(pack: ContentPack) {
  if (pack.installStatus === 'downloading' || pack.installStatus === 'queued') return 'Downloading';
  if (pack.installStatus === 'paused') return 'Resume';
  if (pack.installStatus === 'failed') return 'Retry';
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

export default function LibraryScreen() {
  const [packs, setPacks] = React.useState<ContentPack[]>([]);
  const [documents, setDocuments] = React.useState<ArkDocument[]>([]);
  const [rssOverview, setRssOverview] = React.useState<Awaited<
    ReturnType<typeof RssService.getOverview>
  > | null>(null);
  const [modelStatus, setModelStatus] = React.useState<Awaited<
    ReturnType<typeof ModelManagerService.getStatus>
  > | null>(null);
  const [storageCapacity, setStorageCapacity] = React.useState<Awaited<
    ReturnType<typeof FileSystemService.getDiskCapacity>
  > | null>(null);
  const [filter, setFilter] = React.useState<(typeof filters)[number]>('All');
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [modelTitle, setModelTitle] = React.useState('');
  const [modelUrl, setModelUrl] = React.useState('');
  const [modelChecksum, setModelChecksum] = React.useState('');

  async function load() {
    const [nextPacks, nextDocuments, nextRssOverview, nextModelStatus, nextStorageCapacity] =
      await Promise.all([
        ContentPackService.listPacks(),
        ImportService.listDocuments(),
        RssService.getOverview(),
        ModelManagerService.getStatus(),
        FileSystemService.getDiskCapacity(),
      ]);
    setPacks(nextPacks);
    setDocuments(nextDocuments);
    setRssOverview(nextRssOverview);
    setModelStatus(nextModelStatus);
    setStorageCapacity(nextStorageCapacity);
    setInitialLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    if (
      !packs.some((pack) => pack.installStatus === 'queued' || pack.installStatus === 'downloading')
    ) {
      return;
    }
    const interval = setInterval(() => {
      void load();
    }, 1000);
    return () => clearInterval(interval);
  }, [packs]);

  const visible =
    filter === 'All' || filter === 'Documents'
      ? packs
      : packs.filter((pack) => pack.category === filter);
  const showPacks = filter !== 'Documents';
  const showDocuments = filter === 'All' || filter === 'Documents';
  const showModelTools = filter === 'All' || filter === 'AI Models';
  const installedCount = packs.filter((pack) => pack.installed).length;
  const activeCount = packs.filter(
    (pack) => pack.installStatus === 'queued' || pack.installStatus === 'downloading'
  ).length;

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
        <View className="flex-1 gap-2">
          <Text variant="h1">Library</Text>
          <Text variant="muted">
            Real offline packs from Kiwix, Hesperian, and public-domain survival archives.
          </Text>
        </View>
          <Arky pose="download" size={80} />
      </View>

      <Card className="gap-3">
        <View className="flex-row justify-between gap-3">
          <View>
            <Text variant="muted">Installed</Text>
            <Text variant="h2">{installedCount}</Text>
          </View>
          <View>
            <Text variant="muted">Active</Text>
            <Text variant="h2">{activeCount}</Text>
          </View>
          <View>
            <Text variant="muted">Available</Text>
            <Text variant="h2">{packs.length}</Text>
          </View>
          <View>
            <Text variant="muted">Docs</Text>
            <Text variant="h2">{documents.length}</Text>
          </View>
        </View>
        {storageCapacity?.freeBytes != null ? (
          <Text variant="small">
            {FileSystemService.formatBytes(storageCapacity.freeBytes)} free for downloads
          </Text>
        ) : null}
        <Button
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
          {workingId === 'import' ? <ActivityIndicator /> : <Icon as={Plus} className="size-4" />}
          <Text>Import File</Text>
        </Button>
      </Card>

      {error ? (
        <Card className="border-destructive/50 gap-2">
          <Text className="text-destructive">{error}</Text>
        </Card>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? 'default' : 'outline'}
            onPress={() => setFilter(item)}>
            <Text>{item}</Text>
          </Button>
        ))}
      </View>

      {initialLoading ? (
        <View className="gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </View>
      ) : null}

      {!initialLoading && filter === 'All' ? (
        <Card className="gap-3">
          <View className="flex-row gap-3">
            <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
              <Icon as={Rss} className="text-primary size-6" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="large">Emergency feeds</Text>
              <Text variant="muted">
                FEMA disaster declarations, NHC tropical cyclone advisories, and USGS significant
                earthquakes cached for offline review.
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            <Text variant="muted">{rssOverview?.feeds.length ?? 0} feeds</Text>
            <Text variant="muted">{rssOverview?.recentItems.length ?? 0} recent items</Text>
            <Text variant="muted">
              {rssOverview?.lastFetchedAt
                ? `Updated ${formatDistanceToNow(rssOverview.lastFetchedAt, { addSuffix: true })}`
                : 'Not refreshed yet'}
            </Text>
          </View>
          <Button
            variant="outline"
            disabled={workingId === 'rss'}
            onPress={async () => {
              setWorkingId('rss');
              setError(null);
              try {
                const result = await RssService.refreshAll();
                setRssOverview(result.overview);
                if (result.errors.length) {
                  setError(result.errors.join('\n'));
                }
              } catch (rssError) {
                setError(rssError instanceof Error ? rssError.message : 'Unable to refresh feeds.');
              } finally {
                setWorkingId(null);
              }
            }}>
            {workingId === 'rss' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={RefreshCcw} className="size-4" />
            )}
            <Text>Refresh Feeds</Text>
          </Button>
          {rssOverview?.recentItems.length ? (
            <View className="gap-2">
              {rssOverview.recentItems.map((item) => (
                <View key={item.id} className="border-border border-t pt-2">
                  <Text>{item.title}</Text>
                  <Text variant="small">
                    {item.feed_title}
                    {item.published_at
                      ? ` - ${formatDistanceToNow(item.published_at, { addSuffix: true })}`
                      : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {!initialLoading && showModelTools ? (
        <Card className="gap-3">
          <View className="flex-row gap-3">
            <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
              <Icon as={Bot} className="text-primary size-6" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="large">Local AI models</Text>
              <Text variant="muted">
                Download a curated GGUF model or import your own. Ark will use it when the local
                runtime is available in this build.
              </Text>
            </View>
          </View>
          {modelStatus ? (
            <View className="bg-muted/40 gap-1 rounded-md p-3">
              <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                <Text variant="small">
                  {modelStatus.installedModels}/{modelStatus.availableModels} installed
                </Text>
                <Text variant="small">
                  {modelStatus.adapter === 'llama' ? 'Offline runtime ready' : 'Mock response mode'}
                </Text>
              </View>
              {modelStatus.activeModelTitle ? (
                <Text variant="muted">Active model: {modelStatus.activeModelTitle}</Text>
              ) : null}
              <Text variant="muted">{modelStatus.message}</Text>
            </View>
          ) : null}
          <Button
            variant="outline"
            disabled={workingId === 'model-import'}
            onPress={async () => {
              setWorkingId('model-import');
              setError(null);
              try {
                await ContentPackService.importLocalModel();
                await load();
              } catch (modelError) {
                setError(
                  modelError instanceof Error ? modelError.message : 'Unable to import model.'
                );
              } finally {
                setWorkingId(null);
              }
            }}>
            {workingId === 'model-import' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={Upload} className="size-4" />
            )}
            <Text>Import GGUF File</Text>
          </Button>
          <View className="gap-2">
            <Input value={modelTitle} onChangeText={setModelTitle} placeholder="Model name" />
            <Input
              value={modelUrl}
              onChangeText={setModelUrl}
              placeholder="https://.../model.gguf"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              value={modelChecksum}
              onChangeText={setModelChecksum}
              placeholder="Checksum (optional)"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              variant="outline"
              disabled={workingId === 'model-url' || !modelUrl.trim()}
              onPress={async () => {
                setWorkingId('model-url');
                setError(null);
                try {
                  await ContentPackService.addModelUrl({
                    title: modelTitle,
                    sourceUrl: modelUrl,
                    checksum: modelChecksum,
                  });
                  setModelTitle('');
                  setModelUrl('');
                  setModelChecksum('');
                  await load();
                } catch (modelError) {
                  setError(
                    modelError instanceof Error ? modelError.message : 'Unable to add model URL.'
                  );
                } finally {
                  setWorkingId(null);
                }
              }}>
              {workingId === 'model-url' ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Plus} className="size-4" />
              )}
              <Text>Add Model URL</Text>
            </Button>
          </View>
          <Text variant="small">
            Prefer 1-2B Q4 models on phones. If the source publishes a checksum, paste it here so
            Ark can reject corrupted downloads when verification is available.
          </Text>
        </Card>
      ) : null}

      {!initialLoading && showDocuments ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text variant="large">Personal documents</Text>
            {documents.length ? <Text variant="muted">{documents.length} imported</Text> : null}
          </View>
          {documents.length ? (
            documents.map((document) => (
              <Card key={document.id} className="gap-3">
                <View className="flex-row gap-3">
                  <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
                    <Icon as={FileText} className="text-primary size-6" />
                  </View>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text variant="large" className="min-w-0">
                      {document.title}
                    </Text>
                    <Text variant="muted">
                      {document.mimeType ?? 'Unknown type'} -{' '}
                      {document.sizeBytes
                        ? FileSystemService.formatBytes(document.sizeBytes)
                        : 'Unknown size'}
                    </Text>
                    <Text variant="small">
                      Imported {formatDistanceToNow(document.createdAt, { addSuffix: true })}
                    </Text>
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
                              await load();
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
            ))
          ) : (
            <Card className="gap-2">
              <Text variant="large">No imported documents</Text>
              <Text variant="muted">
                Import PDFs, checklists, maps, or field notes to keep them inside Ark storage.
              </Text>
            </Card>
          )}
        </View>
      ) : null}

      {!initialLoading && showPacks
        ? visible.length === 0 ? (
          <View className="items-center gap-4 py-8">
            <Arky pose="archivist" size={160} />
            <Text variant="h3" className="text-center">Library is empty</Text>
            <Text variant="muted" className="text-center">
              Ark organizes downloaded knowledge packs, documents, maps, and models here.
            </Text>
          </View>
        ) : (
          visible.map((pack) => {
            const packStorageWarning = storageWarning(pack, storageCapacity?.freeBytes);
            return (
              <Card key={pack.id} className="gap-4">
                <View className="flex-row gap-3">
                  <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
                    <Icon as={iconFor(pack)} className="text-primary size-6" />
                  </View>
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row items-start justify-between gap-3">
                      <Text variant="large" className="min-w-0 flex-1">
                        {pack.title}
                      </Text>
                      {pack.installed ? <Icon as={Check} className="text-primary size-5" /> : null}
                    </View>
                    <Text variant="muted">{pack.description}</Text>
                  </View>
                </View>

                <View className="gap-2">
                  <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                    <Text variant="muted">
                      {pack.category} - {pack.format.toUpperCase()} - {pack.estimatedSize}
                    </Text>
                    {pack.sourceLabel ? <Text variant="muted">{pack.sourceLabel}</Text> : null}
                  </View>
                  <Progress value={pack.progress} />
                  <Text variant="small">
                    {pack.installStatus === 'failed'
                      ? 'Download failed. Check connection and retry.'
                      : `${Math.round(pack.progress * 100)}% - ${pack.installStatus.replace('_', ' ')}`}
                  </Text>
                  {packStorageWarning ? (
                    <Text variant="small" className="text-destructive">
                      {packStorageWarning}
                    </Text>
                  ) : null}
                </View>

                {pack.disclaimer ? (
                  <Text className="text-destructive text-sm">{pack.disclaimer}</Text>
                ) : null}

              {pack.installStatus === 'downloading' || pack.installStatus === 'queued' ? (
                <View className="flex-row gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    disabled={workingId === pack.id}
                    onPress={async () => {
                      setWorkingId(pack.id);
                      setError(null);
                      try {
                        await ContentPackService.pausePackDownload(pack.id);
                        await load();
                      } catch (pauseError) {
                        setError(
                          pauseError instanceof Error
                            ? pauseError.message
                            : 'Unable to pause download.'
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
                              await load();
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
                        await load();
                      } catch (resumeError) {
                        setError(
                          resumeError instanceof Error
                            ? resumeError.message
                            : 'Unable to resume download.'
                        );
                      } finally {
                        setWorkingId(null);
                      }
                    }}>
                    {workingId === pack.id ? (
                      <ActivityIndicator />
                    ) : (
                      <Icon as={Play} className="size-4" />
                    )}
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
                              await load();
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
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onPress={() => router.push(`/content/${pack.id}` as never)}>
                    <Text>Open</Text>
                  </Button>
                  <Button
                    size="icon"
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
                              await load();
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
              ) : (
                <Button
                  variant={pack.installStatus === 'failed' ? 'outline' : 'default'}
                  disabled={workingId === pack.id || !!packStorageWarning}
                  onPress={async () => {
                    setWorkingId(pack.id);
                    setError(null);
                    try {
                      await ContentPackService.installPack(pack.id);
                      await load();
                    } catch (downloadError) {
                      setError(
                        downloadError instanceof Error
                          ? downloadError.message
                          : 'Unable to download pack.'
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
          })
        )
        : null}

      {!initialLoading && showPacks ? (
        <View className="py-8 items-center justify-center">
          <Text variant="small" className="text-zinc-500 text-center px-4 leading-relaxed">
            To protect your safety offline, Ark automatically verifies the integrity of all downloaded files.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
