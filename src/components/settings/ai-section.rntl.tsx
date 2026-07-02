import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import {
  EMBEDDING_MODEL_OPTIONS,
  EXECUTORCH_MPNET_EMBEDDING_MODEL_ID,
  EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
  RAG_HASH_EMBEDDING_TITLE,
} from '@/services/ai/embedding-models';
import { RAG_HASH_EMBEDDING_MODEL_ID } from '@/services/ai/rag-embedding';
import type { ContentPack } from '@/types/content';

installCommonRntlMocks(mock);

const { fireEvent, render } = await import('@testing-library/react-native');
const { AiSection } = await import('@/components/settings/ai-section');

type AiSectionProps = React.ComponentProps<typeof AiSection>;
type EmbeddingIndexStatus = NonNullable<AiSectionProps['embeddingIndexStatus']>;
type ModelStatus = NonNullable<AiSectionProps['modelStatus']>;

const importLocalModel = mock(async () => undefined);
const addModelUrl = mock(
  async (_input: { title: string; url: string; checksum: string }) => undefined
);
const selectEmbeddingModel = mock(async () => undefined);
const runModelAction = mock(async () => undefined);
const removeModel = mock(async () => undefined);

const gemmaModel: ContentPack = {
  id: 'model-gemma4-e2b-it-q4-k-m',
  title: 'Gemma 4 E2B Instruct Q4',
  description: 'Compact offline answer model.',
  category: 'AI Models',
  format: 'gguf',
  modelRole: 'chat',
  estimatedSize: '2.1 GB',
  sourceLabel: 'Local import',
  installed: true,
  localUri: 'file:///models/gemma.gguf',
  installStatus: 'installed',
  progress: 1,
  createdAt: 1,
  updatedAt: 1,
};

const modelStatus: ModelStatus = {
  adapter: 'llama',
  installedModels: 1,
  installedChatModels: 1,
  installedEmbeddingModels: 1,
  installedVoiceModels: 0,
  availableModels: 3,
  availableChatModels: 1,
  availableEmbeddingModels: 3,
  availableVoiceModels: 0,
  selectedModelId: gemmaModel.id,
  selectedEmbeddingModelId: RAG_HASH_EMBEDDING_MODEL_ID,
  selectedVoiceModelId: null,
  modelPickerEnabled: false,
  chatModelDisabled: false,
  activeVoiceModelTitle: null,
  voiceReady: false,
  activeModelTitle: gemmaModel.title,
  contextTokens: 4096,
  maxResponseTokens: 512,
  message: `${gemmaModel.title} is ready for offline answers.`,
};

function indexStatus(
  overrides: Partial<EmbeddingIndexStatus[number]> = {}
): EmbeddingIndexStatus[number] {
  return {
    id: EXECUTORCH_TEXT_EMBEDDING_MODEL_ID,
    title: 'ExecuTorch multi-qa MiniLM source search (384d)',
    active: true,
    installed: true,
    total: 20,
    embedded: 20,
    complete: 1,
    domains: [
      { domain: 'notes', total: 8, embedded: 8, complete: 1 },
      { domain: 'guides', total: 12, embedded: 12, complete: 1 },
    ],
    ...overrides,
  };
}

function renderAiSection(props: Partial<AiSectionProps> = {}) {
  return render(
    <AiSection
      modelStatus={modelStatus}
      installedModels={[gemmaModel]}
      activeModel={gemmaModel}
      activeEmbeddingModel={EMBEDDING_MODEL_OPTIONS[0]}
      embeddingModels={EMBEDDING_MODEL_OPTIONS}
      embeddingIndexStatus={[
        indexStatus({
          id: RAG_HASH_EMBEDDING_MODEL_ID,
          title: `${RAG_HASH_EMBEDDING_TITLE} (256d)`,
          active: true,
          installed: true,
        }),
        indexStatus(),
        indexStatus({
          id: EXECUTORCH_MPNET_EMBEDDING_MODEL_ID,
          title: 'ExecuTorch multi-qa MPNet source search (768d)',
          active: false,
          installed: false,
        }),
      ]}
      chatModels={[gemmaModel]}
      busy={null}
      aiMessage={null}
      importLocalModel={importLocalModel}
      addModelUrl={addModelUrl}
      selectEmbeddingModel={selectEmbeddingModel}
      runModelAction={runModelAction}
      removeModel={removeModel}
      {...props}
    />
  );
}

describe('AiSection', () => {
  beforeEach(() => {
    importLocalModel.mockClear();
    addModelUrl.mockClear();
    selectEmbeddingModel.mockClear();
    runModelAction.mockClear();
    removeModel.mockClear();
  });

  test('keeps answer-model imports tucked behind the add sheet', async () => {
    const view = await renderAiSection();

    expect(view.getByText('Local AI')).toBeOnTheScreen();
    expect(view.getByText('Offline answers ready')).toBeOnTheScreen();
    expect(view.getByText('Answer model')).toBeOnTheScreen();
    expect(view.getAllByText(gemmaModel.title).length).toBeGreaterThan(0);
    expect(view.getByText('Source search')).toBeOnTheScreen();
    expect(view.getAllByText('Battery saver source search').length).toBeGreaterThan(0);
    expect(view.getAllByText('Fast search').length).toBeGreaterThan(0);
    expect(view.queryByText('Import GGUF file')).toBeNull();

    await fireEvent.press(view.getByText('Add'));

    expect(view.getByLabelText('Add answer model')).toBeOnTheScreen();
    expect(view.getByText('Import GGUF file')).toBeOnTheScreen();
    expect(view.getByPlaceholderText('https://.../model.gguf')).toBeOnTheScreen();
    expect(
      view.getByText('Source search is built in. Custom files only change answer writing.')
    ).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Import GGUF file'));

    expect(importLocalModel).toHaveBeenCalledTimes(1);
  });

  test('surfaces rebuild progress for the active source-search model', async () => {
    const view = await renderAiSection({
      embeddingIndexStatus: [
        indexStatus({
          id: RAG_HASH_EMBEDDING_MODEL_ID,
          title: `${RAG_HASH_EMBEDDING_TITLE} (256d)`,
          embedded: 5,
          total: 20,
          complete: 0.25,
          domains: [
            { domain: 'notes', total: 8, embedded: 4, complete: 0.5 },
            { domain: 'guides', total: 12, embedded: 1, complete: 1 / 12 },
          ],
        }),
      ],
    });

    expect(view.getByText('Search index coverage')).toBeOnTheScreen();
    expect(
      view.getByText('Battery saver source search (256d) is rebuilding: 25% ready.')
    ).toBeOnTheScreen();
    expect(view.getByText('Rebuilding · 25%')).toBeOnTheScreen();
  });
});
