import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { RichNoteEditorValue } from '@/components/notes/rich-note-editor';
import type { Note } from '@/types/db';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

const createdNote: Note = {
  id: 'note-1',
  title: 'Storm prep',
  body: 'Pack radio and water',
  contentHtml: '<p>Pack radio and water</p>',
  contentJson: '{"type":"doc"}',
  contentFormat: 'html',
  themeId: 'default',
  labels: [],
  tags: [],
  isFavorite: false,
  isArchived: false,
  isDeleted: false,
  sortOrder: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const createNote = mock(async (_input: unknown) => createdNote);
const updateNote = mock(async (_id: string, _input: unknown) => createdNote);
const indexNote = mock(async (_id: string) => undefined);

mock.module('expo-router', () => ({
  router: {
    back: () => undefined,
    push: () => undefined,
    replace: () => undefined,
  },
  useRouter: () => ({
    back: () => undefined,
    push: () => undefined,
    replace: () => undefined,
  }),
  Stack: {
    Screen: ({
      options,
    }: {
      options?: {
        headerTitle?: () => React.ReactNode;
      };
    }) => <>{options?.headerTitle?.()}</>,
  },
  Tabs: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({}),
  Link: ({ children }: React.PropsWithChildren) => children,
}));

mock.module('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

mock.module('@/components/layout/keyboard-controller', () => ({
  ArkKeyboardAwareScrollView: ({ children }: React.PropsWithChildren) =>
    React.createElement('View', null, children),
}));

mock.module('@/components/notes/rich-note-editor', () => ({
  RichNoteEditor: ({
    body,
    onChange,
  }: {
    body: string;
    onChange: (value: RichNoteEditorValue) => void;
  }) =>
    React.createElement('TextInput', {
      accessibilityLabel: 'Note body',
      value: body,
      onChangeText: (nextBody: string) =>
        onChange({
          body: nextBody,
          contentFormat: 'html',
          contentHtml: `<p>${nextBody}</p>`,
          contentJson: JSON.stringify({
            content: [{ content: [{ text: nextBody, type: 'text' }], type: 'paragraph' }],
            type: 'doc',
          }),
        }),
    }),
}));

mock.module('@/services/db/repositories/notes.repo', () => ({
  NotesRepository: {
    create: createNote,
    get: async () => null,
    update: updateNote,
  },
}));

mock.module('@/services/ai/rag.service', () => ({
  RagService: {
    indexNote,
  },
}));

mock.module('@/stores/auth-store', () => ({
  useAuthStore: <T,>(selector: (state: { unlocked: boolean }) => T) => selector({ unlocked: true }),
}));

describe('NoteEditorScreen autosave', () => {
  beforeEach(() => {
    createNote.mockClear();
    updateNote.mockClear();
    indexNote.mockClear();
  });

  test('creates and indexes a note after editing title and body without pressing save', async () => {
    const { default: NoteEditorScreen } = await import('@/app/notes/editor');
    const view = await render(<NoteEditorScreen />);

    await fireEvent.changeText(view.getByLabelText('Note title'), 'Storm prep');
    await fireEvent.changeText(view.getByLabelText('Note body'), 'Pack radio and water');

    await waitFor(
      () => {
        expect(createNote).toHaveBeenCalledWith(
          expect.objectContaining({
            body: 'Pack radio and water',
            contentFormat: 'html',
            contentHtml: '<p>Pack radio and water</p>',
            title: 'Storm prep',
          })
        );
      },
      { timeout: 1600 }
    );
    expect(updateNote).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(indexNote).toHaveBeenCalledWith('note-1');
    });
    expect(await view.findByText('Saved locally')).toBeTruthy();
  });
});
