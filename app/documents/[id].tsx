import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ImportService } from '@/services/files/import.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import type { ArkDocument } from '@/types/db';
import { format } from 'date-fns';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { ExternalLink, FileText, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

function canPreviewAsText(document: ArkDocument) {
  const title = document.title.toLowerCase();
  return (
    document.mimeType?.startsWith('text/') ||
    title.endsWith('.md') ||
    title.endsWith('.json') ||
    title.endsWith('.csv') ||
    title.endsWith('.log')
  );
}

function canPreviewInWebView(document: ArkDocument) {
  return (
    canPreviewAsText(document) ||
    document.mimeType === 'application/pdf' ||
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [document, setDocument] = React.useState<ArkDocument | null>(null);
  const [textPreview, setTextPreview] = React.useState<string | null>(null);
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

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: document.title }} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
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
              Stored in app-private files. Database/file encryption still requires the SQLCipher dev
              build work.
            </Text>
          ) : null}
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
        </Card>

        {webSource && canPreviewInWebView(document) ? (
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
              This file type is stored offline and can be opened with a compatible app on the
              device.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
