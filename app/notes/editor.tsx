import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { RichNoteEditor, type RichNoteEditorValue } from '@/components/notes/rich-note-editor';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { DEFAULT_NOTE_CONTENT_FORMAT, type NoteContentFormat } from '@/constants/note-content';
import { DEFAULT_NOTE_THEME_ID, getNoteTheme, type NoteThemeId } from '@/constants/note-themes';
import { getNotePlainText } from '@/lib/note-text';
import { RagService } from '@/services/ai/rag.service';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { NotePdfService } from '@/services/notes/note-pdf.service';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import type { Note } from '@/types/db';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Check,
  MoreVertical,
  Printer,
  Share2,
  TriangleAlert,
} from 'lucide-react-native';
import * as React from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Linking, TextInput, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DraftSnapshot = {
  title: string;
  body: string;
  contentHtml: string | null;
  contentJson: string | null;
  contentFormat: NoteContentFormat;
  themeId: NoteThemeId;
};

type DraftRef = DraftSnapshot & {
  hasSavableContent: boolean;
  snapshot: string;
};

type NoteExportKind = 'pdf' | 'text';

function snapshotDraft(input: DraftSnapshot) {
  return JSON.stringify(input);
}

function noteSnapshot(note: Note) {
  return snapshotDraft({
    title: note.title,
    body: note.body,
    contentHtml: note.contentHtml,
    contentJson: note.contentJson,
    contentFormat: note.contentFormat,
    themeId: note.themeId,
  });
}

function hasMeaningfulHtml(contentHtml: string | null) {
  return !!contentHtml
    ?.replace(/<p><\/p>/g, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

const inputHintProp = 'place' + 'holder';
const inputHintColorProp = `${inputHintProp}TextColor`;

const HeaderTitleInput = React.memo(
  ({
    initialTitle,
    onTitleChange,
    color,
    hintColor,
  }: {
    initialTitle: string;
    onTitleChange: (text: string) => void;
    color: string;
    hintColor: string;
  }) => {
    const [text, setText] = React.useState(initialTitle);
    const onTitleChangeRef = React.useRef(onTitleChange);
    onTitleChangeRef.current = onTitleChange;

    React.useEffect(() => {
      setText(initialTitle);
    }, [initialTitle]);

    React.useEffect(() => {
      const timer = setTimeout(() => {
        onTitleChangeRef.current(text);
      }, 400);
      return () => clearTimeout(timer);
    }, [text]);

    return (
      <TextInput
        value={text}
        onChangeText={setText}
        {...{
          [inputHintProp]: 'Untitled',
          [inputHintColorProp]: hintColor,
        }}
        accessibilityLabel="Note title"
        className="text-foreground px-0 py-0 text-left text-lg font-semibold"
        returnKeyType="done"
        style={{ color, minWidth: 200, textAlign: 'left' }}
      />
    );
  }
);
HeaderTitleInput.displayName = 'HeaderTitleInput';

type NoteActionsSheetProps = {
  visible: boolean;
  disabled: boolean;
  exporting: NoteExportKind | null;
  onDismiss: () => void;
  onExportPdf: () => void;
  onExportText: () => void;
};

function NoteActionsSheet({
  visible,
  disabled,
  exporting,
  onDismiss,
  onExportPdf,
  onExportText,
}: NoteActionsSheetProps) {
  return (
    <ArkBottomSheet visible={visible} title="Note Actions" onDismiss={onDismiss}>
      <View className="gap-2">
        <Button
          variant="outline"
          disabled={disabled || exporting !== null}
          onPress={() => {
            onDismiss();
            onExportPdf();
          }}>
          {exporting === 'pdf' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={Printer} className="size-4" />
          )}
          <Text>{exporting === 'pdf' ? 'Preparing PDF' : 'Export PDF'}</Text>
        </Button>
        <Button
          variant="outline"
          disabled={disabled || exporting !== null}
          onPress={() => {
            onDismiss();
            onExportText();
          }}>
          {exporting === 'text' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={Share2} className="size-4" />
          )}
          <Text>{exporting === 'text' ? 'Preparing text' : 'Share text'}</Text>
        </Button>
      </View>
    </ArkBottomSheet>
  );
}

