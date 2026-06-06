import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { showSheetAlert } from '@/components/ui/sheet-alert';
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
import {
  BookOpen,
  ChevronLeft,
  Download,
  ExternalLink,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Linking, Modal, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Input } from '@/components/ui/input';

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\[\[[^\]|]+\|/g, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ContentDetailScreen() {
  const { id, article } = useLocalSearchParams<{ id: string; article?: string }>();
  const insets = useSafeAreaInsets();
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
      if (!zimMetadata) {
        setZimMetadata(await ZimService.openArchive(pack));
      }
      setZimResults(await ZimService.search(pack, zimQuery));
    } catch (searchError) {
      setZimError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setZimBusy(false);
    }
  }

  async function prepareZimSearch() {
    if (!pack) return;
    setZimBusy(true);
    setZimError(null);
    try {
      setZimMetadata(await ZimService.openArchive(pack));
    } catch (archiveError) {
      setZimError(
        archiveError instanceof Error ? archiveError.message : 'Search could not be prepared.'
      );
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
      showSheetAlert('Unable to open', err instanceof Error ? err.message : 'Could not open file.');
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
  const canSearchInArk = Boolean(zimPlan?.nativeReaderAvailable);
  const searchableZimMetadata = canSearchInArk ? zimMetadata : null;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: pack.title }} />
      <ArkKeyboardAwareScrollView
        className="flex-1"
        automaticallyAdjustKeyboardInsets
        bottomOffset={90}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: Math.max(48, insets.bottom + 28),
        }}
        extraKeyboardSpace={32}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled">
        {/* Pack Info */}
        <View className="gap-2">
          {!isZim ? (
            <Text variant="h1" className="text-3xl font-extrabold tracking-tight">
              {pack.title}
            </Text>
          ) : null}
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
                ) : null}

                <Button
                  variant="outline"
                  className={
                    isZim ? 'border-border active:bg-muted flex-1' : 'border-border active:bg-muted'
                  }
                  disabled={busy}
                  onPress={() =>
                    showSheetAlert('Remove Pack?', `Delete ${pack.title} from offline storage?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => runAction(() => ContentPackService.removePack(pack.id)),
                      },
                    ])
                  }>
                  <Icon as={Trash2} className="text-destructive size-4" />
                  <Text className="text-destructive">{isZim ? 'Remove Archive' : 'Remove'}</Text>
                </Button>
              </>
            ) : pack.installStatus === 'downloading' ||
              pack.installStatus === 'queued' ||
              pack.installStatus === 'verifying' ? (
              <View className="flex-1 flex-row gap-2">
                <Button className="flex-1" disabled>
                  <ActivityIndicator size="small" />
                  <Text className="text-primary-foreground font-bold">
                    {pack.installStatus === 'verifying' ? 'Verifying' : 'Downloading'}
                  </Text>
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="border-border active:bg-muted"
                  disabled={busy}
                  onPress={() =>
                    showSheetAlert('Cancel download?', pack.title, [
                      { text: 'Keep', style: 'cancel' },
                      {
                        text: 'Cancel',
                        style: 'destructive',
                        onPress: () =>
                          runAction(() => ContentPackService.cancelPackDownload(pack.id)),
                      },
                    ])
                  }>
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Button>
              </View>
            ) : pack.installStatus === 'paused' ? (
              <Button
                className="bg-primary active:bg-primary/90 flex-1"
                disabled={busy}
                onPress={() => runAction(() => ContentPackService.resumePackDownload(pack.id))}>
                {busy ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Icon as={Download} className="size-5" />
                )}
                <Text className="text-primary-foreground font-bold">Resume Download</Text>
              </Button>
            ) : (
              <Button
                className="bg-primary active:bg-primary/90 flex-1"
                disabled={busy}
                onPress={() => runAction(() => ContentPackService.installPack(pack.id))}>
                {busy ? (
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
          <Card className="gap-3 border-amber-500/30 bg-amber-500/5">
            <View className="flex-row items-start gap-3">
              <View className="mt-0.5 rounded-md bg-amber-500/12 p-2">
                <Icon as={TriangleAlert} className="size-4 text-amber-500" />
              </View>
              <Text
                variant="small"
                className="flex-1 leading-relaxed font-medium text-amber-500/90">
                {pack.disclaimer}
              </Text>
            </View>
          </Card>
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
                  className={`border-border active:bg-muted/30 flex-row items-center justify-between border-b p-4 last:border-b-0 ${
                    !pack.installed ? 'opacity-50' : ''
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
            {searchableZimMetadata ? (
              <Card className="border-border gap-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1 gap-1">
                    <Text variant="large" className="text-foreground">
                      Search this archive
                    </Text>
                    <Text variant="muted">
                      Find articles inside the downloaded archive and open them directly in Ark.
                    </Text>
                  </View>
                  <View className="flex-row gap-1.5">
                    {searchableZimMetadata.hasFulltextIndex && (
                      <View className="bg-primary/10 rounded-full px-2 py-0.5">
                        <Text className="text-primary text-xs">Article text</Text>
                      </View>
                    )}
                    {searchableZimMetadata.hasTitleIndex && (
                      <View className="bg-primary/10 rounded-full px-2 py-0.5">
                        <Text className="text-primary text-xs">Titles</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <Input
                    className="flex-1"
                    placeholder={
                      searchableZimMetadata.hasFulltextIndex
                        ? 'Search articles...'
                        : searchableZimMetadata.hasTitleIndex
                          ? 'Search by title...'
                          : 'Search unavailable'
                    }
                    value={zimQuery}
                    onChangeText={setZimQuery}
                    onSubmitEditing={runZimSearch}
                    returnKeyType="search"
                    editable={
                      searchableZimMetadata.hasFulltextIndex || searchableZimMetadata.hasTitleIndex
                    }
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-border active:bg-muted"
                    onPress={runZimSearch}
                    disabled={
                      zimBusy ||
                      !zimQuery.trim() ||
                      (!searchableZimMetadata.hasFulltextIndex &&
                        !searchableZimMetadata.hasTitleIndex)
                    }>
                    {zimBusy ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Icon as={Search} className="size-4" />
                    )}
                  </Button>
                </View>

                {searchableZimMetadata.mainPath ? (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onPress={() => openZimArticle(searchableZimMetadata.mainPath)}>
                    <Icon as={BookOpen} className="size-4" />
                    <Text>Read Main Article</Text>
                  </Button>
                ) : null}

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
                          <Text
                            variant="small"
                            className="text-muted-foreground mt-1"
                            numberOfLines={3}>
                            {stripHtml(result.snippet)}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                )}

                {zimResults.length === 0 && zimQuery.trim() && !zimBusy && !zimError && (
                  <Text variant="muted" className="text-sm">
                    No results found.
                    {!searchableZimMetadata.hasFulltextIndex && searchableZimMetadata.hasTitleIndex
                      ? ' This archive only supports title search.'
                      : !searchableZimMetadata.hasFulltextIndex &&
                          !searchableZimMetadata.hasTitleIndex
                        ? ' This archive has no search index.'
                        : ''}
                  </Text>
                )}
              </Card>
            ) : canSearchInArk ? (
              <Card className="border-border gap-3">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1 gap-1">
                    <Text variant="large">Search this archive</Text>
                    <Text variant="muted">
                      Prepare search when you need it. Large archives may take a moment the first
                      time.
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={zimBusy}
                    onPress={() => void prepareZimSearch()}>
                    {zimBusy ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Icon as={Search} className="size-4" />
                    )}
                    <Text>Prepare</Text>
                  </Button>
                </View>
                {zimError ? <Text className="text-destructive text-sm">{zimError}</Text> : null}
              </Card>
            ) : zimPlan?.nativeReaderError ? (
              <View className="bg-muted/30 gap-2 rounded-lg px-4 py-3">
                <Text variant="large">Search is unavailable</Text>
                <Text variant="muted">
                  Use another reader for this archive on the current build.
                </Text>
              </View>
            ) : null}

            <View className="border-border bg-muted/20 gap-3 rounded-lg border px-4 py-4">
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={BookOpen} className="text-primary size-5" />
                  <Text variant="large" className="text-foreground">
                    Open elsewhere
                  </Text>
                </View>
                <Text variant="muted" className="leading-relaxed">
                  Use another reader on this device, or open the web reader for a larger screen.
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button
                  className="border-border active:bg-muted flex-1"
                  variant="outline"
                  onPress={handleHandoffToKiwix}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Open in...</Text>
                </Button>
                <Button
                  className="border-border active:bg-muted flex-1"
                  variant="outline"
                  onPress={() => void Linking.openURL(ZimService.getKiwixJsUrl())}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Web reader</Text>
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* ZIM Article Viewer Modal */}
        <Modal
          visible={!!zimArticle}
          animationType="slide"
          onRequestClose={() => setZimArticle(null)}>
          <View className="bg-background flex-1">
            {/* Header */}
            <View
              style={{ paddingTop: Math.max(20, insets.top) }}
              className="bg-background border-border border-b">
              <View className="h-14 flex-row items-center justify-between px-4">
                <Button variant="ghost" size="icon" onPress={() => setZimArticle(null)}>
                  <Icon as={ChevronLeft} className="text-foreground" />
                </Button>
                <View className="mx-2 flex-1">
                  <Text
                    variant="small"
                    className="text-foreground text-center font-bold"
                    numberOfLines={1}>
                    {zimArticle?.title || 'Article'}
                  </Text>
                </View>
                <View className="w-10" />
              </View>
            </View>

            {/* Article Content */}
            {zimArticle && (
              <WebView
                originWhitelist={[]}
                source={{ html: ZimService.articleHtml(zimArticle) }}
                injectedJavaScript={ZIM_LINK_SCRIPT}
                onMessage={(event) => {
                  const path = resolveZimHref(zimArticle.finalPath, event.nativeEvent.data);
                  if (path) void openZimArticle(path);
                }}
                onShouldStartLoadWithRequest={(request) => {
                  if (!request.url || request.url === 'about:blank') return true;
                  const path = resolveZimHref(zimArticle.finalPath, request.url);
                  if (!path) return true;
                  void openZimArticle(path);
                  return false;
                }}
                style={{ flex: 1 }}
              />
            )}

            <View style={{ height: Math.max(8, insets.bottom) }} />
          </View>
        </Modal>
      </ArkKeyboardAwareScrollView>
    </View>
  );
}

const ZIM_LINK_SCRIPT = `
(function() {
  if (window.__arkZimLinksInstalled) return true;
  window.__arkZimLinksInstalled = true;
  document.addEventListener('click', function(event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    event.preventDefault();
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(href);
  }, true);
  true;
})();
true;
`;

function resolveZimHref(currentPath: string, rawHref: string) {
  const href = rawHref.trim();
  if (!href || href.startsWith('#')) return null;
  if (/^(mailto|tel|sms|data|javascript):/i.test(href)) return null;

  let path = href;
  try {
    if (/^https?:\/\//i.test(href)) {
      const parsed = new URL(href);
      path = parsed.pathname;
    }
  } catch {
    path = href;
  }

  path = path.split('#')[0]?.split('?')[0] ?? '';
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the original path when a link contains partial escaping.
  }
  path = path.replace(/^\/+/, '');
  if (!path) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  const baseParts = currentPath.split('/');
  baseParts.pop();
  const rawParts =
    path.startsWith('./') || path.startsWith('../')
      ? [...baseParts, ...path.split('/')]
      : path.includes('/')
        ? path.split('/')
        : [...baseParts, path];
  const resolved: string[] = [];
  for (const part of rawParts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}
