import { Arky } from '@/components/brand/ark-logo';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { useArkTextToSpeech } from '@/hooks/use-ark-text-to-speech';
import OcrService from '@/modules/ark-ocr';
import { ContentPackService } from '@/services/content/content-pack.service';
import { GuideReaderService, type ReaderContent } from '@/services/content/guide-reader.service';
import type { EffectiveTheme, ThemeColors } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import { GuidePdfService } from '@/services/content/guide-pdf.service';
import { GuideService, type GuideSection } from '@/services/content/guide.service';
import type { ContentPack } from '@/types/content';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import {
  ChevronLeft,
  ExternalLink,
  List,
  MoreVertical,
  Printer,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';

function getNativePdf() {
  try {
    return require('react-native-pdf').default;
  } catch {
    return null;
  }
}

function readerThemeScript(theme: EffectiveTheme, colors: ThemeColors) {
  const selection = theme === 'light' ? 'rgba(74, 87, 66, 0.18)' : 'rgba(149, 167, 139, 0.28)';

  return `
(function() {
  var css = ${JSON.stringify(`
    :root {
      color-scheme: ${theme === 'light' ? 'light' : 'dark'};
      --ark-bg: ${colors.background};
      --ark-fg: ${colors.foreground};
      --ark-muted: ${colors.mutedForeground};
      --ark-accent: ${colors.primary};
      --ark-card: ${colors.card};
      --ark-border: ${colors.border};
    }
    html, body {
      background: var(--ark-bg) !important;
      color: var(--ark-fg) !important;
    }
    body { padding: 16px !important; }
    h1, h2, h3, h4, h5, h6 {
      color: var(--ark-fg) !important;
    }
    a { color: var(--ark-accent) !important; }
    code, pre, blockquote, table, th, td {
      border-color: var(--ark-border) !important;
    }
    pre, code, blockquote, th {
      background: var(--ark-card) !important;
    }
    blockquote { color: var(--ark-muted) !important; }
    ::selection { background: ${selection}; }
  `)};
  var style = document.getElementById('ark-runtime-theme');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ark-runtime-theme';
    document.head.appendChild(style);
  }
  style.textContent = css;
  document.documentElement.style.colorScheme = ${JSON.stringify(theme === 'light' ? 'light' : 'dark')};
  var postReaderText = function() {
    var text = document.body && document.body.innerText;
    if (!text || !window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ark-reader-text',
      text: text.slice(0, 3000)
    }));
  };
  setTimeout(postReaderText, 200);
  setTimeout(postReaderText, 900);
})();
true;
`;
}

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

function buildReaderSpeechText(
  pack: ContentPack | null,
  content: ReaderContent | null,
  currentPage: number,
  webTextSnapshot = ''
) {
  if (!content) return '';
  const parts = [
    pack?.title,
    content.sectionTitle,
    content.format === 'pdf' ? `Page ${content.page ?? currentPage}.` : null,
    content.html ? htmlToSpeechText(content.html) : webTextSnapshot,
  ];
  return parts.filter(Boolean).join('. ').replace(/\s+/g, ' ').trim().slice(0, 2800);
}

function htmlToSpeechText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

type GuideReaderState = {
  pack: ContentPack | null;
  sections: GuideSection[];
  loading: boolean;
  error: string | null;
  content: ReaderContent | null;
  initialPage: number;
  showToc: boolean;
  webViewLoadError: string | null;
  webViewLoading: boolean;
  exportingPdf: boolean;
  readerSpeaking: boolean;
};

type GuideReaderAction =
  | { type: 'loadStarted' }
  | {
      type: 'loadSucceeded';
      pack: ContentPack;
      sections: GuideSection[];
      content: ReaderContent;
      initialPage: number;
    }
  | { type: 'loadFailed'; error: string }
  | { type: 'retryAfterError' }
  | { type: 'tocVisibilityChanged'; visible: boolean }
  | { type: 'webViewLoadErrorChanged'; error: string | null }
  | { type: 'webViewLoadingChanged'; loading: boolean }
  | { type: 'contentChanged'; content: ReaderContent | null; initialPage?: number }
  | { type: 'sectionTitleChanged'; title: string; page?: number }
  | { type: 'exportingPdfChanged'; exporting: boolean }
  | { type: 'readerSpeakingChanged'; speaking: boolean };

const initialGuideReaderState: GuideReaderState = {
  pack: null,
  sections: [],
  loading: true,
  error: null,
  content: null,
  initialPage: 1,
  showToc: false,
  webViewLoadError: null,
  webViewLoading: false,
  exportingPdf: false,
  readerSpeaking: false,
};

function guideReaderReducer(state: GuideReaderState, action: GuideReaderAction): GuideReaderState {
  switch (action.type) {
    case 'loadStarted':
      return { ...state, loading: true, error: null, webViewLoadError: null };
    case 'loadSucceeded':
      return {
        ...state,
        pack: action.pack,
        sections: action.sections,
        content: action.content,
        initialPage: action.initialPage,
        loading: false,
        error: null,
        webViewLoadError: null,
      };
    case 'loadFailed':
      return { ...state, loading: false, error: action.error };
    case 'retryAfterError':
      return { ...state, error: null, loading: true };
    case 'tocVisibilityChanged':
      return { ...state, showToc: action.visible };
    case 'webViewLoadErrorChanged':
      return { ...state, webViewLoadError: action.error };
    case 'webViewLoadingChanged':
      return { ...state, webViewLoading: action.loading };
    case 'contentChanged':
      return {
        ...state,
        content: action.content,
        initialPage: action.initialPage ?? state.initialPage,
        loading: false,
      };
    case 'sectionTitleChanged':
      return {
        ...state,
        content: state.content
          ? {
              ...state.content,
              sectionTitle: action.title,
              page: action.page ?? state.content.page,
            }
          : null,
      };
    case 'exportingPdfChanged':
      return { ...state, exportingPdf: action.exporting };
    case 'readerSpeakingChanged':
      return { ...state, readerSpeaking: action.speaking };
    default:
      return state;
  }
}

type ReaderHeaderProps = {
  title?: string;
  sectionsAvailable: boolean;
  topInset: number;
  onOpenToc: () => void;
  onOpenActions: () => void;
};

function ReaderHeader({
  title,
  sectionsAvailable,
  topInset,
  onOpenToc,
  onOpenActions,
}: ReaderHeaderProps) {
  return (
    <View
      style={{ paddingTop: Math.max(8, topInset), zIndex: 100 }}
      className="bg-background border-border border-b">
      <View className="h-12 flex-row items-center justify-between px-3">
        <Button variant="ghost" size="icon" accessibilityLabel="Back" onPress={() => router.back()}>
          <Icon as={ChevronLeft} className="text-foreground" />
        </Button>
        <View className="mx-2 flex-1">
          <Text variant="small" className="text-foreground text-center font-bold" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View className="flex-row gap-1">
          {sectionsAvailable && (
            <Button variant="ghost" size="icon" accessibilityLabel="Chapters" onPress={onOpenToc}>
              <Icon as={List} className="text-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="Reader actions"
            onPress={onOpenActions}>
            <Icon as={MoreVertical} className="text-foreground" />
          </Button>
        </View>
      </View>
    </View>
  );
}

type ReaderActionsSheetProps = {
  visible: boolean;
  canOpenForPrint: boolean;
  exportingPdf: boolean;
  readerSpeaking: boolean;
  speechDisabled: boolean;
  speechPreparing: boolean;
  onDismiss: () => void;
  onSpeak: () => void;
  onExportPdf: () => void;
  onShare: () => void;
};

function ReaderActionsSheet({
  visible,
  canOpenForPrint,
  exportingPdf,
  readerSpeaking,
  speechDisabled,
  speechPreparing,
  onDismiss,
  onSpeak,
  onExportPdf,
  onShare,
}: ReaderActionsSheetProps) {
  return (
    <ArkBottomSheet visible={visible} title="Reader Actions" onDismiss={onDismiss}>
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
            <Icon as={readerSpeaking ? VolumeX : Volume2} className="size-4" />
          )}
          <Text>
            {speechPreparing ? 'Preparing voice' : readerSpeaking ? 'Stop reading' : 'Read aloud'}
          </Text>
        </Button>
        {canOpenForPrint ? (
          <Button
            variant="outline"
            disabled={exportingPdf}
            onPress={() => {
              onDismiss();
              onExportPdf();
            }}>
            {exportingPdf ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={Printer} className="size-4" />
            )}
            <Text>{exportingPdf ? 'Preparing PDF' : 'Export PDF'}</Text>
          </Button>
        ) : null}
        <Button
          variant="outline"
          onPress={() => {
            onDismiss();
            onShare();
          }}>
          <Icon as={Share2} className="size-4" />
          <Text>Share file</Text>
        </Button>
      </View>
    </ArkBottomSheet>
  );
}

