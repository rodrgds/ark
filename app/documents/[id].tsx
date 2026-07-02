import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import type { EffectiveTheme, ThemeColors } from '@/constants/theme';
import { getNativePdf } from '@/components/readers/native-pdf';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { confirmDestructive, showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { useArkTextToSpeech } from '@/hooks/use-ark-text-to-speech';
import { DocumentPagesRepository } from '@/services/db/repositories/document-pages.repo';
import { ImportService } from '@/services/files/import.service';
import {
  isImageDocument,
  isPdfDocument,
  isTextDocument,
} from '@/services/files/document-text.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import type { ArkDocument } from '@/types/db';
import { format } from 'date-fns';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Check,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useThemeStore } from '@/stores/theme-store';

function canPreviewAsText(document: ArkDocument) {
  return isTextDocument(document);
}

function canPreviewInWebView(document: ArkDocument) {
  return (
    canPreviewAsText(document) ||
    document.mimeType?.startsWith('image/') ||
    document.mimeType?.includes('html')
  );
}

function documentThemeScript(theme: EffectiveTheme, colors: ThemeColors) {
  const selection = theme === 'light' ? 'rgba(74, 87, 66, 0.18)' : 'rgba(149, 167, 139, 0.28)';

  return `
(function() {
  var css = ${JSON.stringify(`
    :root {
      color-scheme: ${theme === 'light' ? 'light' : 'dark'};
      --ark-bg: ${colors.background};
      --ark-fg: ${colors.foreground};
      --ark-accent: ${colors.primary};
      --ark-card: ${colors.card};
      --ark-border: ${colors.border};
    }
    html, body {
      background: var(--ark-bg) !important;
      color: var(--ark-fg) !important;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--ark-fg) !important;
    }
    a { color: var(--ark-accent) !important; }
    pre, code, blockquote, table, th, td {
      border-color: var(--ark-border) !important;
    }
    pre, code, blockquote, th {
      background: var(--ark-card) !important;
    }
    ::selection { background: ${selection}; }
  `)};
  var style = document.getElementById('ark-document-theme');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ark-document-theme';
    document.head.appendChild(style);
  }
  style.textContent = css;
  document.documentElement.style.colorScheme = ${JSON.stringify(theme === 'light' ? 'light' : 'dark')};
})();
true;
`;
}

