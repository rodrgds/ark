import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Arky } from '@/components/brand/ark-logo';
import { ContentPackService } from '@/services/content/content-pack.service';
import { GuideReaderService, type ReaderContent } from '@/services/content/guide-reader.service';
import { GuideService, type GuideSection } from '@/services/content/guide.service';
import type { ContentPack } from '@/types/content';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ExternalLink, List, Share2, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';

const TAP_DETECTION_SCRIPT = `
(function() {
  if (window._arkTapInjected) return;
  window._arkTapInjected = true;
  let lastTap = 0;
  document.addEventListener('click', function() {
    const now = Date.now();
    if (now - lastTap < 300) return;
    lastTap = now;
    window.ReactNativeWebView.postMessage('tap');
  });
})();
true;
`;

export default function GuideReaderScreen() {
  const { packId, section } = useLocalSearchParams<{ packId: string; section?: string }>();
  const insets = useSafeAreaInsets();
  const [pack, setPack] = React.useState<ContentPack | null>(null);
  const [sections, setSections] = React.useState<GuideSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<ReaderContent | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showToc, setShowToc] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const [webViewLoadError, setWebViewLoadError] = React.useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = React.useState(false);
  const webViewRef = React.useRef<WebView>(null);

  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // PDFs in WebView cannot receive injected JS tap events, so keep controls visible
  const canAutoHideControls = content ? content.format !== 'pdf' : true;

  const resetControlsTimeout = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  React.useEffect(() => {
    if (!canAutoHideControls) {
      setShowControls(true);
      return;
    }
    if (showControls) {
      resetControlsTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, canAutoHideControls, resetControlsTimeout]);

  const toggleControls = React.useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  async function loadPackAndContent() {
    if (!packId) return;
    setLoading(true);
    setError(null);
    setWebViewLoadError(null);
    try {
      const currentPack = await ContentPackService.getPack(packId);
      if (!currentPack) throw new Error('Guide pack not found.');
      setPack(currentPack);

      const guideSections = GuideService.getSections(packId);
      setSections(guideSections);

      let initialSection: GuideSection | null = null;
      if (section) {
        initialSection = guideSections.find((s) => s.title === section) ?? null;
      }

      const readerContent = await GuideReaderService.prepareContent(currentPack, initialSection);
      setContent(readerContent);
      if (readerContent.page) {
        setCurrentPage(readerContent.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load content.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadPackAndContent();
  }, [packId, section]);

  React.useEffect(() => {
    const onBackPress = () => {
      if (showToc) {
        setShowToc(false);
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [showToc]);

  async function handleShare() {
    if (!pack?.localUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pack.localUri);
      }
    } catch {
      Alert.alert('Error', 'Unable to share document.');
    }
  }

  function handleSectionSelect(targetSection: GuideSection) {
    setShowToc(false);
    setWebViewLoadError(null);
    setLoading(true);
    GuideReaderService.prepareContent(pack!, targetSection)
      .then((newContent) => {
        setContent(newContent);
        if (newContent.page) setCurrentPage(newContent.page);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load section.'))
      .finally(() => setLoading(false));
  }

  const isPdf = content?.format === 'pdf';

  if (loading && !content) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" />
        <Text variant="muted" className="mt-4">Loading guide...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6 gap-4">
        <Arky pose="thinking" size={120} />
        <Text variant="large" className="text-destructive text-center">{error}</Text>
        <Button variant="outline" onPress={loadPackAndContent}>
          <Text>Retry</Text>
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Go Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Main Content Area */}
      <View className="flex-1">
        {content && (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={content.uri ? { uri: content.uri } : { html: content.html! }}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            allowingReadAccessToURL={content.allowReadAccessToURL}
            style={{ width: '100%', height: '100%', marginTop: insets.top, marginBottom: insets.bottom }}
            scalesPageToFit={isPdf}
            injectedJavaScript={!isPdf ? TAP_DETECTION_SCRIPT : undefined}
            onMessage={(event) => {
              if (event.nativeEvent.data === 'tap' && canAutoHideControls) {
                toggleControls();
              }
            }}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setWebViewLoadError(nativeEvent.description || 'Failed to load content.');
              setWebViewLoading(false);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setWebViewLoadError(`HTTP ${nativeEvent.statusCode}: ${nativeEvent.description}`);
              setWebViewLoading(false);
            }}
          />
        )}
      </View>

      {/* WebView Error / Fallback Overlay */}
      {webViewLoadError && (
        <View
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          className="absolute inset-0 z-[60] bg-background flex-col items-center justify-center p-8 gap-6"
        >
          <Arky pose="thinking" size={160} />
          <View className="gap-2 items-center">
            <Text variant="h2" className="text-center">Unable to Display</Text>
            <Text variant="muted" className="text-center leading-6">
              {webViewLoadError}
            </Text>
            <Text variant="small" className="text-muted-foreground text-center">
              This format may not be supported by the built-in viewer.
            </Text>
          </View>
          <View className="gap-3 w-full">
            <Button
              className="h-14 w-full rounded-2xl bg-primary"
              onPress={() => {
                if (pack?.localUri) {
                  ContentPackService.openPack(pack.id).catch((err) => {
                    Alert.alert('Error', err instanceof Error ? err.message : 'Could not open file.');
                  });
                }
              }}
            >
              <Icon as={ExternalLink} className="text-primary-foreground" />
              <Text className="text-primary-foreground text-lg font-bold">Open in System Viewer</Text>
            </Button>
            <Button variant="ghost" onPress={() => router.back()}>
              <Text>Go Back</Text>
            </Button>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {(loading || webViewLoading) && content && (
        <View
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          className="absolute inset-0 z-[60] bg-background/60 items-center justify-center"
        >
        <ActivityIndicator size="large" />
        </View>
      )}

      {/* Overlays */}
      {showControls && !webViewLoadError && (
        <>
          {/* Header */}
          <View
            style={{ paddingTop: insets.top }}
            className="absolute top-0 left-0 right-0 z-50 bg-background/80 border-b border-border"
          >
            <View className="flex-row items-center justify-between px-4 h-14">
              <Button variant="ghost" size="icon" onPress={() => router.back()}>
                <Icon as={ChevronLeft} className="text-foreground" />
              </Button>
              <View className="flex-1 mx-2">
                <Text variant="small" className="text-foreground font-bold text-center" numberOfLines={1}>
                  {pack?.title}
                </Text>
              </View>
              <View className="flex-row gap-1">
                {sections.length > 0 && (
                  <Button variant="ghost" size="icon" onPress={() => setShowToc(true)}>
                    <Icon as={List} className="text-foreground" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onPress={handleShare}>
                  <Icon as={Share2} className="text-foreground" />
                </Button>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View
            style={{ paddingBottom: insets.bottom }}
            className="absolute bottom-0 left-0 right-0 z-50 bg-background/80 border-t border-border"
          >
            <View className="px-6 h-14 justify-center">
              <Text variant="small" className="text-muted-foreground font-medium">
                {content?.sectionTitle || 'Reading Guide'}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* TOC Drawer */}
      <Modal visible={showToc} animationType="slide" transparent={true} onRequestClose={() => setShowToc(false)}>
        <View className="flex-1 bg-background/60 justify-end">
          <Pressable className="flex-1" onPress={() => setShowToc(false)} />
          <View style={{ paddingBottom: insets.bottom + 20 }} className="bg-card border-t border-border rounded-t-3xl max-h-[80%]">
            <View className="flex-row items-center justify-between px-6 py-5 border-b border-border">
              <Text variant="h3" className="text-foreground">Table of Contents</Text>
              <Button variant="ghost" size="icon" onPress={() => setShowToc(false)}>
                <Icon as={X} className="text-muted-foreground" />
              </Button>
            </View>
            <ScrollView className="px-3 pt-2">
              {sections.map((sec) => (
                <Pressable
                  key={sec.title}
                  onPress={() => handleSectionSelect(sec)}
                  className="flex-row items-center justify-between p-4 my-1 rounded-xl bg-muted/40 active:bg-muted/60"
                >
                  <View className="flex-1 pr-4">
                    <Text className="font-bold text-foreground">{sec.title}</Text>
                    {sec.detail && <Text variant="small" className="text-muted-foreground mt-1">{sec.detail}</Text>}
                  </View>
                  {sec.page && <Text variant="small" className="text-primary/70">p.{sec.page}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
