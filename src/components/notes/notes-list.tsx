import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getNoteTheme } from '@/constants/note-themes';
import type { EffectiveTheme } from '@/constants/theme';
import type { LabelColorMap } from '@/lib/label-colors';
import { useThemeStore } from '@/stores/theme-store';
import type { Note } from '@/types/db';
import { CheckCircle2, Circle } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

type NotesListProps = {
  notes: Note[];
  labelColors: LabelColorMap;
  effectiveTheme: EffectiveTheme;
  mode: 'normal' | 'selection' | 'organize';
  selectedIds: ReadonlySet<string>;
  onNotePress: (note: Note) => void;
  onNoteLongPress: (note: Note) => void;
};

export function NotesList({
  notes,
  labelColors: _labelColors,
  effectiveTheme,
  mode,
  selectedIds,
  onNotePress,
  onNoteLongPress,
}: NotesListProps) {
  const colors = useThemeStore((state) => state.colors);
  const selectedColor = colors.primary;

  return (
    <View className="gap-2">
      {notes.map((note) => {
        const noteTheme = getNoteTheme(note.themeId, effectiveTheme, colors);
        const selected = selectedIds.has(note.id);
        return (
          <Pressable
            key={note.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onNotePress(note)}
            onLongPress={() => onNoteLongPress(note)}
            delayLongPress={220}>
            <Card
              className="flex-row items-center gap-2 px-3 py-2"
              style={{
                backgroundColor: noteTheme.background,
                borderColor: selected ? selectedColor : noteTheme.border,
                minHeight: 48,
              }}>
              {mode === 'selection' || mode === 'organize' ? (
                <Icon
                  as={selected ? CheckCircle2 : Circle}
                  className="size-5"
                  color={selected ? selectedColor : noteTheme.mutedForeground}
                />
              ) : null}
              <Animated.View
                className="min-w-0 flex-1"
                sharedTransitionTag={`note-title-${note.id}`}>
                <Text numberOfLines={1} variant="small" style={{ color: noteTheme.foreground }}>
                  {note.title}
                </Text>
              </Animated.View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
