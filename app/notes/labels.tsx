import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { LABEL_COLOR_OPTIONS, getLabelColor, getLabelForegroundColor } from '@/lib/label-colors';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import type { Note } from '@/types/db';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check, Plus, Tag, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function collectLabels(notes: Note[]) {
  return Array.from(new Set(notes.flatMap((note) => note.tags))).sort((a, b) => a.localeCompare(b));
}

export default function NoteLabelsScreen() {
  const params = useLocalSearchParams<{ noteId?: string }>();
  const noteId = typeof params.noteId === 'string' ? params.noteId : '';
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<Note | null>(null);
  const [allNotes, setAllNotes] = React.useState<Note[]>([]);
  const [labels, setLabels] = React.useState<string[]>([]);
  const [labelColors, setLabelColors] = React.useState<Record<string, string>>({});
  const [selectedLabels, setSelectedLabels] = React.useState<string[]>([]);
  const [newLabel, setNewLabel] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [openColorLabel, setOpenColorLabel] = React.useState<string | null>(null);

  async function load() {
    if (!noteId) {
      setError('Missing note reference.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const [currentNote, notes] = await Promise.all([NotesRepository.get(noteId), NotesRepository.list()]);
    if (!currentNote) {
      setError('Note not found.');
      setLoading(false);
      return;
    }

    setNote(currentNote);
    setAllNotes(notes);
    const savedLabels = await SettingsRepository.getLabels();
    setLabels(Array.from(new Set([...collectLabels(notes), ...savedLabels])).sort((a, b) => a.localeCompare(b)));
    setLabelColors(await SettingsRepository.getLabelColors());
    setSelectedLabels(currentNote.tags);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [noteId]);

  function toggleLabel(label: string) {
    setSelectedLabels((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
  }

  async function addLabel() {
    const label = newLabel.trim();
    if (!label) return;

    await SettingsRepository.addLabel(label);
    setLabels((current) =>
      current.includes(label) ? current : [...current, label].sort((a, b) => a.localeCompare(b))
    );
    setSelectedLabels((current) => (current.includes(label) ? current : [...current, label]));
    void setLabelColor(label, labelColors[label] ?? LABEL_COLOR_OPTIONS[0].value);
    setNewLabel('');
  }

  async function setLabelColor(label: string, color: string) {
    const next = await SettingsRepository.setLabelColor(label, color);
    setLabelColors(next);
  }

  const handleSave = React.useCallback(async () => {
    if (!note) return;
    setSaving(true);
    try {
      await NotesRepository.update(note.id, { tags: selectedLabels });
      router.back();
    } finally {
      setSaving(false);
    }
  }, [note, selectedLabels]);

  async function deleteLabelEverywhere(label: string) {
    const impacted = allNotes.filter((item) => item.tags.includes(label));
    await Promise.all(
      impacted.map((item) =>
        NotesRepository.update(item.id, { tags: item.tags.filter((tag) => tag !== label) })
      )
    );

    setSelectedLabels((current) => current.filter((item) => item !== label));
    setLabels(await SettingsRepository.deleteLabel(label));
    setLabelColors(await SettingsRepository.deleteLabelColor(label));
    setOpenColorLabel((current) => (current === label ? null : current));
    setAllNotes((current) =>
      current.map((item) => ({
        ...item,
        tags: item.tags.filter((tag) => tag !== label),
      }))
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Labels',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={saving || loading || !note} hitSlop={8}>
              <Icon as={Check} className={saving ? 'text-muted-foreground size-6' : 'text-primary size-6'} />
            </Pressable>
          ),
        }}
      />

      <View className="bg-background flex-1" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <View className="px-4 pb-2 pt-3">
          <View className="flex-row items-center gap-2">
            <Input
              value={newLabel}
              onChangeText={setNewLabel}
              onSubmitEditing={addLabel}
              placeholder="Enter label name"
              returnKeyType="done"
              className="flex-1"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add label"
              onPress={addLabel}
              className="bg-primary h-12 w-12 items-center justify-center rounded-xl">
              <Icon as={Plus} className="text-primary-foreground size-6" />
            </Pressable>
          </View>
        </View>

        {error ? (
          <View className="px-4 py-2">
            <Text className="text-destructive">{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View className="px-4 py-3">
            <Text variant="muted">Loading labels...</Text>
          </View>
        ) : (
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            <View className="px-2 py-1">
              {labels.map((label) => {
                const selected = selectedLabels.includes(label);
                const labelColor = getLabelColor(label, labelColors);
                const labelForeground = getLabelForegroundColor(labelColor);
                const open = openColorLabel === label;
                return (
                  <Swipeable
                    key={label}
                    overshootRight={false}
                    renderRightActions={() => (
                      <Pressable
                        className="bg-destructive mx-2 my-1 w-20 items-center justify-center rounded-xl"
                        onPress={() => {
                          void deleteLabelEverywhere(label);
                        }}>
                        <Icon as={Trash2} className="text-white size-5" />
                      </Pressable>
                    )}>
                    <Pressable
                      className="mx-2 my-1 flex-row items-center justify-between rounded-xl px-2 py-3"
                      onPress={() => toggleLabel(label)}>
                      <View className="flex-row items-center gap-3">
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Toggle color palette for ${label}`}
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            setOpenColorLabel((current) => (current === label ? null : label));
                          }}>
                          <Icon as={Tag} className="size-6" style={{ color: labelColor }} />
                        </Pressable>
                        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: labelColor }}>
                          <Text className="text-base font-medium" style={{ color: labelForeground }}>
                            {label}
                          </Text>
                        </View>
                      </View>
                      <View
                        className={
                          selected
                            ? 'bg-primary border-primary h-7 w-7 items-center justify-center rounded-md border'
                            : 'border-muted-foreground h-7 w-7 rounded-md border'
                        }>
                        {selected ? <Icon as={Check} className="text-primary-foreground size-5" /> : null}
                      </View>
                    </Pressable>
                    {open ? (
                      <View className="mx-2 mb-1 flex-row flex-wrap gap-2 px-2 pb-2 pl-11">
                        {LABEL_COLOR_OPTIONS.map((option) => {
                          const active = labelColor === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              accessibilityRole="button"
                              accessibilityLabel={`Set ${label} color to ${option.name}`}
                              onPress={() => {
                                void setLabelColor(label, option.value);
                              }}
                              className={
                                active
                                  ? 'h-7 w-7 rounded-full border-2 border-white'
                                  : 'h-7 w-7 rounded-full border border-border'
                              }
                              style={{ backgroundColor: option.value }}
                            />
                          );
                        })}
                      </View>
                    ) : null}
                  </Swipeable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}
