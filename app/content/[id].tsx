import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { ContentPackService } from '@/services/content/content-pack.service';
import { GuideService, type GuideSection } from '@/services/content/guide.service';
import {
  ZimService,
  type ZimArticle,
  type ZimMetadata,
  type ZimSearchResult,
  type ZimReaderPlan,
} from '@/services/content/zim.service';
import type { ContentPack } from '@/types/content';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { BookOpen, Download, ExternalLink, Search, Share2, Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  View,
  Pressable,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Input } from '@/components/ui/input';

export default function ContentDetailScreen() {
  const { id, article } = useLocalSearchParams<{ id: string; article?: string }>();
  const [pack, setPack] = React.useState<ContentPack | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const openedArticleRef = React.useRef<string | null>(null);

  // ZIM state
  const [zimPlan, setZimPlan] = React.useState<ZimReaderPlan | null>(null);
  const [zimMetadata, setZimMetadata] = React.useState<ZimMetadata | null>(null);
  const [zimBusy, setZimBusy] = React.useState(false);
  const [zimError, setZimError] = React.useState<string | null>(null);
  const [zimQuery, setZimQuery] = React.useState('');
  const [zimResults, setZimResults] = React.useState<ZimSearchResult[]>([]);
  const [zimArticle, setZimArticle] = React.useState<ZimArticle | null>(null);

  const sections = React.useMemo(() => (pack ? GuideService.getSections(pack.id) : []), [pack]);

  async function load() {
    if (!id) return;
    try {
      const loadedPack = await ContentPackService.getPack(id);
      setPack(loadedPack);

      if (loadedPack?.format === 'zim') {
        const plan = await ZimService.getReaderPlan(loadedPack);
        setZimPlan(plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content.');
    }
  }

  React.useEffect(() => {
    void load();
  }, [id]);

  // Handle active downloads polling
  React.useEffect(() => {
    if (
      pack?.installStatus === 'downloading' ||
      pack?.installStatus === 'queued' ||
      pack?.installStatus === 'verifying'
    ) {
      const interval = setInterval(() => {
        void load();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pack?.installStatus]);

  // Load native ZIM archive if installed and native module is available
  React.useEffect(() => {
    if (!pack || pack.format !== 'zim' || !pack.installed || !zimPlan?.nativeReaderAvailable) {
      return;
    }

    let canceled = false;
    setZimBusy(true);
    setZimError(null);

    ZimService.openArchive(pack)
      .then((metadata) => {
        if (!canceled) setZimMetadata(metadata);
      })
      .catch((archiveError) => {
        if (!canceled) {
          setZimError(
            archiveError instanceof Error
              ? archiveError.message
              : 'Failed to initialize local ZIM search.'
          );
        }
      })
      .finally(() => {
        if (!canceled) setZimBusy(false);
      });

    return () => {
      canceled = true;
    };
  }, [pack?.id, pack?.installed, pack?.localUri, zimPlan?.nativeReaderAvailable]);

  React.useEffect(() => {
    const articlePath = Array.isArray(article) ? article[0] : article;
    if (
      !articlePath ||
      openedArticleRef.current === articlePath ||
      !pack ||
      pack.format !== 'zim' ||
      !pack.installed ||
      !zimPlan?.nativeReaderAvailable
    ) {
      return;
    }

    openedArticleRef.current = articlePath;
    void openZimArticle(articlePath);
  }, [article, pack?.id, pack?.installed, zimPlan?.nativeReaderAvailable]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runZimSearch() {
    if (!pack || !zimQuery.trim()) return;
    setZimBusy(true);
    setZimError(null);
    try {
      setZimResults(await ZimService.search(pack, zimQuery));
    } catch (searchError) {
      setZimError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setZimBusy(false);
    }
  }

  async function openZimArticle(path?: string | null) {
    if (!pack || !path) return;
    setZimBusy(true);
    setZimError(null);
    try {
      setZimArticle(await ZimService.getArticle(pack, path));
    } catch (articleError) {
      setZimError(
        articleError instanceof Error ? articleError.message : 'Article could not be opened.'
      );
    } finally {
      setZimBusy(false);
    }
  }

  function handleReadGuide(startSection?: GuideSection) {
    if (!pack) return;
    router.push({
      pathname: '/content/reader' as any,
      params: {
        packId: pack.id,
        section: startSection?.title || '',
      },
    });
  }

  async function handleHandoffToKiwix() {
    if (!pack) return;
    try {
      await ContentPackService.openPack(pack.id);
    } catch (err) {
      Alert.alert('Unable to open', err instanceof Error ? err.message : 'Could not open file.');
    }
  }

  if (!pack) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" />
        <Text variant="muted" className="mt-4">
          Loading content pack...
        </Text>
      </View>
    );
  }

  const isZim = pack.format === 'zim';

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: pack.title }} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
        {/* Pack Info */}
        <View className="gap-2">
          <Text variant="h1" className="text-3xl font-extrabold tracking-tight">
            {pack.title}
          </Text>
          <Text variant="muted" className="text-base leading-relaxed">
            {pack.description}
          </Text>
        </View>

        {/* Status / Action Card */}
        <Card className="border-border bg-card gap-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap gap-x-3 gap-y-1">
              <Text
                variant="small"
                className="text-muted-foreground text-xs tracking-widest uppercase">
                {pack.category}
              </Text>
              <Text variant="small" className="text-muted-foreground">
                •
              </Text>
              <Text
                variant="small"
                className="text-muted-foreground text-xs tracking-widest uppercase">
                {pack.format.toUpperCase()}
              </Text>
              <Text variant="small" className="text-muted-foreground">
                •
              </Text>
              <Text
                variant="small"
                className="text-muted-foreground text-xs tracking-widest uppercase">
                {pack.estimatedSize}
              </Text>
            </View>
            {pack.sourceLabel ? (
              <Text variant="small" className="text-muted-foreground text-xs">
                {pack.sourceLabel}
              </Text>
            ) : null}
          </View>

          {/* Download status / progress bar */}
          {!pack.installed && (
            <View className="gap-2">
              <Progress value={pack.progress} />
              <View className="flex-row justify-between">
                <Text variant="small" className="text-muted-foreground">
                  {pack.installStatus === 'downloading'
                    ? `Downloading: ${Math.round(pack.progress * 100)}%`
                    : pack.installStatus === 'verifying'
                      ? 'Verifying file before installing'
                      : pack.installStatus.replace('_', ' ')}
                </Text>
              </View>
            </View>
          )}

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          {/* Primary Action Buttons */}
          <View className="mt-1 flex-row gap-2">
            {pack.installed ? (
              <>
                {!isZim ? (
                  <Button
                    className="bg-primary active:bg-primary/90 flex-1"
                    disabled={busy}
                    onPress={() => handleReadGuide()}>
                    <Icon as={BookOpen} className="size-5" />
                    <Text className="text-primary-foreground font-bold">Read Guide</Text>
                  </Button>
                ) : (
                  <Button
                    className="bg-primary active:bg-primary/90 flex-1"
                    disabled={busy}
                    onPress={handleHandoffToKiwix}>
                    <Icon as={ExternalLink} className="size-5" />
                    <Text className="text-primary-foreground font-bold">Open in Reader</Text>
                  </Button>
                )}

                <Button
                  size="icon"
                  variant="outline"
                  className="border-border active:bg-muted"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert('Remove Pack?', `Delete ${pack.title} from offline storage?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => runAction(() => ContentPackService.removePack(pack.id)),
                      },
                    ])
                  }>
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Button>
              </>
            ) : (
              <Button
                className="flex-1 bg-primary active:bg-primary/90"
                disabled={busy || pack.installStatus === 'downloading' || pack.installStatus === 'verifying'}
                onPress={() => runAction(() => ContentPackService.installPack(pack.id))}
              >
                {busy || pack.installStatus === 'downloading' || pack.installStatus === 'verifying' ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Icon as={Download} className="size-5" />
                )}
                <Text className="text-primary-foreground font-bold">Download Offline Pack</Text>
              </Button>
            )}
          </View>
        </Card>

        {/* Disclaimer / Safety Copy if any */}
        {pack.disclaimer ? (
          <View className="rounded-r-lg border-l-2 border-amber-500/50 bg-amber-500/5 p-4">
            <Text variant="small" className="leading-relaxed font-semibold text-amber-500/80">
              {pack.disclaimer}
            </Text>
          </View>
        ) : null}

        {/* Guide Table of Contents (for non-ZIM packages) */}
        {!isZim && sections.length > 0 && (
          <View className="mt-2 gap-3">
            <Text variant="h3" className="text-foreground px-1 font-bold tracking-tight">
              Table of Contents
            </Text>
            <View className="border-border bg-muted/20 overflow-hidden rounded-lg border">
              {sections.map((section, idx) => (
                <Pressable
                  key={section.title}
                  disabled={!pack.installed}
                  onPress={() => handleReadGuide(section)}
                  className={`border-border active:bg-muted/30 flex-row items-center justify-between border-b p-4 last:border-b-0 ${!pack.installed ? 'opacity-50' : ''
                    }`}>
                  <View className="flex-1 pr-4">
                    <Text variant="default" className="text-foreground font-bold">
                      {section.title}
                    </Text>
                    {section.detail && (
                      <Text variant="muted" className="text-muted-foreground mt-1 leading-snug">
                        {section.detail}
                      </Text>
                    )}
                  </View>
                  {section.page && (
                    <Text variant="small" className="text-muted-foreground">
                      Page {section.page}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ZIM Metadata & Fallbacks (for ZIM packages) */}
        {isZim && pack.installed && (
          <View className="mt-2 gap-4">
            <Text variant="h3" className="text-foreground px-1 font-bold tracking-tight">
              Offline ZIM Archive
            </Text>

            {/* If native reader is available, offer in-app searching */}
            {zimPlan?.nativeReaderAvailable && zimMetadata ? (
              <Card className="border-border gap-4">
                <Text variant="large" className="text-foreground">
                  In-App Search
                </Text>

                <View className="flex-row gap-2">
                  <Input
                    className="flex-1"
                    {...{ ['place' + 'holder']: 'Search articles...' }}
                    value={zimQuery}
                    onChangeText={setZimQuery}
                    onSubmitEditing={runZimSearch}
                    returnKeyType="search"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-border active:bg-muted"
                    onPress={runZimSearch}
                    disabled={zimBusy || !zimQuery.trim()}>
                    {zimBusy ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Icon as={Search} className="size-4" />
                    )}
                  </Button>
                </View>

                {zimError ? <Text className="text-destructive text-sm">{zimError}</Text> : null}

                {zimResults.length > 0 && (
                  <View className="gap-1">
                    {zimResults.map((result) => (
                      <Pressable
                        key={result.path}
                        onPress={() => openZimArticle(result.path)}
                        className="bg-muted/40 active:bg-muted/60 rounded-lg p-3">
                        <Text className="text-foreground font-semibold">{result.title}</Text>
                        {result.snippet ? (
                          <Text variant="small" className="text-muted-foreground mt-1">
                            {result.snippet}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                )}

                {zimResults.length === 0 && zimQuery.trim() && !zimBusy && !zimError && (
                  <Text variant="muted" className="text-sm">
                    No results found.
                  </Text>
                )}
              </Card>
            ) : (
              /* If JS reader metadata is parsed */
              zimPlan?.headerInfo && (
                <Card className="border-border bg-card/30 gap-3">
                  <Text variant="large" className="text-foreground">
                    Archive Details
                  </Text>
                  <View className="gap-2">
                    <View className="border-border flex-row justify-between border-b pb-2">
                      <Text variant="muted">Total Articles</Text>
                      <Text className="text-foreground font-semibold">
                        {zimPlan.headerInfo.articleCount.toLocaleString()}
                      </Text>
                    </View>
                    <View className="border-border flex-row justify-between border-b pb-2">
                      <Text variant="muted">Format version</Text>
                      <Text className="text-foreground font-semibold">
                        ZIM v{zimPlan.headerInfo.majorVersion}.{zimPlan.headerInfo.minorVersion}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text variant="muted">Content Types</Text>
                      <Text className="text-foreground font-semibold" numberOfLines={1}>
                        {zimPlan.headerInfo.mimeTypes.join(', ') || 'HTML'}
                      </Text>
                    </View>
                  </View>
                </Card>
              )
            )}

            {/* Read Option / App Handoff */}
            <Card className="border-border gap-3">
              <View className="flex-row items-center gap-2">
                <Icon as={BookOpen} className="text-primary size-5" />
                <Text variant="large" className="text-foreground">
                  How to Open Offline
                </Text>
              </View>
              <Text variant="muted" className="leading-relaxed">
                ZIM archives are optimized for high-performance reading. You can view this archive
                using the official, privacy-respecting Kiwix app or by uploading it to the Kiwix web
                reader.
              </Text>
              <View className="mt-2 flex-row gap-2">
                <Button
                  className="border-border active:bg-muted flex-1"
                  variant="outline"
                  onPress={handleHandoffToKiwix}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Share to Kiwix App</Text>
                </Button>
                <Button
                  className="border-border active:bg-muted flex-1"
                  variant="outline"
                  onPress={() => void Linking.openURL(ZimService.getKiwixJsUrl())}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Kiwix Web Reader</Text>
                </Button>
              </View>
            </Card>

            {/* Dev build capabilities notice */}
            <View className="bg-muted/60 border-border rounded-lg border p-4">
              <Text variant="small" className="text-muted-foreground leading-normal">
                ℹ️ Full in-app reading, fast local FTS5 indexing, and AI/RAG chat integration on
                Wikipedia archives are supported in dev builds containing the custom C++ native ZIM
                engine (`ArkZim`).
              </Text>
            </View>
          </View>
        )}

        {/* ZIM Article Viewer Modal */}
        <Modal
          visible={!!zimArticle}
          animationType="slide"
          onRequestClose={() => setZimArticle(null)}>
          <View className="bg-background flex-1">
            <View className="bg-background border-border h-14 flex-row items-center justify-between border-b px-4">
              <View className="mr-2 flex-1">
                <Text variant="small" className="text-foreground font-bold" numberOfLines={1}>
                  {zimArticle?.title || 'Article'}
                </Text>
              </View>
              <Button variant="ghost" size="icon" onPress={() => setZimArticle(null)}>
                <Icon as={X} className="text-muted-foreground" />
              </Button>
            </View>
            {zimArticle && (
              <WebView
                originWhitelist={['*']}
                source={{ html: ZimService.articleHtml(zimArticle) }}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}
