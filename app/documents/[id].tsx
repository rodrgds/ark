import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { getNativePdf } from '@/components/readers/native-pdf';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
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
import { ExternalLink, FileText, RefreshCcw, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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

function textHtml(title: string, body: string) {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { background: #000; color: #f4f4f5; font: 15px -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5; padding: 16px; }
      h1 { font-size: 18px; margin: 0 0 16px; }
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

export default function DocumentReaderScreen() {
  const { id, page } = useLocalSearchParams<{ id: string; page?: string }>();
  const insets = useSafeAreaInsets();
  const [document, setDocument] = React.useState<ArkDocument | null>(null);
  const [textPreview, setTextPreview] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    if (!id) return;
    const nextDocument = await ImportService.getDocument(id);
    setDocument(nextDocument);
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

  if (!document) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text variant="muted">{error ?? 'Loading document...'}</Text>
      </View>
    );
  }

  const webSource = textPreview
    ? { html: textHtml(document.title, textPreview) }
    : document.localUri
      ? { uri: document.localUri }
      : null;
  const Pdf = isPdfDocument(document) ? getNativePdf() : null;
  const initialPage = page && Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: document.title }} />
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
        <View className="gap-2">
          <Text variant="h1" className="text-3xl">
            {document.title}
          </Text>
          <Text variant="muted">
            {document.mimeType ?? 'Unknown type'} -{' '}
            {document.sizeBytes
              ? FileSystemService.formatBytes(document.sizeBytes)
              : 'Unknown size'}
          </Text>
          <Text variant="small">Imported {format(document.createdAt, 'PPp')}</Text>
        </View>

        <Card className="gap-3">
          <View className="gap-2">
            <Text variant="large">Document name</Text>
            <View className="flex-row gap-2">
              <Input
                className="flex-1"
                value={titleDraft}
                onChangeText={setTitleDraft}
                onSubmitEditing={() => void saveTitle()}
                returnKeyType="done"
              />
              <Button
                variant="outline"
                disabled={busy || !titleDraft.trim() || titleDraft.trim() === document.title}
                onPress={() => void saveTitle()}>
                {busy ? <ActivityIndicator /> : null}
                <Text>Rename</Text>
              </Button>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Button
              className="flex-1"
              variant="outline"
              disabled={busy}
              onPress={() => run(() => ImportService.openDocument(document.id))}>
              <Icon as={ExternalLink} className="size-4" />
              <Text>Open File</Text>
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={busy}
              onPress={() => {
                Alert.alert('Delete document?', document.title, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      run(async () => {
                        await ImportService.deleteDocument(document.id);
                        router.back();
                      }),
                  },
                ]);
              }}>
              {busy ? <ActivityIndicator /> : <Icon as={Trash2} className="size-4" />}
            </Button>
          </View>
          {document.encryptionStatus !== 'encrypted' ? (
            <Text className="text-destructive text-sm">
              Stored privately on this device. Stronger file protection is available in supported
              builds.
            </Text>
          ) : null}
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="large">Search text</Text>
              <Text variant="muted">{ocrStatusCopy(document)}</Text>
            </View>
            {document.ocrStatus === 'processing' ? <ActivityIndicator /> : null}
          </View>
          {document.extractedText ? (
            <Text variant="small">Ready for offline search and Ask Arky.</Text>
          ) : null}
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
                style={{ flex: 1, backgroundColor: '#000000' }}
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
                originWhitelist={['*']}
                source={webSource}
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
