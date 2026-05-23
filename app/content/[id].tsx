import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { ContentPackService } from '@/services/content/content-pack.service';
import { GuideService, type GuideSection } from '@/services/content/guide.service';
import { ZimService, type ZimArticle, type ZimMetadata, type ZimSearchResult } from '@/services/content/zim.service';
import type { ContentPack } from '@/types/content';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BookOpen, Download, ExternalLink, FileText, Search, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

function readerUri(pack: ContentPack, section?: GuideSection | null) {
  if (!pack.localUri) return null;
  if (pack.format !== 'pdf') return pack.localUri;
  if (!section?.page) return pack.localUri;
  return `${pack.localUri}#page=${section.page}`;
}

export default function ContentReaderScreen() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const [pack, setPack] = React.useState<ContentPack | null>(null);
  const [selectedSection, setSelectedSection] = React.useState<GuideSection | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [zimBusy, setZimBusy] = React.useState(false);
  const [zimError, setZimError] = React.useState<string | null>(null);
  const [zimMetadata, setZimMetadata] = React.useState<ZimMetadata | null>(null);
  const [zimQuery, setZimQuery] = React.useState('');
  const [zimResults, setZimResults] = React.useState<ZimSearchResult[]>([]);
  const [zimArticle, setZimArticle] = React.useState<ZimArticle | null>(null);

  const sections = React.useMemo(() => (pack ? GuideService.getSections(pack.id) : []), [pack]);
  const zimPlan = React.useMemo(() => (pack?.format === 'zim' ? ZimService.getReaderPlan(pack) : null), [pack]);
  const uri = pack ? readerUri(pack, selectedSection) : null;

  async function load() {
    if (!id) return;
    setPack(await ContentPackService.getPack(id));
  }

  React.useEffect(() => {
    void load();
  }, [id]);

  React.useEffect(() => {
    if (!pack) return;
    const nextSections = GuideService.getSections(pack.id);
    const requestedSection = Array.isArray(section) ? section[0] : section;
    setSelectedSection(
      nextSections.find((item) => item.title === requestedSection) ?? nextSections[0] ?? null
    );
  }, [pack?.id, section]);

  React.useEffect(() => {
    setZimError(null);
    setZimMetadata(null);
    setZimResults([]);
    setZimArticle(null);
    if (!pack || pack.format !== 'zim' || !pack.installed) return;

    let canceled = false;
    setZimBusy(true);
    ZimService.openArchive(pack)
      .then((metadata) => {
        if (!canceled) setZimMetadata(metadata);
      })
      .catch((archiveError) => {
        if (!canceled) {
          setZimError(
            archiveError instanceof Error
              ? archiveError.message
              : 'In-app ZIM reader is not available.'
          );
        }
      })
      .finally(() => {
        if (!canceled) setZimBusy(false);
      });

    return () => {
      canceled = true;
    };
  }, [pack?.id, pack?.installed, pack?.localUri]);

  async function run(action: () => Promise<void>) {
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
      setZimError(articleError instanceof Error ? articleError.message : 'Article could not open.');
    } finally {
      setZimBusy(false);
    }
  }

  if (!pack) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text variant="muted">Loading content...</Text>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: pack.title }} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="gap-2">
          <Text variant="h1" className="text-3xl">
            {pack.title}
          </Text>
          <Text variant="muted">{pack.description}</Text>
        </View>

        <Card className="gap-3">
          <View className="flex-row flex-wrap gap-x-3 gap-y-1">
            <Text variant="muted">
              {pack.category} - {pack.format.toUpperCase()} - {pack.estimatedSize}
            </Text>
            {pack.sourceLabel ? <Text variant="muted">{pack.sourceLabel}</Text> : null}
          </View>
          <Progress value={pack.progress} />
          <Text variant="small">
            {pack.installed
              ? 'Installed offline'
              : `${Math.round(pack.progress * 100)}% - ${pack.installStatus.replace('_', ' ')}`}
          </Text>
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
          <View className="flex-row gap-2">
            {pack.installed ? (
              <>
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={busy}
                  onPress={() => run(() => ContentPackService.openPack(pack.id))}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Open File</Text>
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={busy}
                  onPress={() => run(() => ContentPackService.removePack(pack.id))}>
                  <Icon as={Trash2} className="size-4" />
                </Button>
              </>
            ) : (
              <Button
                className="flex-1"
                disabled={busy || pack.installStatus === 'downloading'}
                onPress={() => run(() => ContentPackService.installPack(pack.id))}>
                {busy || pack.installStatus === 'downloading' ? (
                  <ActivityIndicator />
                ) : (
                  <Icon as={Download} className="size-4" />
                )}
                <Text>Download</Text>
              </Button>
            )}
          </View>
        </Card>

        {sections.length > 0 ? (
          <Card className="gap-3">
            <Text variant="large">Sections</Text>
            <View className="gap-2">
              {sections.map((section) => {
                const selected = selectedSection?.title === section.title;
                return (
                  <Button
                    key={section.title}
                    variant={selected ? 'default' : 'outline'}
                    onPress={() => setSelectedSection(section)}>
                    <Text>{section.title}</Text>
                  </Button>
                );
              })}
            </View>
            {selectedSection ? <Text variant="muted">{selectedSection.detail}</Text> : null}
          </Card>
        ) : null}

        {pack.format === 'zim' ? (
          <Card className="gap-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">Wikipedia reader</Text>
                <Text variant="muted">{zimPlan?.status}</Text>
              </View>
              {zimBusy ? <ActivityIndicator /> : null}
            </View>

            {zimMetadata ? (
              <View className="bg-muted/40 gap-1 rounded-md p-3">
                <Text>{zimMetadata.title || pack.title}</Text>
                <Text variant="small">
                  {zimMetadata.language ? `${zimMetadata.language.toUpperCase()} - ` : ''}
                  {zimMetadata.articleCount
                    ? `${zimMetadata.articleCount.toLocaleString()} articles`
                    : 'In-app reader ready'}
                </Text>
              </View>
            ) : (
              <Text>{zimPlan?.nextStep}</Text>
            )}

            {zimMetadata ? (
              <View className="gap-2">
                <Text variant="small">Search this archive</Text>
                <View className="flex-row gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    value={zimQuery}
                    onChangeText={setZimQuery}
                    accessibilityLabel="Search this archive"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={runZimSearch}
                  />
                  <Button size="icon" disabled={zimBusy || zimQuery.trim().length < 2} onPress={runZimSearch}>
                    <Icon as={Search} className="size-4" />
                  </Button>
                </View>
                {zimMetadata.mainPath ? (
                  <Button
                    variant="outline"
                    disabled={zimBusy}
                    onPress={() => openZimArticle(zimMetadata.mainPath)}>
                    <Icon as={BookOpen} className="size-4" />
                    <Text>Main Page</Text>
                  </Button>
                ) : null}
              </View>
            ) : null}

            {zimError ? <Text className="text-destructive text-sm">{zimError}</Text> : null}

            {zimResults.length > 0 ? (
              <View className="border-border overflow-hidden rounded-md border">
                {zimResults.map((result) => (
                  <Pressable
                    key={result.path}
                    className="border-border active:bg-muted gap-1 border-b p-3 last:border-b-0"
                    onPress={() => openZimArticle(result.path)}>
                    <Text>{result.title}</Text>
                    {result.snippet ? <Text variant="small">{result.snippet}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="outline"
                onPress={() => void Linking.openURL(ZimService.getKiwixJsUrl())}>
                <Icon as={ExternalLink} className="size-4" />
                <Text>Kiwix Web</Text>
              </Button>
              {zimPlan?.handoffAvailable ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onPress={() => run(() => ContentPackService.openPack(pack.id))}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Open in Reader</Text>
                </Button>
              ) : null}
            </View>
            {zimPlan?.limitations.map((item) => (
              <View key={item} className="flex-row gap-2">
                <Text variant="muted">-</Text>
                <Text variant="muted" className="flex-1">
                  {item}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {zimArticle ? (
          <Card className="overflow-hidden p-0">
            <View className="border-border flex-row items-center gap-2 border-b p-3">
              <Icon as={BookOpen} className="text-primary size-5" />
              <View className="min-w-0 flex-1">
                <Text variant="large" className="min-w-0">
                  {zimArticle.title}
                </Text>
                <Text variant="small">{zimArticle.finalPath}</Text>
              </View>
            </View>
            <View className="bg-background h-[620px]">
              <WebView
                originWhitelist={['*']}
                source={{ html: ZimService.articleHtml(zimArticle) }}
                startInLoadingState
                renderLoading={() => (
                  <View className="bg-background flex-1 items-center justify-center">
                    <ActivityIndicator />
                  </View>
                )}
              />
            </View>
          </Card>
        ) : null}

        {uri && pack.format !== 'zim' ? (
          <Card className="overflow-hidden p-0">
            <View className="border-border flex-row items-center gap-2 border-b p-3">
              <Icon as={FileText} className="text-primary size-5" />
              <Text variant="large">Reader</Text>
            </View>
            <View className="bg-background h-[620px]">
              <WebView
                originWhitelist={['*']}
                source={{ uri }}
                allowFileAccess
                allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
                startInLoadingState
                renderLoading={() => (
                  <View className="bg-background flex-1 items-center justify-center">
                    <ActivityIndicator />
                  </View>
                )}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
