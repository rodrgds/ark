import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getNoteTheme } from '@/constants/note-themes';
import { NAV_COLORS, type ThemePreference } from '@/constants/theme';
import { getLabelColor, type LabelColorMap } from '@/lib/label-colors';
import { getNotePreviewText } from '@/lib/note-text';
import type { Note } from '@/types/db';
import { CheckCircle2, Circle, MoreVertical, Star } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type NoteCardProps = {
  note: Note;
  labelColors: LabelColorMap;
  effectiveTheme: ThemePreference;
  selectionMode?: boolean;
  selected?: boolean;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
  onMenuPress?: (note: Note) => void;
};

function NoteCardImpl({
  note,
  labelColors,
  effectiveTheme,
  selectionMode = false,
  selected = false,
  onPress,
  onLongPress,
  onMenuPress,
}: NoteCardProps) {
  const noteTheme = getNoteTheme(note.themeId, effectiveTheme);
  const selectedColor = NAV_COLORS[effectiveTheme].primary;
  const preview = getNotePreviewText(note);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress(note)}
      delayLongPress={220}>
      <Card
        className="gap-2"
        style={{
          backgroundColor: noteTheme.background,
          borderColor: selected ? selectedColor : noteTheme.border,
        }}>
        <View className="flex-row items-start justify-between gap-2">
          <Text variant="large" className="min-w-0 flex-1" style={{ color: noteTheme.foreground }}>
            {note.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {note.isFavorite ? (
              <Icon as={Star} className="size-3.5" color={noteTheme.mutedForeground} />
            ) : null}
            {selectionMode ? (
              <Icon
                as={selected ? CheckCircle2 : Circle}
                className="size-5"
                color={selected ? selectedColor : noteTheme.mutedForeground}
              />
            ) : onMenuPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open actions for ${note.title || 'note'}`}
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  onMenuPress(note);
                }}>
                <Icon as={MoreVertical} className="size-4" color={noteTheme.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Text numberOfLines={3} variant="muted" style={{ color: noteTheme.mutedForeground }}>
          {preview}
        </Text>
        {note.tags.length ? (
          <View className="mt-1 flex-row flex-wrap gap-1.5">
            {note.tags.map((label) => {
              const labelColor = getLabelColor(label, labelColors);
              return (
                <View
                  key={`${note.id}-${label}`}
                  className="rounded-full border px-2 py-0.5"
                  style={{
                    backgroundColor: noteTheme.chipBackground,
                    borderColor: labelColor,
                  }}>
                  <Text className="text-xs" style={{ color: noteTheme.chipForeground }}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

export const NoteCard = React.memo(NoteCardImpl);