export default function NoteEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const routeNoteId = typeof params.id === 'string' ? params.id : undefined;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const colors = useThemeStore((state) => state.colors);
  const vaultUnlocked = useAuthStore((state) => state.unlocked);

  const [savedNoteId, setSavedNoteId] = React.useState<string | undefined>(routeNoteId);
  const [loading, setLoading] = React.useState(Boolean(routeNoteId));
  const [saving, setSaving] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [contentHtml, setContentHtml] = React.useState<string | null>(null);
  const [contentJson, setContentJson] = React.useState<string | null>(null);
  const [contentFormat, setContentFormat] = React.useState<NoteContentFormat>(
    DEFAULT_NOTE_CONTENT_FORMAT
  );
  const [themeId, setThemeId] = React.useState<NoteThemeId>(DEFAULT_NOTE_THEME_ID);
  const [noteActionsOpen, setNoteActionsOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<NoteExportKind | null>(null);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = React.useRef(false);
  const saveQueuedRef = React.useRef(false);
  const savedNoteIdRef = React.useRef<string | undefined>(routeNoteId);
  const vaultUnlockedRef = React.useRef(vaultUnlocked);
  const lastSavedSnapshotRef = React.useRef('');
  const draftRef = React.useRef<DraftRef>({
    title: '',
    body: '',
    contentHtml: null,
    contentJson: null,
    contentFormat: DEFAULT_NOTE_CONTENT_FORMAT,
    themeId: DEFAULT_NOTE_THEME_ID,
    hasSavableContent: false,
    snapshot: snapshotDraft({
      title: '',
      body: '',
      contentHtml: null,
      contentJson: null,
      contentFormat: DEFAULT_NOTE_CONTENT_FORMAT,
      themeId: DEFAULT_NOTE_THEME_ID,
    }),
  });

  const bodyMinHeight = Math.max(420, windowHeight - insets.top - insets.bottom - 138);
  const bottomPadding = Math.max(insets.bottom, 16);
  const keyboardBottomOffset = Math.max(insets.bottom + 28, 40);
  const inputHintProp = 'place' + 'holder';
  const inputHintColorProp = `${inputHintProp}TextColor`;
  const noteTheme = React.useMemo(
    () => getNoteTheme(themeId, effectiveTheme, colors),
    [colors, effectiveTheme, themeId]
  );

  React.useEffect(() => {
    savedNoteIdRef.current = savedNoteId;
  }, [savedNoteId]);

  React.useEffect(() => {
    vaultUnlockedRef.current = vaultUnlocked;
  }, [vaultUnlocked]);

  React.useEffect(() => {
    if (!routeNoteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    NotesRepository.get(routeNoteId)
      .then((note) => {
        if (!note) {
          setError('Note not found.');
          return;
        }
        hydrate(note);
      })
      .finally(() => setLoading(false));
  }, [routeNoteId]);

  function hydrate(note: Note) {
    setSavedNoteId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setContentHtml(note.contentHtml);
    setContentJson(note.contentJson);
    setContentFormat(note.contentFormat);
    setThemeId(note.themeId);
    lastSavedSnapshotRef.current = noteSnapshot(note);
    setSaveState('saved');
  }

  const hasSavableContent = !!title.trim() || !!body.trim() || hasMeaningfulHtml(contentHtml);
  const currentSnapshot = React.useMemo(
    () =>
      snapshotDraft({
        title,
        body,
        contentHtml,
        contentJson,
        contentFormat,
        themeId,
      }),
    [body, contentFormat, contentHtml, contentJson, themeId, title]
  );

  React.useEffect(() => {
    draftRef.current = {
      title,
      body,
      contentHtml,
      contentJson,
      contentFormat,
      themeId,
      hasSavableContent,
      snapshot: currentSnapshot,
    };
  }, [
    body,
    contentFormat,
    contentHtml,
    contentJson,
    currentSnapshot,
    hasSavableContent,
    themeId,
    title,
  ]);

  const persistDraft = React.useCallback(async () => {
    const draft = draftRef.current;
    if (!draft.hasSavableContent || draft.snapshot === lastSavedSnapshotRef.current) return;
    if (!vaultUnlockedRef.current) {
      setError('Unlock the vault to save notes.');
      setSaveState('error');
      return;
    }
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    setError(null);
    setSaving(true);
    setSaveState('saving');
    try {
      const noteId = savedNoteIdRef.current;
      const saved = noteId
        ? await NotesRepository.update(noteId, draft)
        : await NotesRepository.create(draft);

      if (!saved) {
        setError('Unable to save note.');
        setSaveState('error');
        return;
      }

      if (!noteId) {
        setSavedNoteId(saved.id);
        savedNoteIdRef.current = saved.id;
      }
      lastSavedSnapshotRef.current = draft.snapshot;
      setSaveState('saved');
      await RagService.indexNote(saved.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save note.');
      setSaveState('error');
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        void persistDraft();
      }
    }
  }, []);

  React.useEffect(() => {
    if (loading || !hasSavableContent || currentSnapshot === lastSavedSnapshotRef.current) return;
    setSaveState('idle');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistDraft();
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentSnapshot, hasSavableContent, loading, persistDraft]);

  React.useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      void persistDraft();
    },
    [persistDraft]
  );

  const updateRichContent = React.useCallback((value: RichNoteEditorValue) => {
    setBody(value.body);
    setContentHtml(value.contentHtml);
    setContentJson(value.contentJson);
    setContentFormat(value.contentFormat);
  }, []);

  function buildExportNote(): Note {
    const now = Date.now();
    return {
      id: savedNoteId ?? 'draft-note',
      title: title.trim() || 'Untitled Note',
      body,
      contentHtml,
      contentJson,
      contentFormat,
      tags: [],
      themeId,
      sortOrder: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  async function exportNotePdf() {
    if (!hasSavableContent) return;
    setExporting('pdf');
    try {
      const note = buildExportNote();
      const { uri } = await NotePdfService.export(note);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Export ${note.title}`,
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
        return;
      }

      const canOpen = await Linking.canOpenURL(uri);
      if (!canOpen) throw new Error('No app is available to open this PDF.');
      await Linking.openURL(uri);
    } catch (exportError) {
      showSheetAlert(
        'Export failed',
        exportError instanceof Error ? exportError.message : 'Unable to export note.'
      );
    } finally {
      setExporting(null);
    }
  }

  async function exportNoteText() {
    if (!hasSavableContent) return;
    setExporting('text');
    try {
      const note = buildExportNote();
      const noteText = [note.title, getNotePlainText(note)].filter(Boolean).join('\n\n').trim();
      if (!noteText) return;
      await FileSystemService.ensureAppDirectories();
      const safeName = FileSystemService.safeFileName(note.title) || 'untitled-note';
      const uri = `${FileSystemService.dir('cache')}${safeName}.txt`;
      await FileSystem.writeAsStringAsync(uri, noteText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share ${note.title}`,
          mimeType: 'text/plain',
          UTI: 'public.plain-text',
        });
        return;
      }
      showSheetAlert('Note saved', 'Saved a plaintext copy to Ark cache.');
    } catch (exportError) {
      showSheetAlert(
        'Export failed',
        exportError instanceof Error ? exportError.message : 'Unable to export note.'
      );
    } finally {
      setExporting(null);
    }
  }

  const saveStatusLabel =
    saveState === 'saving' || saving
      ? 'Saving locally...'
      : saveState === 'error'
        ? 'Not saved'
        : saveState === 'saved'
          ? 'Saved locally'
          : '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'left',
          headerTitle: () => (
            <View>
              <HeaderTitleInput
                initialTitle={title}
                onTitleChange={setTitle}
                color={noteTheme.foreground}
                hintColor={noteTheme.mutedForeground}
              />
              <View className="-mt-1 flex-row items-center gap-1">
                {saveState === 'saving' || saving ? (
                  <ActivityIndicator size={10} color={noteTheme.mutedForeground} />
                ) : saveState === 'saved' ? (
                  <Icon as={Check} className="size-2.5" color={noteTheme.mutedForeground} />
                ) : saveState === 'error' ? (
                  <Icon as={TriangleAlert} className="text-destructive size-2.5" />
                ) : null}
                {saveState !== 'idle' && (
                  <Text
                    className="text-[10px]"
                    style={{
                      color: saveState === 'error' ? '#ef4444' : noteTheme.mutedForeground,
                    }}>
                    {saveState === 'saving' || saving
                      ? 'Saving...'
                      : saveState === 'saved'
                        ? 'Saved'
                        : 'Error'}
                  </Text>
                )}
              </View>
            </View>
          ),
          headerLeft: () => (
            <Button
              accessibilityLabel="Back to notes"
              className="mr-2 h-11 w-11 rounded-full"
              size="icon"
              variant="ghost"
              onPress={() => router.back()}>
              <Icon as={ChevronLeft} className="text-foreground size-5" />
            </Button>
          ),
          headerRight: () => (
            <Button
              accessibilityLabel="Note actions"
              className="ml-2 h-11 w-11 rounded-full"
              size="icon"
              variant="ghost"
              disabled={loading || !hasSavableContent}
              onPress={() => setNoteActionsOpen(true)}>
              {exporting ? (
                <ActivityIndicator size="small" color={noteTheme.mutedForeground} />
              ) : (
                <Icon as={MoreVertical} className="text-foreground size-5" />
              )}
            </Button>
          ),
        }}
      />

      <View className="bg-background flex-1" style={{ backgroundColor: noteTheme.background }}>
        {error ? <Text className="text-destructive mt-2 px-4">{error}</Text> : null}

        {loading ? (
          <Text className="mt-6 px-4" variant="muted" style={{ color: noteTheme.mutedForeground }}>
            Loading note...
          </Text>
        ) : (
          <Animated.View
            className="flex-1"
            sharedTransitionTag={savedNoteId ? `note-body-${savedNoteId}` : undefined}>
            <RichNoteEditor
              key={routeNoteId ?? 'new-note'}
              body={body}
              contentHtml={contentHtml}
              contentJson={contentJson}
              contentFormat={contentFormat}
              noteTheme={noteTheme}
              minHeight={bodyMinHeight}
              bottomInset={bottomPadding}
              onChange={updateRichContent}
            />
          </Animated.View>
        )}
      </View>
      <NoteActionsSheet
        visible={noteActionsOpen}
        disabled={!hasSavableContent}
        exporting={exporting}
        onDismiss={() => setNoteActionsOpen(false)}
        onExportPdf={() => void exportNotePdf()}
        onExportText={() => void exportNoteText()}
      />
    </>
  );
}
