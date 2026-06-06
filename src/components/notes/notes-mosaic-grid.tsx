import { NoteCard } from '@/components/notes/note-card';
import type { ThemePreference } from '@/constants/theme';
import type { LabelColorMap } from '@/lib/label-colors';
import type { Note } from '@/types/db';
import * as React from 'react';
import { View } from 'react-native';

type NotesMosaicGridProps = {
  notes: Note[];
  labelColors: LabelColorMap;
  effectiveTheme: ThemePreference;
  mode: 'normal' | 'selection' | 'organize';
  selectedIds: ReadonlySet<string>;
  onNotePress: (note: Note) => void;
  onNoteLongPress: (note: Note) => void;
};

export function NotesMosaicGrid({
  notes,
  labelColors,
  effectiveTheme,
  mode,
  selectedIds,
  onNotePress,
  onNoteLongPress,
}: NotesMosaicGridProps) {
  const leftColumn = React.useMemo(() => notes.filter((_, index) => index % 2 === 0), [notes]);
  const rightColumn = React.useMemo(() => notes.filter((_, index) => index % 2 === 1), [notes]);

  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1 gap-3">
        {leftColumn.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            labelColors={labelColors}
            effectiveTheme={effectiveTheme}
            selectionMode={mode === 'selection' || mode === 'organize'}
            selected={selectedIds.has(note.id)}
            onPress={onNotePress}
            onLongPress={onNoteLongPress}
          />
        ))}
      </View>
      <View className="flex-1 gap-3">
        {rightColumn.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            labelColors={labelColors}
            effectiveTheme={effectiveTheme}
            selectionMode={mode === 'selection' || mode === 'organize'}
            selected={selectedIds.has(note.id)}
            onPress={onNotePress}
            onLongPress={onNoteLongPress}
          />
        ))}
      </View>
    </View>
  );
}
