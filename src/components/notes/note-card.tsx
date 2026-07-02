import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getNoteTheme } from '@/constants/note-themes';
import type { EffectiveTheme } from '@/constants/theme';
import { getLabelColor, type LabelColorMap } from '@/lib/label-colors';
import { getNotePreviewText } from '@/lib/note-text';
import { useThemeStore } from '@/stores/theme-store';
import type { Note } from '@/types/db';
import { CheckCircle2, Circle } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

type NoteCardProps = {
  note: Note;
  labelColors: LabelColorMap;
  effectiveTheme: EffectiveTheme;
  selectionMode?: boolean;
  selected?: boolean;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
};

function NoteCardImpl({
  note,
  labelColors,
  effectiveTheme,
  selectionMode = false,
  selected = false,
  onPress,
  onLongPress,
}: NoteCardProps) {
  const colors = useThemeStore((state) => state.colors);
  const noteTheme = getNoteTheme(note.themeId, effectiveTheme, colors);
  const selectedColor = colors.primary;
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
          <Animated.View className="min-w-0 flex-1" sharedTransitionTag={`note-title-${note.id}`}>
            <Text variant="large" style={{ color: noteTheme.foreground }}>
              {note.title}
            </Text>
          </Animated.View>
          <View className="flex-row items-center gap-1.5">
            {selectionMode ? (
              <Icon
                as={selected ? CheckCircle2 : Circle}
                className="size-5"
                color={selected ? selectedColor : noteTheme.mutedForeground}
              />
            ) : null}
          </View>
        </View>
        <Animated.View sharedTransitionTag={`note-body-${note.id}`}>
          <Text numberOfLines={3} variant="muted" style={{ color: noteTheme.mutedForeground }}>
            {preview}
          </Text>
        </Animated.View>
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
