import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { confirmDestructive, showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { useArkTextToSpeech } from '@/hooks/use-ark-text-to-speech';
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
  MoreVertical,
  Search,
  Share2,
  Trash2,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Linking, Modal, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Input } from '@/components/ui/input';
import { FileSystemService } from '@/services/files/filesystem.service';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function htmlToPlainText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\[\[[^\]|]+\|/g, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanZimPreviewText(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/<\/?(b|strong|i|em|mark)\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function zimArticleBaseUrl(article: ZimArticle) {
  return `https://ark.local/${article.finalPath.split('/').map(encodeURIComponent).join('/')}`;
}

function zimArticlePlainText(article: ZimArticle) {
  return [article.title, htmlToPlainText(ZimService.articleHtml(article))]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function resolveZimArticleHref(url: string, currentArticle?: ZimArticle | null) {
  if (!currentArticle) return null;
  if (!url || url === 'about:blank') return null;

  try {
    const parsed = new URL(url, zimArticleBaseUrl(currentArticle));
    if (parsed.hash && !parsed.pathname.replace(/^\/+/, '')) return null;
    if (parsed.hostname !== 'ark.local') return { externalUrl: parsed.toString() };

    const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    if (!path || path === currentArticle.finalPath) return null;
    return { articlePath: path };
  } catch {
    return null;
  }
}

type ZimArticleActionsSheetProps = {
  visible: boolean;
  zimSpeaking: boolean;
  speechPreparing: boolean;
  speechDisabled: boolean;
  shareDisabled: boolean;
  onDismiss: () => void;
  onSpeak: () => void;
  onShare: () => void;
};

function ZimArticleActionsSheet({
  visible,
  zimSpeaking,
  speechPreparing,
  speechDisabled,
  shareDisabled,
  onDismiss,
  onSpeak,
  onShare,
}: ZimArticleActionsSheetProps) {
  return (
    <ArkBottomSheet visible={visible} title="Article Actions" onDismiss={onDismiss}>
      <View className="gap-2">
        <Button
          variant="outline"
          disabled={speechDisabled}
          onPress={() => {
            onDismiss();
            onSpeak();
          }}>
          {speechPreparing ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={zimSpeaking ? VolumeX : Volume2} className="size-4" />
          )}
          <Text>
            {speechPreparing ? 'Preparing voice' : zimSpeaking ? 'Stop reading' : 'Read aloud'}
          </Text>
        </Button>
        <Button
          variant="outline"
          disabled={shareDisabled}
          onPress={() => {
            onDismiss();
            onShare();
          }}>
          <Icon as={Share2} className="size-4" />
          <Text>Share article</Text>
        </Button>
      </View>
    </ArkBottomSheet>
  );
}

export default function ContentDetailScreen() {
  const { id, article } = useLocalSearchParams<{ id: string; article?: string }>();
  const insets = useSafeAreaInsets();
  const speechPlayback = useArkTextToSpeech();
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
  const [zimArticleHistory, setZimArticleHistory] = React.useState<ZimArticle[]>([]);
  const [zimActionsOpen, setZimActionsOpen] = React.useState(false);
  const [zimSpeaking, setZimSpeaking] = React.useState(false);
  const zimSpeechPreparing = zimSpeaking && speechPlayback.isPreparing && !speechPlayback.isPlaying;

  const sections = React.useMemo(() => (pack ? GuideService.getSections(pack.id) : []), [pack]);

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      const loadedPack = await ContentPackService.getPack(id);
      setPack(loadedPack);

      if (loadedPack?.format === 'zim') {
        const plan = await ZimService.getReaderPlan(loadedPack);
        setZimPlan(plan);
        setZimMetadata(plan.metadata);
        setZimResults([]);
      } else {
        setZimPlan(null);
        setZimMetadata(null);
        setZimResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content.');
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

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
  }, [load, pack?.installStatus]);

  const openZimArticle = React.useCallback(
    async (path?: string | null, options: { pushHistory?: boolean } = {}) => {
      if (!pack || !path) return;
      const previousArticle = zimArticle;
      setZimBusy(true);
      setZimError(null);
      try {
        const nextArticle = await ZimService.getArticle(pack, path);
        if (options.pushHistory && previousArticle) {
          setZimArticleHistory((history) => [...history, previousArticle]);
        } else {
          setZimArticleHistory([]);
        }
        setZimArticle(nextArticle);
      } catch (articleError) {
        setZimError(
          articleError instanceof Error ? articleError.message : 'Article could not be opened.'
        );
      } finally {
        setZimBusy(false);
      }
    },
    [pack, zimArticle]
  );

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
  }, [article, openZimArticle, pack, zimPlan?.nativeReaderAvailable]);

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

  async function handleSpeakZimArticle() {
    if (!zimArticle) return;
    if (zimSpeaking) {
      speechPlayback.stop();
      setZimSpeaking(false);
      return;
    }
    const text = zimArticlePlainText(zimArticle).replace(/\s+/g, ' ').trim().slice(0, 2800);
    if (!text) return;
    setZimSpeaking(true);
    try {
      await speechPlayback.speak(text);
    } catch (speechError) {
      showSheetAlert(
        'Unable to read article',
        speechError instanceof Error ? speechError.message : 'Voice playback failed.'
      );
    } finally {
      setZimSpeaking(false);
    }
  }

  async function handleShareZimArticle() {
    if (!zimArticle) return;
    try {
      const articleText = zimArticlePlainText(zimArticle);
      if (!articleText) return;
      await FileSystemService.ensureAppDirectories();
      const safeTitle = FileSystemService.safeFileName(zimArticle.title) || 'zim-article';
      const uri = `${FileSystemService.dir('cache')}${safeTitle}.txt`;
      await FileSystem.writeAsStringAsync(uri, articleText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share ${zimArticle.title}`,
          mimeType: 'text/plain',
          UTI: 'public.plain-text',
        });
        return;
      }
      showSheetAlert('Article saved', 'Saved a plaintext copy to Ark cache.');
    } catch (shareError) {
      showSheetAlert(
        'Unable to share article',
        shareError instanceof Error ? shareError.message : 'Article export failed.'
      );
    }
  }

  async function handleHandoffToKiwix() {
    if (!pack) return;
    try {
      await ContentPackService.openPack(pack.id);
    } catch (err) {
      showSheetAlert('Unable to open', err instanceof Error ? err.message : 'Could not open file.');
    }
  }

  function handleZimArticleNavigation(url: string) {
    const target = resolveZimArticleHref(url, zimArticle);
    if (!target) return true;
    if ('articlePath' in target) {
      void openZimArticle(target.articlePath, { pushHistory: true });
      return false;
    }
    if ('externalUrl' in target) {
      void Linking.openURL(target.externalUrl).catch(() => undefined);
      return false;
    }
    return true;
  }

  function closeZimArticle() {
    speechPlayback.stop();
    setZimSpeaking(false);
    setZimActionsOpen(false);
    setZimArticle(null);
    setZimArticleHistory([]);
  }

  function goBackInZimArticle() {
    setZimArticleHistory((history) => {
      const previous = history[history.length - 1];
      if (previous) setZimArticle(previous);
      return history.slice(0, -1);
    });
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
  const searchableZimMetadata = canSearchInArk
    ? (zimMetadata ?? {
        id: pack.id,
        title: pack.title,
        description: pack.description,
        hasFulltextIndex: true,
        hasTitleIndex: true,
      })
    : null;
  const isLocalOnly = !pack.sourceUrl;

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
        {!(isZim && pack.installed) ? (
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
            {!pack.installed && !isLocalOnly && (
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

                  {!isZim && !isLocalOnly && (
                    <Button
                      variant="outline"
                      className={
                        isZim
                          ? 'border-border active:bg-muted flex-1'
                          : 'border-border active:bg-muted'
                      }
                      disabled={busy}
                      onPress={() =>
                        confirmDestructive({
                          title: 'Remove Pack?',
                          message: `Delete ${pack.title} from offline storage?`,
                          confirmLabel: 'Remove',
                          onConfirm: () => runAction(() => ContentPackService.removePack(pack.id)),
                        })
                      }>
                      <Icon as={Trash2} className="text-destructive size-4" />
                      <Text className="text-destructive">Remove</Text>
                    </Button>
                  )}
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
                    accessibilityLabel={`Cancel ${pack.title} download`}
                    size="icon"
                    variant="outline"
                    className="border-border active:bg-muted"
                    disabled={busy}
                    onPress={() =>
                      confirmDestructive({
                        title: 'Cancel download?',
                        message: pack.title,
                        cancelLabel: 'Keep',
                        confirmLabel: 'Cancel',
                        onConfirm: () =>
                          runAction(() => ContentPackService.cancelPackDownload(pack.id)),
                      })
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
              ) : isLocalOnly ? (
                <Button
                  className="bg-primary active:bg-primary/90 flex-1"
                  disabled={busy}
                  onPress={() => runAction(() => ContentPackService.installPack(pack.id))}>
                  {busy ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Icon as={Download} className="size-5" />
                  )}
                  <Text className="text-primary-foreground font-bold">Restore Guide</Text>
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
        ) : null}

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
                    accessibilityLabel="Search offline archive"
                    size="icon"
                    variant="outline"
                    className="border-border active:bg-muted"
                    onPress={runZimSearch}>
                    <Icon as={Search} className="size-4" />
                  </Button>
                </View>

                {zimBusy && (
                  <View className="items-center py-4">
                    <ActivityIndicator />
                  </View>
                )}

                {zimError && (
                  <Text className="text-destructive text-center text-sm">{zimError}</Text>
                )}

                {zimResults.length > 0 && (
                  <View className="border-border border-t pt-2">
                    {zimResults.slice(0, 12).map((result) => (
                      <Pressable
                        key={result.path}
                        onPress={() => void openZimArticle(result.path)}
                        className="active:bg-muted flex-row items-center justify-between py-3">
                        <View className="flex-1 pr-4">
                          <Text variant="default" className="text-foreground font-medium">
                            {cleanZimPreviewText(result.title)}
                          </Text>
                          {result.snippet && (
                            <Text variant="small" className="text-muted-foreground mt-0.5">
                              {cleanZimPreviewText(result.snippet)}
                            </Text>
                          )}
                        </View>
                        <Icon
                          as={ChevronLeft}
                          className="text-muted-foreground size-4 rotate-180"
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </Card>
            ) : (
              <Card className="border-border gap-4">
                <View className="gap-1">
                  <Text variant="large">In-app search unavailable</Text>
                  <Text variant="muted">
                    {zimPlan?.nativeReaderError ??
                      'This archive is best viewed in a dedicated reader like Kiwix.'}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onPress={handleHandoffToKiwix}>
                    <Icon as={ExternalLink} className="size-4" />
                    <Text>Open External</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onPress={() => void Linking.openURL(ZimService.getKiwixJsUrl())}>
                    <Text className="text-primary text-xs">Learn about Kiwix</Text>
                  </Button>
                </View>
              </Card>
            )}
          </View>
        )}
      </ArkKeyboardAwareScrollView>

      {/* ZIM Article Viewer Modal */}
      <Modal
        visible={Boolean(zimArticle)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeZimArticle}>
        <BottomSheetProvider>
          <View className="bg-background flex-1">
            <View
              className="border-border flex-row items-center justify-between border-b px-4"
              style={{ minHeight: insets.top + 56, paddingTop: insets.top }}>
              <View className="flex-row items-center gap-1">
                <Button variant="ghost" size="sm" onPress={closeZimArticle}>
                  <Text className="text-primary font-bold">Done</Text>
                </Button>
                {zimArticleHistory.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    accessibilityLabel="Back to previous article"
                    onPress={goBackInZimArticle}>
                    <Icon as={ChevronLeft} className="text-foreground size-4" />
                  </Button>
                ) : null}
              </View>
              <Text className="text-foreground font-bold" numberOfLines={1}>
                {zimArticle?.title}
              </Text>
              <View className="flex-row gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  accessibilityLabel="Article actions"
                  disabled={!zimArticle}
                  onPress={() => setZimActionsOpen(true)}>
                  <Icon as={MoreVertical} className="text-foreground" />
                </Button>
              </View>
            </View>
            <WebView
              originWhitelist={['https://*', 'http://*']}
              source={
                zimArticle
                  ? {
                      html: ZimService.articleHtml(zimArticle),
                      baseUrl: zimArticleBaseUrl(zimArticle),
                    }
                  : { html: '' }
              }
              onShouldStartLoadWithRequest={(request) => handleZimArticleNavigation(request.url)}
              style={{ flex: 1 }}
            />
            <ZimArticleActionsSheet
              visible={zimActionsOpen}
              zimSpeaking={zimSpeaking}
              speechPreparing={zimSpeechPreparing}
              speechDisabled={!zimArticle && !zimSpeaking}
              shareDisabled={!zimArticle}
              onDismiss={() => setZimActionsOpen(false)}
              onSpeak={() => void handleSpeakZimArticle()}
              onShare={() => void handleShareZimArticle()}
            />
          </View>
        </BottomSheetProvider>
      </Modal>
    </View>
  );
}
