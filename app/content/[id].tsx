import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { ContentPackService } from '@/services/content/content-pack.service';
import { GuideService, type GuideSection } from '@/services/content/guide.service';
import { ZimService } from '@/services/content/zim.service';
import type { ContentPack } from '@/types/content';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

function readerUri(pack: ContentPack, section?: GuideSection | null) {
  if (!pack.localUri) return null;
  if (pack.format !== 'pdf') return pack.localUri;
  if (!section?.page) return pack.localUri;
  return `${pack.localUri}#page=${section.page}`;
}

export default function ContentReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pack, setPack] = React.useState<ContentPack | null>(null);
  const [selectedSection, setSelectedSection] = React.useState<GuideSection | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sections = React.useMemo(() => (pack ? GuideService.getSections(pack.id) : []), [pack]);
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
    setSelectedSection(GuideService.getSections(pack.id)[0] ?? null);
  }, [pack?.id]);

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
            <Text variant="large">ZIM reader</Text>
            <Text variant="muted">{ZimService.getReaderStatus(pack)}</Text>
            <Text variant="muted">Kiwix JS: {ZimService.getKiwixJsUrl()}</Text>
            {ZimService.getLimitations().map((item) => (
              <View key={item} className="flex-row gap-2">
                <Text variant="muted">-</Text>
                <Text variant="muted" className="flex-1">
                  {item}
                </Text>
              </View>
            ))}
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
