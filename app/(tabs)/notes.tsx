import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { NotesList } from '@/components/notes/notes-list';
import { NotesMosaicGrid } from '@/components/notes/notes-mosaic-grid';
import { NotesOrganizeList } from '@/components/notes/notes-organize-list';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  NOTE_SORT_OPTIONS,
  getNoteSortLabel,
  normalizeNoteSortMode,
  type NoteSortMode,
} from '@/constants/note-sort';
import { NOTE_THEME_OPTIONS, getNoteTheme, type NoteThemeId } from '@/constants/note-themes';
import { getLabelColor, getLabelForegroundColor } from '@/lib/label-colors';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { NotePdfService } from '@/services/notes/note-pdf.service';
import { VaultService } from '@/services/security/vault.service';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import type { Note } from '@/types/db';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Check,
  GripVertical,
  LayoutGrid,
  ListFilter,
  Palette,
  Pin,
  PinOff,
  Plus,
  Printer,
  Rows3,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { BackHandler, Linking, RefreshControl, View } from 'react-native';

type NotesMode = 'normal' | 'selection' | 'organize';
type NotesViewMode = 'mosaic' | 'list';
type ThemeTarget = { type: 'single'; note: Note } | { type: 'selection' };

function collectLabels(notes: Note[], savedLabels: string[]) {
  return Array.from(new Set([...notes.flatMap((note) => note.tags), ...savedLabels])).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function NotesScreen() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const [password, setPassword] = React.useState('');
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [query, setQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [sortMode, setSortMode] = React.useState<NoteSortMode>('updated_desc');
  const [viewMode, setViewMode] = React.useState<NotesViewMode>('mosaic');
  const notesRef = React.useRef<Note[]>([]);

  const [mode, setMode] = React.useState<NotesMode>('normal');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [confirmDeleteSelection, setConfirmDeleteSelection] = React.useState(false);
  const [themeTarget, setThemeTarget] = React.useState<ThemeTarget | null>(null);
  const [sortSheetOpen, setSortSheetOpen] = React.useState(false);
  const [labelSheetOpen, setLabelSheetOpen] = React.useState(false);
  const [bulkLabelDraft, setBulkLabelDraft] = React.useState('');
  const [availableLabels, setAvailableLabels] = React.useState<string[]>([]);
  const [labelColors, setLabelColors] = React.useState<Record<string, string>>({});
  const [printingNoteId, setPrintingNoteId] = React.useState<string | null>(null);
  const [movingNoteId, setMovingNoteId] = React.useState<string | null>(null);
  const selectedNotes = React.useMemo(
    () => notes.filter((note) => selectedIds.has(note.id)),
    [notes, selectedIds]
  );
  const selectedNoteIds = React.useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.size;
  const pinnedNotes = React.useMemo(() => notes.filter((note) => note.isFavorite), [notes]);
  const unpinnedNotes = React.useMemo(() => notes.filter((note) => !note.isFavorite), [notes]);

  React.useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const exitSelection = React.useCallback(() => {
    setMode('normal');
    setSelectedIds(new Set());
    setConfirmDeleteSelection(false);
    setLabelSheetOpen(false);
    setBulkLabelDraft('');
  }, []);

  async function load(search = query, nextSortMode = sortMode) {
    if (!unlocked) return;
    const [list, colors, savedLabels, allNotes] = await Promise.all([
      NotesRepository.list(search, nextSortMode),
      SettingsRepository.getLabelColors(),
      SettingsRepository.getLabels(),
      search ? NotesRepository.list(undefined, nextSortMode) : Promise.resolve(null),
    ]);
    setNotes(list);
    setLabelColors(colors);
    setAvailableLabels(collectLabels(allNotes ?? list, savedLabels));
    setInitialLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [unlocked]);

  React.useEffect(() => {
    if (!unlocked) return;
    Promise.all([
      SettingsRepository.get('notes.sortMode'),
      SettingsRepository.get('notes.viewMode'),
    ]).then(([storedSortMode, storedViewMode]) => {
      const nextSortMode = normalizeNoteSortMode(storedSortMode);
      setViewMode(storedViewMode === 'list' ? 'list' : 'mosaic');
      setSortMode(nextSortMode);
      void load(query, nextSortMode);
    });
  }, [unlocked]);

  useFocusEffect(
    React.useCallback(() => {
      void load(query, sortMode);
    }, [unlocked, query, sortMode])
  );

  useFocusEffect(
    React.useCallback(() => {
      if (mode !== 'selection') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        exitSelection();
        return true;
      });
      return () => subscription.remove();
    }, [exitSelection, mode])
  );

  async function unlock() {
    const result = await VaultService.unlockWithPassword(password);
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock.'));
  }

  async function unlockBio() {
    const result = await VaultService.unlockWithBiometrics();
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock with biometrics.'));
  }

  function openNote(note: Note) {
    router.push({
      pathname: '/notes/editor' as never,
      params: { id: note.id } as never,
    });
  }

  function enterSelection(note: Note) {
    setMode('selection');
    setSelectedIds(new Set([note.id]));
  }

  async function setSortModePreference(nextSortMode: NoteSortMode) {
    setSortMode(nextSortMode);
    setSortSheetOpen(false);
    await SettingsRepository.set('notes.sortMode', nextSortMode);
    await load(query, nextSortMode);
  }

  async function enterOrganizeMode() {
    setMode('organize');
    setSelectedIds(new Set());
    setQuery('');
    if (sortMode !== 'manual') {
      setSortMode('manual');
      await SettingsRepository.set('notes.sortMode', 'manual');
    }
    await load('', 'manual');
  }

  function exitOrganizeMode() {
    setMode('normal');
    setMovingNoteId(null);
  }

  async function setViewModePreference(nextViewMode: NotesViewMode) {
    setViewMode(nextViewMode);
    await SettingsRepository.set('notes.viewMode', nextViewMode);
  }

  async function moveNoteToIndex(noteId: string, targetIndex: number) {
    const previousNotes = notesRef.current;
    const index = previousNotes.findIndex((note) => note.id === noteId);
    if (index < 0 || targetIndex < 0 || targetIndex >= previousNotes.length || targetIndex === index) {
      return;
    }

    const nextNotes = [...previousNotes];
    const [movedNote] = nextNotes.splice(index, 1);
    if (!movedNote) return;
    nextNotes.splice(targetIndex, 0, movedNote);

    setMovingNoteId(noteId);
    setNotes(nextNotes);
    try {
      await NotesRepository.reorder(nextNotes.map((note) => note.id));
    } catch (error) {
      setNotes(previousNotes);
      showSheetAlert(
        'Reorder failed',
        error instanceof Error ? error.message : 'Unable to save manual order.'
      );
    } finally {
      setMovingNoteId(null);
    }
  }

  function toggleSelection(note: Note) {
    const next = new Set(selectedIds);
    if (next.has(note.id)) {
      next.delete(note.id);
    } else {
      next.add(note.id);
    }
    setSelectedIds(next);
    if (!next.size) setMode('normal');
  }

  function handleNotePress(note: Note) {
    if (mode === 'selection') {
      toggleSelection(note);
      return;
    }
    openNote(note);
  }

  function handleNoteLongPress(note: Note) {
    if (mode === 'normal') {
      enterSelection(note);
      return;
    }
    toggleSelection(note);
  }

  async function togglePin(note: Note) {
    await NotesRepository.update(note.id, { isFavorite: !note.isFavorite });
    await load(query);
  }

  async function setTheme(themeId: NoteThemeId) {
    const target = themeTarget;
    if (!target) return;

    if (target.type === 'single') {
      await NotesRepository.update(target.note.id, { themeId });
    } else {
      await NotesRepository.updateMany(selectedNoteIds, { themeId });
      exitSelection();
    }

    setThemeTarget(null);
    await load(query);
  }

  async function setSelectedFavorite(isFavorite: boolean) {
    if (!selectedNoteIds.length) return;
    await NotesRepository.updateMany(selectedNoteIds, { isFavorite });
    exitSelection();
    await load(query);
  }

  async function deleteSelectedNotes() {
    if (!selectedNoteIds.length) return;
    await NotesRepository.softDeleteMany(selectedNoteIds);
    exitSelection();
    await load(query);
  }

  async function applyBulkLabel(label: string) {
    const normalized = label.trim();
    if (!normalized || !selectedNoteIds.length) return;

    await SettingsRepository.addLabel(normalized);
    await NotesRepository.applyLabels(selectedNoteIds, [normalized]);
    exitSelection();
    await load(query);
  }

  async function printNote(note: Note) {
    setPrintingNoteId(note.id);
    try {
      const { uri } = await NotePdfService.export(note);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Print ${note.title || 'Untitled Note'}`,
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
        return;
      }

      const canOpen = await Linking.canOpenURL(uri);
      if (!canOpen) throw new Error('No app is available to open this PDF.');
      await Linking.openURL(uri);
    } catch (error) {
      showSheetAlert(
        'Print failed',
        error instanceof Error ? error.message : 'Unable to export note.'
      );
    } finally {
      setPrintingNoteId(null);
    }
  }

  async function printSelectedNote() {
    const note = selectedNotes[0];
    if (!note) return;
    await printNote(note);
    exitSelection();
  }

  if (!unlocked) {
    return (
      <Screen>
        <Card className="items-center gap-4 py-8">
          <Arky pose="secure" size={160} />
          <Text variant="h2">Vault Locked</Text>
          <Text variant="muted" className="px-4 text-center">
            Secure notes and personal documents are inaccessible until the vault is unlocked.
          </Text>
          <View className="mt-4 w-full gap-3">
            <Input
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Vault passphrase"
            />
            <Button onPress={unlock} className="h-12">
              <Text>Unlock with password</Text>
            </Button>
            <Button variant="outline" onPress={unlockBio} className="h-12">
              <Text>Unlock with biometrics</Text>
            </Button>
            {unlockError ? (
              <Text className="text-destructive text-center">{unlockError}</Text>
            ) : null}
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }>
        {mode === 'selection' ? (
          <View className="border-border bg-card gap-2 rounded-lg border p-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="large">
                {selectedCount === 1 ? '1 selected' : `${selectedCount} selected`}
              </Text>
              <Button size="icon" variant="ghost" className="h-9 w-9" onPress={exitSelection}>
                <Icon as={X} className="size-5" />
              </Button>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCount}
                onPress={() => void setSelectedFavorite(true)}>
                <Icon as={Pin} className="size-4" />
                <Text>Pin</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCount}
                onPress={() => void setSelectedFavorite(false)}>
                <Icon as={PinOff} className="size-4" />
                <Text>Unpin</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCount}
                onPress={() => setLabelSheetOpen(true)}>
                <Icon as={Tag} className="size-4" />
                <Text>Labels</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCount}
                onPress={() => setThemeTarget({ type: 'selection' })}>
                <Icon as={Palette} className="size-4" />
                <Text>Theme</Text>
              </Button>
              {selectedCount === 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={printingNoteId === selectedNotes[0]?.id}
                  onPress={() => void printSelectedNote()}>
                  <Icon as={Printer} className="size-4" />
                  <Text>{printingNoteId === selectedNotes[0]?.id ? 'Preparing' : 'Print'}</Text>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCount}
                onPress={() => setConfirmDeleteSelection(true)}>
                <Icon as={Trash2} className="text-destructive size-4" />
                <Text className="text-destructive">Delete</Text>
              </Button>
            </View>
          </View>
        ) : mode === 'organize' ? (
          <View className="border-border bg-card flex-row items-center justify-between gap-2 rounded-lg border p-2">
            <View className="min-w-0 flex-1">
              <Text variant="large">Manual order</Text>
              <Text variant="muted">Sort: {getNoteSortLabel(sortMode)}</Text>
            </View>
            <Button variant="outline" size="sm" onPress={exitOrganizeMode}>
              <Text>Done</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-2">
            <Input
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                void load(value, sortMode);
              }}
              placeholder="Search notes"
            />
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" variant="outline" onPress={() => setSortSheetOpen(true)}>
                <Icon as={ListFilter} className="size-4" />
                <Text>{getNoteSortLabel(sortMode)}</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() =>
                  void setViewModePreference(viewMode === 'mosaic' ? 'list' : 'mosaic')
                }>
                <Icon as={viewMode === 'mosaic' ? Rows3 : LayoutGrid} className="size-4" />
                <Text>{viewMode === 'mosaic' ? 'List' : 'Mosaic'}</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => void enterOrganizeMode()}>
                <Icon as={GripVertical} className="size-4" />
                <Text>Organize</Text>
              </Button>
            </View>
          </View>
        )}

        {initialLoading ? (
          <View className="gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </View>
        ) : notes.length === 0 ? (
          <Card className="items-center gap-3 py-8">
            <Arky pose="scholar" size={120} />
            <Text variant="large">No notes yet</Text>
            <Text variant="muted" className="text-center">
              Create your first secure note.
            </Text>
          </Card>
        ) : mode === 'organize' ? (
          <NotesOrganizeList
            notes={notes}
            effectiveTheme={effectiveTheme}
            movingNoteId={movingNoteId}
            onMoveToIndex={(noteId, targetIndex) => void moveNoteToIndex(noteId, targetIndex)}
          />
        ) : mode === 'normal' && pinnedNotes.length ? (
          <View className="gap-5">
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Pin} className="text-primary size-4" />
                <Text variant="large">Pinned</Text>
              </View>
              {viewMode === 'list' ? (
                <NotesList
                  notes={pinnedNotes}
                  labelColors={labelColors}
                  effectiveTheme={effectiveTheme}
                  mode={mode}
                  selectedIds={selectedIds}
                  onNotePress={handleNotePress}
                  onNoteLongPress={handleNoteLongPress}
                  onNotePinPress={(note) => void togglePin(note)}
                />
              ) : (
                <NotesMosaicGrid
                  notes={pinnedNotes}
                  labelColors={labelColors}
                  effectiveTheme={effectiveTheme}
                  mode={mode}
                  selectedIds={selectedIds}
                  onNotePress={handleNotePress}
                  onNoteLongPress={handleNoteLongPress}
                  onNotePinPress={(note) => void togglePin(note)}
                />
              )}
            </View>
            {unpinnedNotes.length ? (
              viewMode === 'list' ? (
                <NotesList
                  notes={unpinnedNotes}
                  labelColors={labelColors}
                  effectiveTheme={effectiveTheme}
                  mode={mode}
                  selectedIds={selectedIds}
                  onNotePress={handleNotePress}
                  onNoteLongPress={handleNoteLongPress}
                  onNotePinPress={(note) => void togglePin(note)}
                />
              ) : (
                <NotesMosaicGrid
                  notes={unpinnedNotes}
                  labelColors={labelColors}
                  effectiveTheme={effectiveTheme}
                  mode={mode}
                  selectedIds={selectedIds}
                  onNotePress={handleNotePress}
                  onNoteLongPress={handleNoteLongPress}
                  onNotePinPress={(note) => void togglePin(note)}
                />
              )
            ) : null}
          </View>
        ) : viewMode === 'list' ? (
          <NotesList
            notes={notes}
            labelColors={labelColors}
            effectiveTheme={effectiveTheme}
            mode={mode}
            selectedIds={selectedIds}
            onNotePress={handleNotePress}
            onNoteLongPress={handleNoteLongPress}
            onNotePinPress={(note) => void togglePin(note)}
          />
        ) : (
          <NotesMosaicGrid
            notes={notes}
            labelColors={labelColors}
            effectiveTheme={effectiveTheme}
            mode={mode}
            selectedIds={selectedIds}
            onNotePress={handleNotePress}
            onNoteLongPress={handleNoteLongPress}
            onNotePinPress={(note) => void togglePin(note)}
          />
        )}
      </Screen>

      {mode === 'normal' ? (
        <Button
          size="icon"
          className="absolute right-6 bottom-6 h-14 w-14 rounded-full"
          onPress={() => router.push('/notes/editor' as never)}>
          <Icon as={Plus} className="size-6" />
        </Button>
      ) : null}

      <ArkBottomSheet visible={!!themeTarget} onDismiss={() => setThemeTarget(null)}>
        <View className="gap-1">
          {NOTE_THEME_OPTIONS.map((option) => {
            const optionTheme = getNoteTheme(option.id, effectiveTheme);
            const selected =
              themeTarget?.type === 'single'
                ? themeTarget.note.themeId === option.id
                : selectedNotes.length > 0 &&
                  selectedNotes.every((note) => note.themeId === option.id);
            return (
              <Button
                key={option.id}
                variant="ghost"
                className="h-11 justify-start px-2"
                onPress={() => {
                  void setTheme(option.id);
                }}>
                <View
                  className="h-5 w-5 rounded-full border"
                  style={{
                    backgroundColor: optionTheme.background,
                    borderColor: optionTheme.border,
                  }}
                />
                <Text>{option.label}</Text>
                {selected ? <Icon as={Check} className="text-primary ml-auto size-4" /> : null}
              </Button>
            );
          })}
        </View>
      </ArkBottomSheet>

      <ArkBottomSheet visible={sortSheetOpen} onDismiss={() => setSortSheetOpen(false)}>
        <View className="gap-1">
          {NOTE_SORT_OPTIONS.map((option) => {
            const selected = sortMode === option.value;
            return (
              <Button
                key={option.value}
                variant="ghost"
                className="h-11 justify-start px-2"
                onPress={() => {
                  void setSortModePreference(option.value);
                }}>
                <Icon
                  as={option.value === 'manual' ? GripVertical : ListFilter}
                  className="size-4"
                />
                <Text>{option.label}</Text>
                {selected ? <Icon as={Check} className="text-primary ml-auto size-4" /> : null}
              </Button>
            );
          })}
        </View>
      </ArkBottomSheet>

      <ArkBottomSheet
        visible={labelSheetOpen}
        title="Labels"
        description={
          selectedCount === 1
            ? 'Add a label to the selected note.'
            : `Add a label to ${selectedCount} selected notes.`
        }
        onDismiss={() => setLabelSheetOpen(false)}>
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Input
              value={bulkLabelDraft}
              onChangeText={setBulkLabelDraft}
              onSubmitEditing={() => void applyBulkLabel(bulkLabelDraft)}
              placeholder="New label"
              returnKeyType="done"
              className="flex-1"
            />
            <Button
              size="icon"
              variant="outline"
              disabled={!bulkLabelDraft.trim()}
              onPress={() => void applyBulkLabel(bulkLabelDraft)}>
              <Icon as={Plus} className="size-5" />
            </Button>
          </View>

          {availableLabels.length ? (
            <View className="gap-1">
              {availableLabels.map((label) => {
                const labelColor = getLabelColor(label, labelColors);
                const labelForeground = getLabelForegroundColor(labelColor);
                const appliedToAll =
                  selectedNotes.length > 0 &&
                  selectedNotes.every((note) => note.tags.includes(label));
                return (
                  <Button
                    key={label}
                    variant="ghost"
                    className="h-11 justify-start px-2"
                    onPress={() => void applyBulkLabel(label)}>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: labelColor }}>
                      <Text className="text-xs font-medium" style={{ color: labelForeground }}>
                        {label}
                      </Text>
                    </View>
                    {appliedToAll ? (
                      <Icon as={Check} className="text-primary ml-auto size-4" />
                    ) : null}
                  </Button>
                );
              })}
            </View>
          ) : (
            <Text variant="muted">No saved labels yet.</Text>
          )}
        </View>
      </ArkBottomSheet>

      <ConfirmModal
        visible={confirmDeleteSelection}
        title="Delete selected notes?"
        description="This removes the selected notes from active use and keeps them out of vault views."
        confirmVariant="destructive"
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteSelection(false)}
        onConfirm={() => {
          void deleteSelectedNotes();
        }}
      />
    </View>
  );
}