function getReaderNavigationPrefixes(content: ReaderContent) {
  return [content.allowReadAccessToURL, content.uri].filter((value): value is string =>
    Boolean(value)
  );
}

function isReaderNavigationAllowed(content: ReaderContent, url: string) {
  if (!url || url === 'about:blank' || url.startsWith('about:blank#')) return true;
  if (url.startsWith('data:') || url.startsWith('#')) return true;
  return getReaderNavigationPrefixes(content).some((prefix) => url.startsWith(prefix));
}

type ReaderContentViewProps = {
  content: ReaderContent | null;
  isPdf: boolean;
  Pdf: any;
  pdfRef: React.RefObject<any>;
  pdfSource: { uri: string };
  initialPage: number;
  webViewRef: React.RefObject<WebView | null>;
  onPdfPageChanged: (page: number) => void;
  onPdfError: (err: unknown) => void;
  onWebViewLoadStart: () => void;
  onWebViewLoadEnd: () => void;
  onReaderMessage: (rawMessage: string) => void;
  onWebViewError: (description: string) => void;
  theme: EffectiveTheme;
  colors: ThemeColors;
};

function ReaderContentView({
  content,
  isPdf,
  Pdf,
  pdfRef,
  pdfSource,
  initialPage,
  webViewRef,
  onPdfPageChanged,
  onPdfError,
  onWebViewLoadStart,
  onWebViewLoadEnd,
  onReaderMessage,
  onWebViewError,
  theme,
  colors,
}: ReaderContentViewProps) {
  return (
    <View className="flex-1">
      {content &&
        (isPdf && Pdf ? (
          <Pdf
            ref={pdfRef}
            source={pdfSource}
            page={initialPage}
            onPageChanged={onPdfPageChanged}
            onError={onPdfError}
            style={{ flex: 1, backgroundColor: colors.background }}
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={getReaderNavigationPrefixes(content)}
            source={
              content.uri
                ? { uri: content.uri }
                : { html: content.html!, baseUrl: content.allowReadAccessToURL }
            }
            allowFileAccess
            allowingReadAccessToURL={content.allowReadAccessToURL}
            style={{ flex: 1, backgroundColor: colors.background }}
            scalesPageToFit={isPdf}
            injectedJavaScript={!isPdf ? readerThemeScript(theme, colors) : undefined}
            injectedJavaScriptBeforeContentLoaded={
              !isPdf ? readerThemeScript(theme, colors) : undefined
            }
            onShouldStartLoadWithRequest={(request) =>
              isReaderNavigationAllowed(content, request.url)
            }
            onLoadStart={onWebViewLoadStart}
            onLoadEnd={onWebViewLoadEnd}
            onMessage={(event) => onReaderMessage(event.nativeEvent.data)}
            onError={(syntheticEvent) => {
              onWebViewError(syntheticEvent.nativeEvent.description || 'Failed to load content.');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              onWebViewError(`HTTP ${nativeEvent.statusCode}: ${nativeEvent.description}`);
            }}
          />
        ))}
    </View>
  );
}