function textHtml(title: string, body: string, colors: ThemeColors) {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { background: ${colors.background}; color: ${colors.foreground}; font: 15px -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5; padding: 16px; }
      h1 { color: ${colors.foreground}; font-size: 18px; margin: 0 0 16px; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <pre>${escapeHtml(body)}</pre>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function StatusPill({ label }: { label: string }) {
  return (
    <View className="border-border bg-muted/40 rounded-full border px-2.5 py-1">
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

function documentKindLabel(document: ArkDocument) {
  if (isPdfDocument(document)) return 'PDF';
  if (isImageDocument(document)) return 'Image';
  if (isTextDocument(document)) return 'Text';
  if (document.mimeType) return document.mimeType;
  return 'Document';
}

function documentSearchBadge(document: ArkDocument) {
  if (document.extractedText || document.ocrText) return 'Ready';
  if (
    document.ocrStatus === 'processing' ||
    document.ocrStatus === 'extracting_text' ||
    document.ocrStatus === 'ocr_running'
  ) {
    return 'Reading';
  }
  if (document.ocrStatus === 'failed') return 'Retry';
  if (document.ocrStatus === 'ocr_needed') return 'OCR available';
  return 'Title only';
}

export default function DocumentReaderScreen() {
  const { id, page } = useLocalSearchParams<{ id: string; page?: string }>();
  const insets = useSafeAreaInsets();
  const speechPlayback = useArkTextToSpeech();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = useThemeStore((state) => state.colors);
  const [document, setDocument] = React.useState<ArkDocument | null>(null);
  const [documentPages, setDocumentPages] = React.useState<
    Awaited<ReturnType<typeof DocumentPagesRepository.listForDocument>>
  >([]);
  const [textPreview, setTextPreview] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [readerSpeaking, setReaderSpeaking] = React.useState(false);
  const [currentPdfPage, setCurrentPdfPage] = React.useState(
    page && Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1
  );
  const [actionsVisible, setActionsVisible] = React.useState(false);
  const speechPreparing =
    readerSpeaking && speechPlayback.isPreparing && !speechPlayback.isPlaying;

  async function load() {
    if (!id) return;
    const nextDocument = await ImportService.getDocument(id);
    setDocument(nextDocument);
    setDocumentPages(
      nextDocument ? await DocumentPagesRepository.listForDocument(nextDocument.id) : []
    );
    if (nextDocument?.localUri && canPreviewAsText(nextDocument)) {
      const body = await FileSystem.readAsStringAsync(nextDocument.localUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setTextPreview(body);
    } else {
      setTextPreview(null);
    }
  }

  React.useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load document.');
    });
  }, [id]);

  React.useEffect(() => {
    if (document?.title) setTitleDraft(document.title);
  }, [document?.title]);

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

  async function saveTitle() {
    const nextTitle = titleDraft.trim();
    if (!document || !nextTitle || nextTitle === document.title) return;
    await run(async () => {
      const renamed = await ImportService.renameDocument(document.id, nextTitle);
      if (renamed) setDocument(renamed);
    });
  }

  async function openDocument() {
    if (!document) return;
    await run(() => ImportService.openDocument(document.id));
  }

  function confirmDeleteDocument() {
    if (!document) return;
    confirmDestructive({
      title: 'Delete document?',
      message: document.title,
      onConfirm: () =>
        run(async () => {
          await ImportService.deleteDocument(document.id);
          router.back();
        }),
    });
  }

  async function handleSpeakDocument() {
    if (readerSpeaking) {
      speechPlayback.stop();
      setReaderSpeaking(false);
      return;
    }
    const text = buildDocumentSpeechText();
    if (!text) return;
    setReaderSpeaking(true);
    try {
      await speechPlayback.speak(text);
    } catch (speechError) {
      showSheetAlert(
        'Error',
        speechError instanceof Error ? speechError.message : 'Unable to read this document.'
      );
    } finally {
      setReaderSpeaking(false);
    }
  }

  function buildDocumentSpeechText() {
    if (!document) return '';
    const currentPageText = documentPages
      .find((item) => item.pageNumber === currentPdfPage)
      ?.text.trim();
    const body =
      currentPageText ||
      document.extractedText?.trim() ||
      document.ocrText?.trim() ||
      textPreview?.trim() ||
      '';
    return [document.title, isPdfDocument(document) ? `Page ${currentPdfPage}.` : null, body]
      .filter(Boolean)
      .join('. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2800);
  }

  if (!document) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text variant="muted">{error ?? 'Loading document...'}</Text>
      </View>
    );
  }

  const webSource = textPreview
    ? { html: textHtml(document.title, textPreview, colors) }
    : document.localUri
      ? { uri: document.localUri }
      : null;
  const Pdf = isPdfDocument(document) ? getNativePdf() : null;
  const initialPage = page && Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: document.title,
        }}
      />
      <ArkKeyboardAwareScrollView
        className="flex-1"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        bottomOffset={Platform.OS === 'ios' ? 100 : 0}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: Math.max(32, insets.bottom + 24),
        }}
        extraKeyboardSpace={Platform.OS === 'android' ? 32 : 0}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <View className="gap-3">
            <View className="gap-2">
              <Text variant="h1" className="text-2xl">
                {document.title}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <StatusPill label={documentKindLabel(document)} />
                <StatusPill
                  label={
                    document.sizeBytes
                      ? FileSystemService.formatBytes(document.sizeBytes)
                      : 'Unknown size'
                  }
                />
                <StatusPill label={`Imported ${format(document.createdAt, 'PP')}`} />
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Button
                className="min-w-32 flex-1"
                disabled={busy}
                onPress={() => void openDocument()}>
                <Icon as={ExternalLink} className="size-4" />
                <Text>Open file</Text>
              </Button>
              <Button
                accessibilityLabel="Document actions"
                size="icon"
                variant="outline"
                disabled={busy}
                onPress={() => setActionsVisible(true)}>
                <Icon as={MoreHorizontal} className="size-4" />
              </Button>
            </View>
            {document.encryptionStatus !== 'encrypted' ? (
              <Text className="text-destructive text-sm">
                Stored on this device. Stronger file protection is available in supported builds.
              </Text>
            ) : null}
            {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
          </View>
        </View>

        <DocumentActionsSheet
          visible={actionsVisible}
          document={document}
          busy={busy}
          titleDraft={titleDraft}
          readerSpeaking={readerSpeaking}
          speechPreparing={speechPreparing}
          onDismiss={() => setActionsVisible(false)}
          onOpen={() => void openDocument()}
          onSpeak={() => void handleSpeakDocument()}
          onChangeTitle={setTitleDraft}
          onSaveTitle={() => void saveTitle()}
          onDelete={() => {
            setActionsVisible(false);
            confirmDeleteDocument();
          }}
        />

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                <Text variant="large">Offline search</Text>
                <StatusPill label={documentSearchBadge(document)} />
              </View>
              <Text variant="muted">{ocrStatusCopy(document)}</Text>
            </View>
            {document.ocrStatus === 'processing' ? <ActivityIndicator /> : null}
          </View>
          {document.ocrText ? (
            <View className="bg-muted/40 max-h-44 rounded-md p-3">
              <Text variant="small">{document.ocrText}</Text>
            </View>
          ) : null}
          {document.ocrError ? (
            <Text className="text-destructive text-sm">{document.ocrError}</Text>
          ) : null}
          {isImageDocument(document) || isPdfDocument(document) ? (
            <Button
              variant="outline"
              disabled={busy || document.ocrStatus === 'processing'}
              onPress={() =>
                run(() => ImportService.runDocumentOcr(document.id).then(() => undefined))
              }>
              {busy ? <ActivityIndicator /> : <Icon as={RefreshCcw} className="size-4" />}
              <Text>{document.ocrText ? 'Run OCR Again' : 'Run OCR'}</Text>
            </Button>
          ) : null}
        </Card>

        {document.localUri && isPdfDocument(document) && Pdf ? (
          <Card className="overflow-hidden p-0">
            <View className="border-border flex-row items-center gap-2 border-b p-3">
              <Icon as={FileText} className="text-primary size-5" />
              <Text variant="large">PDF reader</Text>
            </View>
            <View className="bg-background h-[620px]">
              <Pdf
                source={{ uri: document.localUri }}
                page={initialPage}
                style={{ flex: 1, backgroundColor: colors.background }}
                onPageChanged={(nextPage: number) => setCurrentPdfPage(nextPage)}
                onError={(pdfError: unknown) => {
                  setError(
                    pdfError && typeof pdfError === 'object' && 'message' in pdfError
                      ? String((pdfError as { message?: unknown }).message)
                      : 'Unable to render this PDF.'
                  );
                }}
              />
            </View>
          </Card>
        ) : webSource && canPreviewInWebView(document) ? (
          <Card className="overflow-hidden p-0">
            <View className="border-border flex-row items-center gap-2 border-b p-3">
              <Icon as={FileText} className="text-primary size-5" />
              <Text variant="large">Preview</Text>
            </View>
            <View className="bg-background h-[620px]">
              <WebView
                originWhitelist={textPreview ? [] : document.localUri ? [document.localUri] : []}
                source={webSource}
                allowFileAccess
                injectedJavaScript={documentThemeScript(theme, colors)}
                injectedJavaScriptBeforeContentLoaded={documentThemeScript(theme, colors)}
                startInLoadingState
                style={{ backgroundColor: colors.background }}
                renderLoading={() => (
                  <View className="bg-background flex-1 items-center justify-center">
                    <ActivityIndicator />
                  </View>
                )}
              />
            </View>
          </Card>
        ) : (
          <Card className="gap-2">
            <Text variant="large">No inline preview</Text>
            <Text variant="muted">
              This file is stored offline and can be opened with a compatible app on the device.
            </Text>
          </Card>
        )}
      </ArkKeyboardAwareScrollView>
    </View>
  );
}

