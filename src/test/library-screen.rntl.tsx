import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

const now = new Date('2026-07-01T12:00:00Z').getTime();
const routerPush = mock((_href: unknown) => undefined);

const waterPack: ContentPack = {
  id: 'emergency-water',
  title: 'Emergency Water Manual',
  description: 'Treat and store water offline.',
  category: 'Water',
  format: 'html',
  downloadStrategy: 'html_snapshot',
  estimatedSize: '2 MB',
  sourceLabel: 'Ready.gov',
  installed: true,
  localUri: 'file:///packs/water.html',
  installStatus: 'installed',
  progress: 1,
  createdAt: now,
  updatedAt: now,
};

const wikiPack: ContentPack = {
  id: 'wikipedia-simple-en-mini',
  title: 'Simple English Wikipedia',
  description: 'Compact offline encyclopedia.',
  category: 'Wiki',
  format: 'zim',
  estimatedSize: '1.2 GB',
  sourceLabel: 'Kiwix',
  installed: false,
  localUri: null,
  installStatus: 'not_installed',
  progress: 0,
  createdAt: now,
  updatedAt: now,
};

const aiModelPack: ContentPack = {
  id: 'model-gemma4-e2b-it-q4-k-m',
  title: 'Gemma 4 E2B Instruct Q4',
  description: 'Answer model.',
  category: 'AI Models',
  format: 'gguf',
  modelRole: 'chat',
  estimatedSize: '2.1 GB',
  installed: true,
  localUri: 'file:///models/gemma.gguf',
  installStatus: 'installed',
  progress: 1,
  createdAt: now,
  updatedAt: now,
};

const rssPack: ContentPack = {
  id: 'rss-official-feeds',
  title: 'Official RSS feeds',
  description: 'Cached emergency feed list.',
  category: 'RSS',
  format: 'bundle',
  estimatedSize: 'Tiny',
  installed: true,
  localUri: null,
  installStatus: 'installed',
  progress: 1,
  createdAt: now,
  updatedAt: now,
};

const baseDocument: ArkDocument = {
  id: 'doc-clinic-scan',
  title: 'Clinic Scan',
  mimeType: 'application/pdf',
  localUri: 'file:///documents/clinic.pdf',
  sizeBytes: 512 * 1024,
  sha256: null,
  source: 'import',
  isPersonal: true,
  encryptionStatus: 'encrypted',
  extractedText: 'Water purification checklist and clinic triage notes.',
  ocrText: null,
  ocrStatus: 'text_extracted',
  ocrError: null,
  indexedAt: now,
  createdAt: now,
  updatedAt: now,
};

const importedDocument: ArkDocument = {
  ...baseDocument,
  id: 'doc-imported',
  title: 'Imported Field Notes',
  localUri: 'file:///documents/imported.pdf',
};

let documents: ArkDocument[] = [];

const listPacks = mock(async () => [waterPack, wikiPack, aiModelPack, rssPack]);
const listDocuments = mock(async () => documents);
const importDocument = mock(async () => {
  documents = [baseDocument, importedDocument];
  return importedDocument;
});

mock.module('expo-router', () => ({
  router: {
    push: routerPush,
  },
}));

mock.module('@/components/layout/keyboard-controller', () => ({
  ArkKeyboardAwareScrollView: ({ children }: React.PropsWithChildren) =>
    React.createElement('ScrollView', null, children),
}));

mock.module('@/services/content/content-pack.service', () => ({
  ContentPackService: {
    listPacks,
  },
}));

mock.module('@/services/files/import.service', () => ({
  ImportService: {
    importDocument,
    listDocuments,
  },
}));

describe('LibraryScreen', () => {
  beforeEach(() => {
    documents = [baseDocument];
    listPacks.mockClear();
    listDocuments.mockClear();
    importDocument.mockClear();
    routerPush.mockClear();
  });

  test('searches offline packs and documents while keeping model/feed packs out of Library', async () => {
    const { default: LibraryScreen } = await import('@/app/(tabs)/library');

    const view = await render(<LibraryScreen />);

    expect(await view.findByLabelText('Open Water category')).toBeOnTheScreen();
    expect(view.getByLabelText('Open Wiki category')).toBeOnTheScreen();
    expect(view.getByLabelText('Open Documents category')).toBeOnTheScreen();
    expect(view.queryByText('Gemma 4 E2B Instruct Q4')).toBeNull();
    expect(view.queryByText('Official RSS feeds')).toBeNull();

    await fireEvent.changeText(view.getByLabelText('Search library contents'), 'water');

    expect(view.getByText('Search results')).toBeOnTheScreen();
    expect(view.getByText('2 matches')).toBeOnTheScreen();
    expect(view.getByText('Emergency Water Manual')).toBeOnTheScreen();
    expect(view.getByText('Clinic Scan')).toBeOnTheScreen();
    expect(view.getByText('Water - HTML - 2 MB - Installed')).toBeOnTheScreen();

    await fireEvent.press(view.getByLabelText('Open Emergency Water Manual'));
    expect(routerPush).toHaveBeenCalledWith('/library/Water');

    await fireEvent.press(view.getByLabelText('Open Clinic Scan'));
    expect(routerPush).toHaveBeenCalledWith('/documents/doc-clinic-scan');

    await fireEvent.changeText(view.getByLabelText('Search library contents'), 'gemma');

    expect(view.getByText('No library matches')).toBeOnTheScreen();
  });

  test('imports a document and routes back to the Documents category', async () => {
    const { default: LibraryScreen } = await import('@/app/(tabs)/library');

    const view = await render(<LibraryScreen />);

    expect(await view.findByText('Documents')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Import'));

    await waitFor(() => {
      expect(importDocument).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith('/library/Documents');
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });
});
