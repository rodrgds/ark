import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { RagService } from '@/services/ai/rag.service';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import type { Note } from '@/types/db';
import { useNavigation } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Keyboard, Platform, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { PenLine, Plus } from 'lucide-react-native';
import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NoteEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const noteId = typeof params.id === 'string' ? params.id : undefined;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();

  const [loading, setLoading] = React.useState(Boolean(noteId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [bodyContentHeight, setBodyContentHeight] = React.useState(0);
  const [originalTitle, setOriginalTitle] = React.useState('');
  const [originalBody, setOriginalBody] = React.useState('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);
  const allowLeaveRef = React.useRef(false);
  const pendingLeaveActionRef = React.useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

  const bodyMinHeight = Math.max(360, windowHeight - insets.top - insets.bottom - 190);
  const bodyHeight = Math.max(bodyMinHeight, bodyContentHeight + 24);
  const bottomPadding = Math.max(insets.bottom + 64, 96);
  const keyboardBottomOffset = Math.max(insets.bottom + 28, 40);

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
    setOriginalTitle(note.title);
    setOriginalBody(note.body);
  }

  const hasUnsavedChanges = React.useMemo(() => {
    if (noteId) {
      return title !== originalTitle || body !== originalBody;
    }
    return !!title.trim() || !!body.trim();
  }, [body, body.trim, noteId, originalBody, originalTitle, title, title.trim]);

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
    if (saving || (!title.trim() && !body.trim())) return;
    setError(null);
    setSaving(true);
    try {
      const saved = noteId
        ? await NotesRepository.update(noteId, { title, body })
        : await NotesRepository.create({ title, body });

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
              <Pressable
                onPress={() => void saveNote()}
                disabled={loading || saving || (!title.trim() && !body.trim())}
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
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled"
          className="text-foreground px-0 py-0 text-3xl font-bold"
          placeholderTextColor="#71717A"
        />

        {error ? <Text className="text-destructive mt-2">{error}</Text> : null}

        <TextInput
          value={body}
          placeholder="Write your note..."
          multiline
          scrollEnabled={false}
          autoCorrect
          blurOnSubmit={false}
          textAlignVertical="top"
          onChangeText={setBody}
          onContentSizeChange={(event) => {
            setBodyContentHeight(event.nativeEvent.contentSize.height);
          }}
          className="text-foreground mt-4 px-0 py-0 text-base leading-7"
          style={{ height: bodyHeight }}
          placeholderTextColor="#A1A1AA"
        />
      </ArkKeyboardAwareScrollView>
    </>
  );
}
