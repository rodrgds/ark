import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { getNativePdf } from '@/components/readers/native-pdf';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { showSheetAlert } from '@/components/ui/sheet-alert';
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
import { ActivityIndicator, BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';

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
    var direct = document.getElementById(id) || document.getElementsByName(id)[0] || null;
    if (direct) return direct;
    var normalized = id.replace(/[-_]+/g, ' ').trim().toLowerCase();
    var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
    return headings.find(function(node) {
      var text = String(node.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      return text === normalized || text.indexOf(normalized) !== -1;
    }) || null;
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

function sectionScrollScript(sectionTitle: string, sectionTargets: string[] = []) {
  const targets = [sectionTitle, ...sectionTargets].filter((target) => target.trim().length > 0);

  return `
    (function() {
      var rawTargets = ${JSON.stringify(targets)};
      var normalize = function(value) {
        return String(value || '')
          .replace(/\\u00a0/g, ' ')
          .replace(/[\\u2018\\u2019]/g, "'")
          .replace(/[\\u201c\\u201d]/g, '"')
          .replace(/&/g, ' and ')
          .replace(/\\s+/g, ' ')
          .trim()
          .toLowerCase();
      };

      var slug = function(value) {
        return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      };

      var isVisible = function(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        var rect = node.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0 || node.offsetParent !== null;
      };

      var directTarget = function(raw) {
        var value = String(raw || '').trim().replace(/^#/, '');
        if (!value) return null;
        var ids = [value, slug(value)].filter(Boolean);
        for (var i = 0; i < ids.length; i += 1) {
          var id = ids[i];
          var target = null;
          if (window.CSS && CSS.escape) {
            target = document.querySelector('#' + CSS.escape(id));
          }
          target = target || document.getElementById(id) || document.getElementsByName(id)[0] || null;
          if (target) return target;
        }
        return null;
      };

      var textMatches = function(node, wanted) {
        if (!isVisible(node)) return false;
        var text = normalize(node.textContent);
        if (!text) return false;
        return text === wanted || text.indexOf(wanted) !== -1 || wanted.indexOf(text) !== -1;
      };

      var headingTarget = function(raw) {
        var wanted = normalize(raw);
        if (!wanted) return null;
        var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
        return headings.find(function(node) { return textMatches(node, wanted); }) || null;
      };

      var bodyTarget = function(raw) {
        var wanted = normalize(raw);
        if (!wanted) return null;
        var candidates = Array.prototype.slice.call(
          document.querySelectorAll('li,p,strong,summary,figcaption,.feature_mini,.wp-block-fema-feature-mini,.checklist_fema_blocks')
        );
        return candidates.find(function(node) { return textMatches(node, wanted); }) || null;
      };

      var findTarget = function(raw) {
        var value = String(raw || '').trim();
        if (!value) return null;
        if (value.charAt(0) === '#') return directTarget(value);
        return directTarget(value) || headingTarget(value) || bodyTarget(value);
      };

      var target = null;
      for (var i = 0; i < rawTargets.length; i += 1) {
        target = findTarget(rawTargets[i]);
        if (target) break;
      }

      if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    })();
    true;
  `;
}

export default function GuideReaderScreen() {
  const { packId, section, page } = useLocalSearchParams<{
    packId: string;
    section?: string;
    page?: string;
  }>();
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
      const requestedPage = page ? Number(page) : null;
      const nextPage =
        Number.isFinite(requestedPage) && requestedPage ? requestedPage : readerContent.page;
      if (nextPage) {
        setCurrentPage(nextPage);
        setInitialPage(nextPage);
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
  }, [packId, section, page]);

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
      showSheetAlert('Error', 'Unable to share document.');
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
      showSheetAlert('Error', err instanceof Error ? err.message : 'Unable to export guide.');
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
      setContent((prev) =>
        prev ? { ...prev, sectionTitle: targetSection.title, page: targetSection.page } : null
      );
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
            webViewRef.current?.injectJavaScript(
              sectionScrollScript(targetSection.title, newContent.sectionTargets)
            );
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
        <Text variant="muted" className="mt-4">
          Loading guide...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Arky pose="thinking" size={120} />
        <Text variant="large" className="text-destructive text-center">
          {error}
        </Text>
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
          className="bg-background border-border border-b">
          <View className="h-12 flex-row items-center justify-between px-3">
            <Button variant="ghost" size="icon" onPress={() => router.back()}>
              <Icon as={ChevronLeft} className="text-foreground" />
            </Button>
            <View className="mx-2 flex-1">
              <Text
                variant="small"
                className="text-foreground text-center font-bold"
                numberOfLines={1}>
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
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={exportingPdf}
                  onPress={handleExportPdf}>
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
        {content &&
          (isPdf && Pdf ? (
            <Pdf
              ref={pdfRef}
              source={pdfSource}
              page={initialPage}
              onPageChanged={(page: number) => {
                setCurrentPage(page);
                const currentSec = sections.find((s) => s.page === page);
                if (currentSec && content.sectionTitle !== currentSec.title) {
                  setContent((prev) => (prev ? { ...prev, sectionTitle: currentSec.title } : null));
                }
              }}
              onError={(err: unknown) => {
                setWebViewLoadError(
                  err && typeof err === 'object' && 'message' in err
                    ? String((err as any).message)
                    : String(err)
                );
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
                  webViewRef.current?.injectJavaScript(
                    sectionScrollScript(content.sectionTitle, content.sectionTargets)
                  );
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
          ))}
      </View>

      {/* WebView Error / Fallback Overlay */}
      {webViewLoadError && (
        <View
          style={{
            paddingTop: Math.max(20, insets.top),
            paddingBottom: Math.max(12, insets.bottom),
            zIndex: 200,
          }}
          className="bg-background absolute inset-0 flex-col items-center justify-center gap-6 p-8">
          <Arky pose="thinking" size={160} />
          <View className="items-center gap-2">
            <Text variant="h2" className="text-center">
              Unable to Display
            </Text>
            <Text variant="muted" className="text-center leading-6">
              {webViewLoadError}
            </Text>
            <Text variant="small" className="text-muted-foreground text-center">
              This format may not be supported by the built-in viewer.
            </Text>
          </View>
          <View className="w-full gap-3">
            <Button
              className="bg-primary h-14 w-full"
              onPress={() => {
                if (pack?.localUri) {
                  ContentPackService.openPack(pack.id).catch((err) => {
                    showSheetAlert(
                      'Error',
                      err instanceof Error ? err.message : 'Could not open file.'
                    );
                  });
                }
              }}>
              <Icon as={ExternalLink} className="text-primary-foreground" />
              <Text className="text-primary-foreground text-lg font-bold">
                Open in System Viewer
              </Text>
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
          style={{
            paddingTop: Math.max(20, insets.top),
            paddingBottom: Math.max(12, insets.bottom),
            zIndex: 150,
          }}
          className="bg-background/60 absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}

      <ArkBottomSheet
        visible={showToc}
        title="Table of Contents"
        onDismiss={() => setShowToc(false)}
        scrollable
        snapPoints={['80%']}>
        {sections.map((sec) => (
          <Pressable
            key={sec.title}
            onPress={() => handleSectionSelect(sec)}
            className="bg-muted/40 active:bg-muted/60 my-1 flex-row items-center justify-between rounded-xl p-4">
            <View className="flex-1 pr-4">
              <Text className="text-foreground font-bold">{sec.title}</Text>
              {sec.detail && (
                <Text variant="small" className="text-muted-foreground mt-1">
                  {sec.detail}
                </Text>
              )}
            </View>
            {sec.page && (
              <Text variant="small" className="text-primary/70">
                p.{sec.page}
              </Text>
            )}
          </Pressable>
        ))}
      </ArkBottomSheet>
    </View>
  );
}
