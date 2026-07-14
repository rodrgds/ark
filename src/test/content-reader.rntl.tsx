import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { GuideSection } from '@/services/content/guide.service';
import type { ReaderContent } from '@/services/content/guide-reader.service';
import type { ContentPack } from '@/types/content';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

const now = new Date('2026-07-01T12:00:00Z').getTime();
const speak = mock(async (_text: string) => undefined);
const stop = mock(() => undefined);
const getPack = mock(async (_id: string) => guidePack);
const prepareContent = mock(
  async (_pack: ContentPack, section?: GuideSection | null): Promise<ReaderContent> => ({
    html: '<article><h1>Water basics</h1><p>Filter water before drinking.</p></article>',
    format: 'html',
    title: guidePack.title,
    sectionTitle: section?.title ?? 'Overview',
    sectionTargets: section?.htmlTargets ?? [],
  })
);
const exportPdf = mock(async (_pack: ContentPack) => ({ uri: 'file:///exports/water.pdf' }));
const shareAsync = mock(async (_uri: string, _options?: Record<string, unknown>) => undefined);
const openPack = mock(async (_id: string) => undefined);

const guidePack: ContentPack = {
  id: 'guide-water',
  title: 'Water Field Guide',
  description: 'Offline water safety reference.',
  category: 'Water',
  format: 'html',
  downloadStrategy: 'html_snapshot',
  estimatedSize: '1 MB',
  installed: true,
  localUri: 'file:///guides/water.html',
  installStatus: 'installed',
  progress: 1,
  createdAt: now,
  updatedAt: now,
};

const guideSections: GuideSection[] = [
  {
    title: 'Water basics',
    detail: 'Make water safe to drink.',
    page: 3,
    htmlTargets: ['water-basics'],
  },
  {
    title: 'Storage',
    detail: 'Keep treated water clean.',
    page: 8,
    htmlTargets: ['storage'],
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
  useLocalSearchParams: () => ({ packId: guidePack.id }),
}));

mock.module('react-native-webview', () => ({
  WebView: (() => {
    const MockWebView = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: () => undefined,
      }));
      return React.createElement('WebView', props);
    });
    MockWebView.displayName = 'MockWebView';
    return MockWebView;
  })(),
}));

mock.module('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync,
}));

mock.module('@/components/brand/ark-logo', () => ({
  Arky: () => React.createElement('View'),
}));

mock.module('@/hooks/use-ark-text-to-speech', () => ({
  useArkTextToSpeech: () => ({
    isPlaying: false,
    isPreparing: false,
    speak,
    stop,
  }),
}));

mock.module('@/modules/ark-ocr', () => ({
  default: {
    extractPdfText: async () => ({ pages: [] }),
  },
}));

mock.module('@/services/content/content-pack.service', () => ({
  ContentPackService: {
    getPack,
    openPack,
  },
}));

mock.module('@/services/content/guide.service', () => ({
  GuideService: {
    getSections: () => guideSections,
  },
}));

mock.module('@/services/content/guide-reader.service', () => ({
  GuideReaderService: {
    prepareContent,
  },
}));

mock.module('@/services/content/guide-pdf.service', () => ({
  GuidePdfService: {
    export: exportPdf,
  },
}));

describe('GuideReaderScreen', () => {
  beforeEach(() => {
    speak.mockClear();
    stop.mockClear();
    getPack.mockClear();
    prepareContent.mockClear();
    exportPdf.mockClear();
    shareAsync.mockClear();
    openPack.mockClear();
  });

  test('keeps chapters primary and groups reader actions behind More', async () => {
    const { default: GuideReaderScreen } = await import('@/app/content/reader');

    const view = await render(<GuideReaderScreen />);

    expect(await view.findByText('Water Field Guide')).toBeOnTheScreen();
    expect(view.getByLabelText('Chapters')).toBeOnTheScreen();
    expect(view.getByLabelText('Reader actions')).toBeOnTheScreen();
    expect(view.queryByText('Share file')).toBeNull();

    await fireEvent.press(view.getByLabelText('Reader actions'));

    expect(view.getByLabelText('Reader Actions')).toBeOnTheScreen();
    expect(view.getByText('Read aloud')).toBeOnTheScreen();
    expect(view.getByText('Export PDF')).toBeOnTheScreen();
    expect(view.getByText('Share file')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Read aloud'));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(
        'Water Field Guide. Overview. Water basics Filter water before drinking.'
      );
    });

    await fireEvent.press(view.getByLabelText('Chapters'));

    expect(view.getByLabelText('Table of Contents')).toBeOnTheScreen();
    expect(view.getByText('Water basics')).toBeOnTheScreen();
    expect(view.getByText('Make water safe to drink.')).toBeOnTheScreen();
    expect(view.getByText('p.3')).toBeOnTheScreen();
  });

  test('disables active WebView content for downloaded snapshots', async () => {
    prepareContent.mockImplementationOnce(async () => ({
      uri: 'file:///guides/water/index.html',
      allowReadAccessToURL: 'file:///guides/water/',
      allowsActiveContent: false,
      format: 'html',
      title: guidePack.title,
    }));
    const { default: GuideReaderScreen } = await import('@/app/content/reader');

    const view = await render(<GuideReaderScreen />);
    const webView = await view.findByTestId('reader-webview');

    expect(webView.props.javaScriptEnabled).toBe(false);
    expect(webView.props.domStorageEnabled).toBe(false);
    expect(webView.props.injectedJavaScript).toBeUndefined();
    expect(webView.props.allowFileAccess).toBe(true);
  });
});