type ReaderFallbackOverlayProps = {
  error: string;
  pack: ContentPack | null;
  topInset: number;
  bottomInset: number;
};

function ReaderFallbackOverlay({ error, pack, topInset, bottomInset }: ReaderFallbackOverlayProps) {
  return (
    <View
      style={{
        paddingTop: Math.max(20, topInset),
        paddingBottom: Math.max(12, bottomInset),
        zIndex: 200,
      }}
      className="bg-background absolute inset-0 flex-col items-center justify-center gap-6 p-8">
      <Arky pose="thinking" size={160} />
      <View className="items-center gap-2">
        <Text variant="h2" className="text-center">
          Unable to Display
        </Text>
        <Text variant="muted" className="text-center leading-6">
          {error}
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
          <Text className="text-primary-foreground text-lg font-bold">Open in System Viewer</Text>
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Go Back</Text>
        </Button>
      </View>
    </View>
  );
}

function ReaderLoadingOverlay({
  topInset,
  bottomInset,
}: {
  topInset: number;
  bottomInset: number;
}) {
  return (
    <View
      style={{
        paddingTop: Math.max(20, topInset),
        paddingBottom: Math.max(12, bottomInset),
        zIndex: 150,
      }}
      className="bg-background/60 absolute inset-0 items-center justify-center">
      <ActivityIndicator size="large" />
    </View>
  );
}

