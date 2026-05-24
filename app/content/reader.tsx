import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Arky } from '@/components/brand/ark-logo';
import { ContentPackService } from '@/services/content/content-pack.service';
import { GuidePdfService } from '@/services/content/guide-pdf.service';
import { GuideReaderService, type ReaderContent } from '@/services/content/guide-reader.service';
import { GuideService, type GuideSection } from '@/services/content/guide.service';
import type { ContentPack } from '@/types/content';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ExternalLink, List, Printer, Share2, X } from 'lucide-react-native';
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

let NativePdf: React.ComponentType<any> | null | undefined;

function getNativePdf() {
  if (NativePdf !== undefined) return NativePdf;
  try {
    const module = require('react-native-pdf') as { default?: React.ComponentType<any> };
    NativePdf = module.default ?? (module as unknown as React.ComponentType<any>);
  } catch {
    NativePdf = null;
  }
  return NativePdf;
}

const HTML_READER_SCRIPT = `
(function() {
  if (window._arkReaderInjected) return;
  window._arkReaderInjected = true;

  var style = document.createElement('style');
  style.textContent = 'img{max-width:100%!important;width:auto!important;height:auto!important;} .ark-snapshot img{width:auto!important;max-width:100%!important;}';
  document.head.appendChild(style);

  function decodeHash(hash) {
    try {
      return decodeURIComponent(String(hash || '').replace(/^#/, ''));
    } catch (_) {
      return String(hash || '').replace(/^#/, '');
    }
  }

  function findAnchorTarget(hash) {
    var id = decodeHash(hash);
    if (!id) return null;
    if (window.CSS && CSS.escape) {
      var escaped = CSS.escape(id);
      var byId = document.querySelector('#' + escaped);
      if (byId) return byId;
    }
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  function scrollToHash(hash) {
    var target = findAnchorTarget(hash);
    if (!target) return false;
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (history.replaceState) history.replaceState(null, '', '#' + decodeHash(hash));
    return true;
  }

  document.addEventListener('click', function(event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var hash = link.hash || (href.charAt(0) === '#' ? href : '');
    if (!hash) return;
    event.preventDefault();
    scrollToHash(hash);
  }, true);

  window.__arkScrollToHash = scrollToHash;
})();
true;
`;

function sectionScrollScript(sectionTitle: string) {
  return `
    (function() {
      var targetTitle = ${JSON.stringify(sectionTitle)};
      var normalize = function(value) {
        return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      };
      var wanted = normalize(targetTitle);
      var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
      var target = headings.find(function(node) { return normalize(node.textContent).indexOf(wanted) !== -1; });
      if (!target) {
        var id = wanted.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        target = document.getElementById(id) || document.getElementsByName(id)[0] || null;
      }
      if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    })();
    true;
  `;
}

export default function GuideReaderScreen() {
  const { packId, section } = useLocalSearchParams<{ packId: string; section?: string }>();
  const insets = useSafeAreaInsets();
  const [pack, setPack] = React.useState<ContentPack | null>(null);
  const [sections, setSections] = React.useState<GuideSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<ReaderContent | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [initialPage, setInitialPage] = React.useState(1);
  const [showToc, setShowToc] = React.useState(false);
  const [webViewLoadError, setWebViewLoadError] = React.useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = React.useState(false);
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const webViewRef = React.useRef<WebView>(null);
  const pdfRef = React.useRef<any>(null);

  const pdfSource = React.useMemo(() => {
    return { uri: content?.uri || '' };
  }, [content?.uri]);

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
        setInitialPage(readerContent.page);
      } else {
        setCurrentPage(1);
        setInitialPage(1);
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

  async function handleExportPdf() {
    if (!pack) return;
    setExportingPdf(true);
    try {
      const { uri } = await GuidePdfService.export(pack);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Print ${pack.title}`,
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
        return;
      }
      await ContentPackService.openPack(pack.id);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unable to export guide.');
    } finally {
      setExportingPdf(false);
    }
  }

  function handleSectionSelect(targetSection: GuideSection) {
    setShowToc(false);
    setWebViewLoadError(null);

    if (isPdf && targetSection.page) {
      setCurrentPage(targetSection.page);
      setInitialPage(targetSection.page);
      setContent((prev) => prev ? { ...prev, sectionTitle: targetSection.title, page: targetSection.page } : null);
      pdfRef.current?.setPage(targetSection.page);
      return;
    }

    setLoading(true);
    GuideReaderService.prepareContent(pack!, targetSection)
      .then((newContent) => {
        setContent(newContent);
        if (newContent.page) {
          setCurrentPage(newContent.page);
          setInitialPage(newContent.page);
        }
        if (newContent.format === 'html') {
          requestAnimationFrame(() => {
            webViewRef.current?.injectJavaScript(sectionScrollScript(targetSection.title));
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load section.'))
      .finally(() => {
        setLoading(false);
      });
  }

  const isPdf = content?.format === 'pdf';
  const canOpenForPrint = content?.format === 'html' || content?.format === 'text';
  const Pdf = isPdf ? getNativePdf() : null;

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

      {/* Header */}
      {!webViewLoadError && (
        <View
          style={{ paddingTop: Math.max(8, insets.top), zIndex: 100 }}
          className="bg-background border-b border-border"
        >
          <View className="flex-row items-center justify-between px-3 h-12">
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
              {canOpenForPrint ? (
                <Button variant="ghost" size="icon" disabled={exportingPdf} onPress={handleExportPdf}>
                  {exportingPdf ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Icon as={Printer} className="text-foreground" />
                  )}
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onPress={handleShare}>
                <Icon as={Share2} className="text-foreground" />
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* Main Content Area */}
      <View className="flex-1">
        {content && (
          isPdf && Pdf ? (
            <Pdf
              ref={pdfRef}
              source={pdfSource}
              page={initialPage}
              onPageChanged={(page: number) => {
                setCurrentPage(page);
                const currentSec = sections.find((s) => s.page === page);
                if (currentSec && content.sectionTitle !== currentSec.title) {
                  setContent((prev) => prev ? { ...prev, sectionTitle: currentSec.title } : null);
                }
              }}
              onError={(err: unknown) => {
                setWebViewLoadError(err && typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err));
              }}
              style={{ flex: 1, backgroundColor: '#000000' }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={
                content.uri
                  ? { uri: content.uri }
                  : { html: content.html!, baseUrl: content.allowReadAccessToURL }
              }
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowingReadAccessToURL={content.allowReadAccessToURL}
              style={{ flex: 1 }}
              scalesPageToFit={isPdf}
              injectedJavaScript={!isPdf ? HTML_READER_SCRIPT : undefined}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => {
                setWebViewLoading(false);
                if (content.sectionTitle) {
                  webViewRef.current?.injectJavaScript(sectionScrollScript(content.sectionTitle));
                }
              }}
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
          )
        )}
      </View>

      {/* WebView Error / Fallback Overlay */}
      {webViewLoadError && (
        <View
          style={{ paddingTop: Math.max(20, insets.top), paddingBottom: Math.max(12, insets.bottom), zIndex: 200 }}
          className="absolute inset-0 bg-background flex-col items-center justify-center p-8 gap-6"
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
              className="h-14 w-full bg-primary"
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
          style={{ paddingTop: Math.max(20, insets.top), paddingBottom: Math.max(12, insets.bottom), zIndex: 150 }}
          className="absolute inset-0 bg-background/60 items-center justify-center"
        >
        <ActivityIndicator size="large" />
        </View>
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