type DocumentActionsSheetProps = {
  visible: boolean;
  document: ArkDocument;
  busy: boolean;
  titleDraft: string;
  readerSpeaking: boolean;
  speechPreparing: boolean;
  onDismiss: () => void;
  onOpen: () => void;
  onSpeak: () => void;
  onChangeTitle: (title: string) => void;
  onSaveTitle: () => void;
  onDelete: () => void;
};

function DocumentActionsSheet({
  visible,
  document,
  busy,
  titleDraft,
  readerSpeaking,
  speechPreparing,
  onDismiss,
  onOpen,
  onSpeak,
  onChangeTitle,
  onSaveTitle,
  onDelete,
}: DocumentActionsSheetProps) {
  const titleChanged = titleDraft.trim().length > 0 && titleDraft.trim() !== document.title;

  return (
    <ArkBottomSheet visible={visible} title="Document Actions" onDismiss={onDismiss} scrollable>
      <View className="gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onPress={() => {
            onDismiss();
            onOpen();
          }}>
          <Icon as={ExternalLink} className="size-4" />
          <Text>Open file</Text>
        </Button>
        <Button
          variant={readerSpeaking ? 'default' : 'outline'}
          disabled={busy && !readerSpeaking}
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
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Icon as={Pencil} className="text-primary size-4" />
          <Text variant="large">Rename</Text>
        </View>
        <View className="flex-row gap-2">
          <Input
            className="flex-1"
            value={titleDraft}
            onChangeText={onChangeTitle}
            onSubmitEditing={onSaveTitle}
            returnKeyType="done"
          />
          <Button variant="outline" disabled={busy || !titleChanged} onPress={onSaveTitle}>
            {busy ? <ActivityIndicator size="small" /> : <Icon as={Check} className="size-4" />}
            <Text>Save</Text>
          </Button>
        </View>
      </View>

      <Button variant="outline" disabled={busy} onPress={onDelete}>
        <Icon as={Trash2} className="text-destructive size-4" />
        <Text className="text-destructive">Delete document</Text>
      </Button>
    </ArkBottomSheet>
  );
}

function ocrStatusCopy(document: ArkDocument) {
  if (document.extractedText) return 'This file text is ready for offline search and Ask Arky.';
  switch (document.ocrStatus) {
    case 'pending':
      return 'Waiting to inspect this file.';
    case 'processing':
      return 'Reading image text on this device.';
    case 'extracting_text':
      return 'Reading the PDF text layer on this device.';
    case 'text_extracted':
    case 'searchable':
      return 'This document is ready for offline search and Ask Arky.';
    case 'ocr_needed':
      return 'This looks like a scanned PDF. OCR is available, but Ark will not run a large OCR job without you asking.';
    case 'ocr_running':
      return 'Running OCR on PDF pages on this device.';
    case 'ready':
      return document.ocrText
        ? 'Image text is ready for offline search and Ask Arky.'
        : 'No readable text was found in this image.';
    case 'unavailable':
      return 'OCR is available on Android builds with image text recognition enabled.';
    case 'failed':
      return 'OCR failed. You can retry from this screen.';
    default:
      return 'Ark keeps this file offline and indexes its title for search.';
  }
}
