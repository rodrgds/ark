import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getNoteTheme } from '@/constants/note-themes';
import type { ThemePreference } from '@/constants/theme';
import { getNotePreviewText } from '@/lib/note-text';
import type { Note } from '@/types/db';
import { GripVertical } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type NotesOrganizeListProps = {
  notes: Note[];
  effectiveTheme: ThemePreference;
  movingNoteId: string | null;
  onMoveToIndex: (noteId: string, targetIndex: number) => void;
};

const ROW_HEIGHT = 52;

export function NotesOrganizeList({
  notes,
  effectiveTheme,
  movingNoteId,
  onMoveToIndex,
}: NotesOrganizeListProps) {
  return (
    <View className="gap-2">
      {notes.map((note, index) => {
        const noteTheme = getNoteTheme(note.themeId, effectiveTheme);
        const moving = movingNoteId === note.id;
        return (
          <DraggableOrganizeRow
            key={note.id}
            note={note}
            index={index}
            count={notes.length}
            moving={moving}
            effectiveTheme={effectiveTheme}
            onMoveToIndex={onMoveToIndex}
          />
        );
      })}
    </View>
  );
}

function DraggableOrganizeRow({
  note,
  index,
  count,
  moving,
  effectiveTheme,
  onMoveToIndex,
}: {
  note: Note;
  index: number;
  count: number;
  moving: boolean;
  effectiveTheme: ThemePreference;
  onMoveToIndex: (noteId: string, targetIndex: number) => void;
}) {
  const noteTheme = getNoteTheme(note.themeId, effectiveTheme);
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const preview = getNotePreviewText(note);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!moving)
        .onBegin(() => {
          dragging.value = 1;
        })
        .onUpdate((event) => {
          translateY.value = event.translationY;
        })
        .onFinalize((event) => {
          const offset = Math.round(event.translationY / ROW_HEIGHT);
          const targetIndex = Math.max(0, Math.min(count - 1, index + offset));
          translateY.value = withTiming(0, {
            duration: 140,
            easing: Easing.out(Easing.cubic),
          });
          dragging.value = 0;
          if (targetIndex !== index) {
            scheduleOnRN(onMoveToIndex, note.id, targetIndex);
          }
        }),
    [count, dragging, index, moving, note.id, onMoveToIndex, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    elevation: dragging.value ? 8 : 0,
    opacity: moving ? 0.55 : 1,
    transform: [{ translateY: translateY.value }],
    zIndex: dragging.value ? 20 : 0,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Card
        className="flex-row items-center gap-2 px-3 py-2"
        style={{
          backgroundColor: noteTheme.background,
          borderColor: noteTheme.border,
          minHeight: ROW_HEIGHT,
        }}>
        <GestureDetector gesture={pan}>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel={`Drag ${note.title || 'note'} to reorder`}
            className="h-9 w-9 items-center justify-center rounded-md">
            <Icon as={GripVertical} className="size-5" color={noteTheme.mutedForeground} />
          </View>
        </GestureDetector>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} variant="small" style={{ color: noteTheme.foreground }}>
            {note.title}
          </Text>
          <Text numberOfLines={1} variant="muted" style={{ color: noteTheme.mutedForeground }}>
            {preview}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
}
