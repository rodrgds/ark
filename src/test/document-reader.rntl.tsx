import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { ArkDocument, DocumentPage } from '@/types/db';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

let currentDocument: ArkDocument;

const speak = mock(async (_text: string) => undefined);
const stop = mock(() => undefined);
const getDocument = mock(async (_id: string) => currentDocument);
const openDocument = mock(async (_id: string) => undefined);
const renameDocument = mock(async (_id: string, title: string) => {
  currentDocument = { ...currentDocument, title, updatedAt: currentDocument.updatedAt + 1 };
  return currentDocument;
});
const runDocumentOcr = mock(async (_id: string) => undefined);
const deleteDocument = mock(async (_id: string) => undefined);

const documentPages: DocumentPage[] = [
  {
    id: 'page-1',
    documentId: 'doc-1',
    pageNumber: 1,
    text: 'Filter water before drinking.',
    extractionMethod: 'text_layer',
    confidence: null,
    indexedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
  },
];

mock.module('expo-router', () => ({
  router: {
    back: () => undefined,
    push: () => undefined,
    replace: () => undefined,
  },
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({ id: 'doc-1', page: '1' }),
}));

mock.module('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: async () => 'Cached text body',
}));

mock.module('react-native-webview', () => ({
  WebView: (props: Record<string, unknown>) => React.createElement('WebView', props),
}));

mock.module('@/components/layout/keyboard-controller', () => ({
  ArkKeyboardAwareScrollView: ({ children }: React.PropsWithChildren) =>
    React.createElement('View', null, children),
}));

mock.module('@/components/readers/native-pdf', () => ({
  getNativePdf: () => null,
}));

mock.module('@/components/ui/sheet-alert', () => ({
  confirmDestructive: () => undefined,
  showSheetAlert: () => undefined,
}));

mock.module('@/hooks/use-ark-text-to-speech', () => ({
  useArkTextToSpeech: () => ({
    isPreparing: false,
    speak,
    stop,
  }),
}));

mock.module('@/services/db/repositories/document-pages.repo', () => ({
  DocumentPagesRepository: {
    listForDocument: async () => documentPages,
  },
}));

mock.module('@/services/files/document-text.service', () => ({
  isImageDocument: (document: Pick<ArkDocument, 'mimeType'>) =>
    document.mimeType?.startsWith('image/') ?? false,
  isPdfDocument: (document: Pick<ArkDocument, 'mimeType'>) =>
    document.mimeType?.includes('pdf') ?? false,
  isTextDocument: (document: Pick<ArkDocument, 'mimeType'>) =>
    document.mimeType?.startsWith('text/') ?? false,
}));

mock.module('@/services/files/filesystem.service', () => ({
  FileSystemService: {
    formatBytes: (bytes: number) => `${Math.round(bytes / 1024)} KB`,
  },
}));

mock.module('@/services/files/import.service', () => ({
  ImportService: {
    deleteDocument,
    getDocument,
    openDocument,
    renameDocument,
    runDocumentOcr,
  },
}));

function resetDocument() {
  currentDocument = {
    id: 'doc-1',
    title: 'Field Guide Scan',
    mimeType: 'application/pdf',
    localUri: 'file:///documents/field-guide.pdf',
    sizeBytes: 1024 * 512,
    sha256: null,
    source: 'import',
    isPersonal: true,
    encryptionStatus: 'encrypted',
    extractedText: null,
    ocrText: null,
    ocrStatus: 'ocr_needed',
    ocrError: null,
    indexedAt: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

describe('DocumentReaderScreen', () => {
  beforeEach(() => {
    resetDocument();
    speak.mockClear();
    stop.mockClear();
    getDocument.mockClear();
    openDocument.mockClear();
    renameDocument.mockClear();
    runDocumentOcr.mockClear();
    deleteDocument.mockClear();
  });

  test('keeps Open file primary and groups secondary actions in a sheet', async () => {
    const { default: DocumentReaderScreen } = await import('@/app/documents/[id]');
    const view = await render(<DocumentReaderScreen />);

    expect(await view.findByText('Field Guide Scan')).toBeOnTheScreen();
    expect(view.getByText('PDF')).toBeOnTheScreen();
    expect(view.getByText('512 KB')).toBeOnTheScreen();
    expect(view.getByText('Offline search')).toBeOnTheScreen();
    expect(view.getByText('OCR available')).toBeOnTheScreen();
    expect(view.getByText(/OCR is available/)).toBeOnTheScreen();
    expect(view.getByText('Run OCR')).toBeOnTheScreen();
    expect(view.queryByText('Read aloud')).toBeNull();

    await fireEvent.press(view.getByText('Open file'));

    expect(openDocument).toHaveBeenCalledWith('doc-1');

    await fireEvent.press(view.getByLabelText('Document actions'));

    expect(view.getByLabelText('Document Actions')).toBeOnTheScreen();
    expect(view.getByText('Read aloud')).toBeOnTheScreen();
    expect(view.getByText('Rename')).toBeOnTheScreen();
    expect(view.getByText('Delete document')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Read aloud'));

    expect(speak).toHaveBeenCalledWith('Field Guide Scan. Page 1.. Filter water before drinking.');
  });

  test('runs OCR retry and renames from the document actions sheet', async () => {
    const { default: DocumentReaderScreen } = await import('@/app/documents/[id]');
    const view = await render(<DocumentReaderScreen />);

    expect(await view.findByText('Field Guide Scan')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Run OCR'));

    await waitFor(() => {
      expect(runDocumentOcr).toHaveBeenCalledWith('doc-1');
    });

    await fireEvent.press(view.getByLabelText('Document actions'));
    await fireEvent.changeText(view.getByDisplayValue('Field Guide Scan'), 'Water Notes');
    await fireEvent.press(view.getByText('Save'));

    await waitFor(() => {
      expect(renameDocument).toHaveBeenCalledWith('doc-1', 'Water Notes');
    });
    expect(await view.findByText('Water Notes')).toBeOnTheScreen();
  });
});