type ReaderTocSheetProps = {
  visible: boolean;
  sections: GuideSection[];
  onDismiss: () => void;
  onSectionSelect: (section: GuideSection) => void;
};

function ReaderTocSheet({ visible, sections, onDismiss, onSectionSelect }: ReaderTocSheetProps) {
  return (
    <ArkBottomSheet
      visible={visible}
      title="Table of Contents"
      onDismiss={onDismiss}
      scrollable
      snapPoints={['80%']}>
      {sections.map((sec) => (
        <Pressable
          key={sec.title}
          onPress={() => onSectionSelect(sec)}
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
  );
}

function useGuideReaderController() {
  const { packId, section, page } = useLocalSearchParams<{
    packId: string;
    section?: string;
    page?: string;
  }>();
  const speechPlayback = useArkTextToSpeech();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = useThemeStore((state) => state.colors);
  const [state, dispatch] = React.useReducer(guideReaderReducer, initialGuideReaderState);
  const {
    pack,
    sections,
    loading,
    error,
    content,
    initialPage,
    showToc,
    webViewLoadError,
    webViewLoading,
    exportingPdf,
    readerSpeaking,
  } = state;
  const currentPageRef = React.useRef(1);
  const webTextSnapshotRef = React.useRef('');
  const webViewRef = React.useRef<WebView>(null);
  const pdfRef = React.useRef<any>(null);

  const pdfSource = React.useMemo(() => {
    return { uri: content?.uri || '' };
  }, [content?.uri]);

  const loadPackAndContent = React.useCallback(async () => {
    if (!packId) return;
    dispatch({ type: 'loadStarted' });
    try {
      const currentPack = await ContentPackService.getPack(packId);
      if (!currentPack) throw new Error('Guide pack not found.');

      const guideSections = GuideService.getSections(packId);

      let initialSection: GuideSection | null = null;
      if (section) {
        initialSection = guideSections.find((s) => s.title === section) ?? null;
      }

      const readerContent = await GuideReaderService.prepareContent(
        currentPack,
        initialSection,
        theme
      );
      const requestedPage = page ? Number(page) : null;
      const nextPage =
        Number.isFinite(requestedPage) && requestedPage ? requestedPage : readerContent.page;
      const resolvedPage = nextPage || 1;
      currentPageRef.current = resolvedPage;
      dispatch({
        type: 'loadSucceeded',
        pack: currentPack,
        sections: guideSections,
        content: readerContent,
        initialPage: resolvedPage,
      });
    } catch (err) {
      dispatch({
        type: 'loadFailed',
        error: err instanceof Error ? err.message : 'Unable to load content.',
      });
    }
  }, [packId, page, section, theme]);

  React.useEffect(() => {
    void loadPackAndContent();
  }, [loadPackAndContent]);

  React.useEffect(() => {
    webTextSnapshotRef.current = '';
  }, [content?.html, content?.uri]);

  React.useEffect(() => {
    const onBackPress = () => {
      if (showToc) {
        dispatch({ type: 'tocVisibilityChanged', visible: false });
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

  async function handleSpeakContent() {
    if (readerSpeaking) {
      speechPlayback.stop();
      dispatch({ type: 'readerSpeakingChanged', speaking: false });
      return;
    }
    const text = await getSpeechText();
    if (!text) return;
    dispatch({ type: 'readerSpeakingChanged', speaking: true });
    try {
      await speechPlayback.speak(text);
    } catch (err) {
      showSheetAlert('Error', err instanceof Error ? err.message : 'Unable to read this guide.');
    } finally {
      dispatch({ type: 'readerSpeakingChanged', speaking: false });
    }
  }

  async function getSpeechText() {
    if (!content) return '';
    const currentPage = currentPageRef.current;
    if (content.format !== 'pdf' || !content.uri) {
      return buildReaderSpeechText(pack, content, currentPage, webTextSnapshotRef.current);
    }

    const maxPages = Math.min(Math.max(currentPage, 1), 120);
    const extracted = await OcrService.extractPdfText(content.uri, maxPages);
    const pageText =
      extracted.pages.find((item) => item.pageNumber === currentPage)?.text.trim() ||
      extracted.pages.find((item) => item.text.trim())?.text.trim() ||
      '';

    return [
      pack?.title,
      content.sectionTitle,
      `Page ${currentPage}.`,
      pageText || 'No readable PDF text was found on this page.',
    ]
      .filter(Boolean)
      .join('. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2800);
  }

  function handleReaderMessage(rawMessage: string) {
    try {
      const message = JSON.parse(rawMessage) as { type?: string; text?: string };
      if (message.type === 'ark-reader-text' && typeof message.text === 'string') {
        webTextSnapshotRef.current = message.text;
      }
    } catch {
      // Ignore non-JSON messages from embedded content.
    }
  }

  async function handleExportPdf() {
    if (!pack) return;
    dispatch({ type: 'exportingPdfChanged', exporting: true });
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
      dispatch({ type: 'exportingPdfChanged', exporting: false });
    }
  }

  function handleSectionSelect(targetSection: GuideSection) {
    dispatch({ type: 'tocVisibilityChanged', visible: false });
    dispatch({ type: 'webViewLoadErrorChanged', error: null });

    if (isPdf && targetSection.page) {
      currentPageRef.current = targetSection.page;
      dispatch({
        type: 'sectionTitleChanged',
        title: targetSection.title,
        page: targetSection.page,
      });
      pdfRef.current?.setPage(targetSection.page);
      return;
    }

    // If we're already viewing this pack, just scroll to the section
    if (content?.format === 'html' && !webViewLoadError) {
      webViewRef.current?.injectJavaScript(
        sectionScrollScript(targetSection.title, targetSection.htmlTargets ?? [])
      );
      dispatch({ type: 'sectionTitleChanged', title: targetSection.title });
      return;
    }

    dispatch({ type: 'loadStarted' });
    GuideReaderService.prepareContent(pack!, targetSection, theme)
      .then((newContent) => {
        const nextPage = newContent.page;
        if (newContent.page) {
          currentPageRef.current = newContent.page;
        }
        dispatch({ type: 'contentChanged', content: newContent, initialPage: nextPage });
        if (newContent.format === 'html') {
          requestAnimationFrame(() => {
            webViewRef.current?.injectJavaScript(
              sectionScrollScript(targetSection.title, newContent.sectionTargets)
            );
          });
        }
      })
      .catch((err) =>
        dispatch({
          type: 'loadFailed',
          error: err instanceof Error ? err.message : 'Failed to load section.',
        })
      )
      .finally(() => {
        dispatch({ type: 'webViewLoadingChanged', loading: false });
      });
  }

  function handlePdfPageChanged(page: number) {
    currentPageRef.current = page;
    const currentSec = sections.find((s) => s.page === page);
    if (currentSec && content?.sectionTitle !== currentSec.title) {
      dispatch({ type: 'sectionTitleChanged', title: currentSec.title, page });
    }
  }

  function handlePdfError(err: unknown) {
    dispatch({
      type: 'webViewLoadErrorChanged',
      error:
        err && typeof err === 'object' && 'message' in err
          ? String((err as any).message)
          : String(err),
    });
  }

  function handleWebViewLoadEnd() {
    dispatch({ type: 'webViewLoadingChanged', loading: false });
    if (content?.sectionTitle) {
      webViewRef.current?.injectJavaScript(
        sectionScrollScript(content.sectionTitle, content.sectionTargets)
      );
    }
  }

  function handleWebViewError(description: string) {
    dispatch({ type: 'webViewLoadErrorChanged', error: description });
    dispatch({ type: 'webViewLoadingChanged', loading: false });
  }

  const isPdf = content?.format === 'pdf';
  const canOpenForPrint = content?.format === 'html' || content?.format === 'text';
  const Pdf = isPdf ? getNativePdf() : null;

  return {
    pack,
    sections,
    loading,
    error,
    content,
    initialPage,
    showToc,
    webViewLoadError,
    webViewLoading,
    exportingPdf,
    readerSpeaking,
    speechPlayback,
    pdfSource,
    webViewRef,
    pdfRef,
    isPdf,
    canOpenForPrint,
    Pdf,
    retry: () => {
      dispatch({ type: 'retryAfterError' });
      void loadPackAndContent();
    },
    openToc: () => dispatch({ type: 'tocVisibilityChanged', visible: true }),
    dismissToc: () => dispatch({ type: 'tocVisibilityChanged', visible: false }),
    handleShare,
    handleSpeakContent,
    handleExportPdf,
    handleSectionSelect,
    handlePdfPageChanged,
    handlePdfError,
    handleWebViewLoadStart: () => dispatch({ type: 'webViewLoadingChanged', loading: true }),
    handleWebViewLoadEnd,
    handleReaderMessage,
    handleWebViewError,
    theme,
    colors,
  };
}

export default function GuideReaderScreen() {
  const insets = useSafeAreaInsets();
  const reader = useGuideReaderController();
  const [actionsVisible, setActionsVisible] = React.useState(false);
  const readerSpeechPreparing =
    reader.readerSpeaking && reader.speechPlayback.isPreparing && !reader.speechPlayback.isPlaying;

  if (reader.loading && !reader.content) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" />
        <Text variant="muted" className="mt-4">
          Loading guide...
        </Text>
      </View>
    );
  }

  if (reader.error) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Arky pose="thinking" size={120} />
        <Text variant="large" className="text-destructive text-center">
          {reader.error}
        </Text>
        <Button variant="outline" onPress={reader.retry}>
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

      {!reader.webViewLoadError && (
        <ReaderHeader
          title={reader.pack?.title}
          sectionsAvailable={reader.sections.length > 0}
          topInset={insets.top}
          onOpenToc={reader.openToc}
          onOpenActions={() => setActionsVisible(true)}
        />
      )}

      <ReaderContentView
        content={reader.content}
        isPdf={reader.isPdf}
        Pdf={reader.Pdf}
        pdfRef={reader.pdfRef}
        pdfSource={reader.pdfSource}
        initialPage={reader.initialPage}
        webViewRef={reader.webViewRef}
        onPdfPageChanged={reader.handlePdfPageChanged}
        onPdfError={reader.handlePdfError}
        onWebViewLoadStart={reader.handleWebViewLoadStart}
        onWebViewLoadEnd={reader.handleWebViewLoadEnd}
        onReaderMessage={reader.handleReaderMessage}
        onWebViewError={reader.handleWebViewError}
        theme={reader.theme}
        colors={reader.colors}
      />

      {reader.webViewLoadError && (
        <ReaderFallbackOverlay
          error={reader.webViewLoadError}
          pack={reader.pack}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      )}

      {(reader.loading || reader.webViewLoading) && reader.content && (
        <ReaderLoadingOverlay topInset={insets.top} bottomInset={insets.bottom} />
      )}

      <ReaderTocSheet
        visible={reader.showToc}
        sections={reader.sections}
        onDismiss={reader.dismissToc}
        onSectionSelect={reader.handleSectionSelect}
      />
      <ReaderActionsSheet
        visible={actionsVisible}
        canOpenForPrint={reader.canOpenForPrint}
        exportingPdf={reader.exportingPdf}
        readerSpeaking={reader.speechPlayback.isPlaying}
        speechDisabled={!reader.content}
        speechPreparing={readerSpeechPreparing}
        onDismiss={() => setActionsVisible(false)}
        onSpeak={() => void reader.handleSpeakContent()}
        onExportPdf={reader.handleExportPdf}
        onShare={reader.handleShare}
      />
    </View>
  );
}
