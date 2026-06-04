import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getNoteTheme } from '@/constants/note-themes';
import { NAV_COLORS, type ThemePreference } from '@/constants/theme';
import type { LabelColorMap } from '@/lib/label-colors';
import type { Note } from '@/types/db';
import { CheckCircle2, Circle, Pin } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

type NotesListProps = {
  notes: Note[];
  labelColors: LabelColorMap;
  effectiveTheme: ThemePreference;
  mode: 'normal' | 'selection' | 'organize';
  selectedIds: ReadonlySet<string>;
  onNotePress: (note: Note) => void;
  onNoteLongPress: (note: Note) => void;
  onNotePinPress: (note: Note) => void;
};

export function NotesList({
  notes,
  labelColors: _labelColors,
  effectiveTheme,
  mode,
  selectedIds,
  onNotePress,
  onNoteLongPress,
  onNotePinPress,
}: NotesListProps) {
  return (
    <View className="gap-2">
      {notes.map((note) => {
        const noteTheme = getNoteTheme(note.themeId, effectiveTheme);
        const selected = selectedIds.has(note.id);
        const selectedColor = NAV_COLORS[effectiveTheme].primary;
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
              {mode === 'normal' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${note.isFavorite ? 'Unpin' : 'Pin'} ${note.title || 'note'}`}
                  hitSlop={8}
                  onPress={(event) => {
                    event.stopPropagation();
                    onNotePinPress(note);
                  }}>
                  <Icon
                    as={Pin}
                    className="size-4"
                    color={note.isFavorite ? selectedColor : noteTheme.mutedForeground}
                    fill={note.isFavorite ? selectedColor : 'none'}
                  />
                </Pressable>
              ) : null}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
