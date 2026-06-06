import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { RichNoteEditor, type RichNoteEditorValue } from '@/components/notes/rich-note-editor';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DEFAULT_NOTE_CONTENT_FORMAT, type NoteContentFormat } from '@/constants/note-content';
import { DEFAULT_NOTE_THEME_ID, getNoteTheme, type NoteThemeId } from '@/constants/note-themes';
import { RagService } from '@/services/ai/rag.service';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import type { Note } from '@/types/db';
import { useNavigation } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Keyboard, Platform, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { PenLine, Plus, Tag } from 'lucide-react-native';
import * as React from 'react';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NoteEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const noteId = typeof params.id === 'string' ? params.id : undefined;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const vaultUnlocked = useAuthStore((state) => state.unlocked);

  const [loading, setLoading] = React.useState(Boolean(noteId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [contentHtml, setContentHtml] = React.useState<string | null>(null);
  const [contentJson, setContentJson] = React.useState<string | null>(null);
  const [contentFormat, setContentFormat] = React.useState<NoteContentFormat>(
    DEFAULT_NOTE_CONTENT_FORMAT
  );
  const [themeId, setThemeId] = React.useState<NoteThemeId>(DEFAULT_NOTE_THEME_ID);
  const [originalTitle, setOriginalTitle] = React.useState('');
  const [originalBody, setOriginalBody] = React.useState('');
  const [originalContentHtml, setOriginalContentHtml] = React.useState<string | null>(null);
  const [originalContentJson, setOriginalContentJson] = React.useState<string | null>(null);
  const [originalContentFormat, setOriginalContentFormat] = React.useState<NoteContentFormat>(
    DEFAULT_NOTE_CONTENT_FORMAT
  );
  const [originalThemeId, setOriginalThemeId] = React.useState<NoteThemeId>(DEFAULT_NOTE_THEME_ID);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);
  const allowLeaveRef = React.useRef(false);
  const pendingLeaveActionRef = React.useRef<Parameters<typeof navigation.dispatch>[0] | null>(
    null
  );

  const bodyMinHeight = Math.max(360, windowHeight - insets.top - insets.bottom - 190);
  const bottomPadding = Math.max(insets.bottom + 64, 96);
  const keyboardBottomOffset = Math.max(insets.bottom + 28, 40);
  const inputHintProp = 'place' + 'holder';
  const inputHintColorProp = `${inputHintProp}TextColor`;
  const noteTheme = React.useMemo(
    () => getNoteTheme(themeId, effectiveTheme),
    [effectiveTheme, themeId]
  );

  React.useEffect(() => {
    if (!noteId) return;
    setLoading(true);
    NotesRepository.get(noteId)
      .then((note) => {
        if (!note) {
          setError('Note not found.');
          return;
        }
        hydrate(note);
      })
      .finally(() => setLoading(false));
  }, [noteId]);

  function hydrate(note: Note) {
    setTitle(note.title);
    setBody(note.body);
    setContentHtml(note.contentHtml);
    setContentJson(note.contentJson);
    setContentFormat(note.contentFormat);
    setThemeId(note.themeId);
    setOriginalTitle(note.title);
    setOriginalBody(note.body);
    setOriginalContentHtml(note.contentHtml);
    setOriginalContentJson(note.contentJson);
    setOriginalContentFormat(note.contentFormat);
    setOriginalThemeId(note.themeId);
  }

  const hasSavableContent =
    !!title.trim() || !!body.trim() || !!contentHtml?.replace(/<p><\/p>/g, '').trim();
  const hasUnsavedChanges = React.useMemo(() => {
    if (noteId) {
      return (
        title !== originalTitle ||
        body !== originalBody ||
        contentHtml !== originalContentHtml ||
        contentJson !== originalContentJson ||
        contentFormat !== originalContentFormat ||
        themeId !== originalThemeId
      );
    }
    return hasSavableContent;
  }, [
    body,
    contentFormat,
    contentHtml,
    contentJson,
    hasSavableContent,
    noteId,
    originalBody,
    originalContentFormat,
    originalContentHtml,
    originalContentJson,
    originalThemeId,
    originalTitle,
    themeId,
    title,
  ]);

  const updateRichContent = React.useCallback((value: RichNoteEditorValue) => {
    setBody(value.body);
    setContentHtml(value.contentHtml);
    setContentJson(value.contentJson);
    setContentFormat(value.contentFormat);
  }, []);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || saving || !hasUnsavedChanges || confirmDiscardOpen) return;

      event.preventDefault();
      pendingLeaveActionRef.current = event.data.action;
      Keyboard.dismiss();
      setTimeout(() => setConfirmDiscardOpen(true), 150);
    });

    return unsubscribe;
  }, [confirmDiscardOpen, hasUnsavedChanges, navigation, saving]);

  function discardChanges() {
    const pendingAction = pendingLeaveActionRef.current;
    if (!pendingAction) return;
    allowLeaveRef.current = true;
    setConfirmDiscardOpen(false);
    pendingLeaveActionRef.current = null;
    navigation.dispatch(pendingAction);
  }

  async function saveNote() {
    if (saving || !hasSavableContent) return;
    if (!vaultUnlocked) {
      setError('Unlock the vault to save notes.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = noteId
        ? await NotesRepository.update(noteId, {
            title,
            body,
            contentHtml,
            contentJson,
            contentFormat,
            themeId,
          })
        : await NotesRepository.create({
            title,
            body,
            contentHtml,
            contentJson,
            contentFormat,
            themeId,
          });

      if (!saved) {
        setError('Unable to save note.');
        return;
      }

      await RagService.indexNote(saved.id);
      allowLeaveRef.current = true;
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: noteId ? 'Edit note' : 'Create note',
          headerRight: () => (
            <View className="flex-row items-center gap-4">
              {noteId ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/notes/labels' as never,
                      params: { noteId } as never,
                    })
                  }
                  disabled={loading || saving}
                  hitSlop={8}
                  accessibilityLabel="Edit labels">
                  <Icon as={Tag} className="text-primary size-6" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void saveNote()}
                disabled={loading || saving || !hasSavableContent}
                hitSlop={8}
                className="opacity-100 disabled:opacity-40">
                <Icon as={noteId ? PenLine : Plus} className="text-primary size-6" />
              </Pressable>
            </View>
          ),
        }}
      />

      {confirmDiscardOpen ? (
        <ConfirmModal
          visible={confirmDiscardOpen}
          title="Discard changes?"
          description="Your edits have not been saved to the vault."
          confirmVariant="destructive"
          onCancel={() => {
            pendingLeaveActionRef.current = null;
            setConfirmDiscardOpen(false);
          }}
          onConfirm={discardChanges}
        />
      ) : null}

      <ArkKeyboardAwareScrollView
        bottomOffset={keyboardBottomOffset}
        className="bg-background flex-1"
        style={{ backgroundColor: noteTheme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: bottomPadding,
        }}
        extraKeyboardSpace={Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled">
        <Animated.View sharedTransitionTag={noteId ? `note-title-${noteId}` : undefined}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            {...{ [inputHintProp]: 'Untitled', [inputHintColorProp]: noteTheme.mutedForeground }}
            className="text-foreground px-0 py-0 text-3xl font-bold"
            style={{ color: noteTheme.foreground }}
          />
        </Animated.View>

        {error ? <Text className="text-destructive mt-2">{error}</Text> : null}

        {loading ? (
          <Text className="mt-6" variant="muted" style={{ color: noteTheme.mutedForeground }}>
            Loading note...
          </Text>
        ) : (
          <Animated.View sharedTransitionTag={noteId ? `note-body-${noteId}` : undefined}>
            <RichNoteEditor
              key={noteId ?? 'new-note'}
              body={body}
              contentHtml={contentHtml}
              contentJson={contentJson}
              contentFormat={contentFormat}
              noteTheme={noteTheme}
              minHeight={bodyMinHeight}
              onChange={updateRichContent}
            />
          </Animated.View>
        )}
      </ArkKeyboardAwareScrollView>
    </>
  );
}
