import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { getLabelColor, getLabelForegroundColor } from '@/lib/label-colors';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { NotePdfService } from '@/services/notes/note-pdf.service';
import { VaultService } from '@/services/security/vault.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Note } from '@/types/db';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Plus, Printer, Star, Tag, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Linking, Pressable, RefreshControl, View } from 'react-native';

export default function NotesScreen() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [password, setPassword] = React.useState('');
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [query, setQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);

  const [actionNote, setActionNote] = React.useState<Note | null>(null);
  const [confirmDeleteNote, setConfirmDeleteNote] = React.useState<Note | null>(null);
  const [labelColors, setLabelColors] = React.useState<Record<string, string>>({});
  const [printingNoteId, setPrintingNoteId] = React.useState<string | null>(null);
  const leftColumn = notes.filter((_, index) => index % 2 === 0);
  const rightColumn = notes.filter((_, index) => index % 2 === 1);

  async function load(search = query) {
    if (!unlocked) return;
    const [list, colors] = await Promise.all([
      NotesRepository.list(search),
      SettingsRepository.getLabelColors(),
    ]);
    list.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    setNotes(list);
    setLabelColors(colors);
    setInitialLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [unlocked]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [unlocked, query])
  );

  async function unlock() {
    const result = await VaultService.unlockWithPassword(password);
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock.'));
  }

  async function unlockBio() {
    const result = await VaultService.unlockWithBiometrics();
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock with biometrics.'));
  }

  async function toggleStar(note: Note) {
    await NotesRepository.update(note.id, { isFavorite: !note.isFavorite });
    setActionNote(null);
    await load(query);
  }

  async function deleteNote(note: Note) {
    await NotesRepository.softDelete(note.id);
    setActionNote(null);
    setConfirmDeleteNote(null);
    await load(query);
  }

  async function printNote(note: Note) {
    setPrintingNoteId(note.id);
    try {
      const { uri } = await NotePdfService.export(note);
      setActionNote(null);
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
        <Input
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            void load(value);
          }}
          placeholder="Search notes"
        />

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
        ) : (
          <View className="flex-row items-start gap-3">
            <View className="flex-1 gap-3">
              {leftColumn.map((note) => (
                <Pressable
                  key={note.id}
                  onPress={() =>
                    router.push({
                      pathname: '/notes/editor' as never,
                      params: { id: note.id } as never,
                    })
                  }
                  onLongPress={() => setActionNote(note)}
                  delayLongPress={220}>
                  <Card className="gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text variant="large" className="min-w-0 flex-1">
                        {note.title}
                      </Text>
                      {note.isFavorite ? (
                        <Icon as={Star} className="text-muted-foreground size-3.5" />
                      ) : null}
                    </View>
                    <Text numberOfLines={3} variant="muted">
                      {note.body || 'No content'}
                    </Text>
                    {note.tags.length ? (
                      <View className="mt-1 flex-row flex-wrap gap-1.5">
                        {note.tags.map((label) => (
                          <View
                            key={`${note.id}-${label}`}
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: getLabelColor(label, labelColors) }}>
                            <Text
                              className="text-xs"
                              style={{
                                color: getLabelForegroundColor(getLabelColor(label, labelColors)),
                              }}>
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              ))}
            </View>
            <View className="flex-1 gap-3">
              {rightColumn.map((note) => (
                <Pressable
                  key={note.id}
                  onPress={() =>
                    router.push({
                      pathname: '/notes/editor' as never,
                      params: { id: note.id } as never,
                    })
                  }
                  onLongPress={() => setActionNote(note)}
                  delayLongPress={220}>
                  <Card className="gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text variant="large" className="min-w-0 flex-1">
                        {note.title}
                      </Text>
                      {note.isFavorite ? (
                        <Icon as={Star} className="text-muted-foreground size-3.5" />
                      ) : null}
                    </View>
                    <Text numberOfLines={3} variant="muted">
                      {note.body || 'No content'}
                    </Text>
                    {note.tags.length ? (
                      <View className="mt-1 flex-row flex-wrap gap-1.5">
                        {note.tags.map((label) => (
                          <View
                            key={`${note.id}-${label}`}
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: getLabelColor(label, labelColors) }}>
                            <Text
                              className="text-xs"
                              style={{
                                color: getLabelForegroundColor(getLabelColor(label, labelColors)),
                              }}>
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Screen>

      <Button
        size="icon"
        className="absolute right-6 bottom-6 h-14 w-14 rounded-full"
        onPress={() => router.push('/notes/editor' as never)}>
        <Icon as={Plus} className="size-6" />
      </Button>

      <ArkBottomSheet visible={!!actionNote} onDismiss={() => setActionNote(null)}>
        <Button
          variant="ghost"
          className="h-10 justify-start px-2"
          disabled={!actionNote || printingNoteId === actionNote?.id}
          onPress={() => {
            if (actionNote) void printNote(actionNote);
          }}>
          <Icon as={Printer} className="size-4" />
          <Text>{printingNoteId === actionNote?.id ? 'Preparing PDF...' : 'Print'}</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-10 justify-start px-2"
          onPress={() => {
            if (actionNote) void toggleStar(actionNote);
          }}>
          <Icon as={Star} className="size-4" />
          <Text>{actionNote?.isFavorite ? 'Unstar' : 'Star'}</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-10 justify-start px-2"
          onPress={() => {
            if (!actionNote) return;
            setActionNote(null);
            router.push({
              pathname: '/notes/labels' as never,
              params: { noteId: actionNote.id } as never,
            });
          }}>
          <Icon as={Tag} className="size-4" />
          <Text>Labels</Text>
        </Button>
        <Button
          variant="ghost"
          className="h-10 justify-start px-2"
          onPress={() => {
            if (!actionNote) return;
            setConfirmDeleteNote(actionNote);
            setActionNote(null);
          }}>
          <Icon as={Trash2} className="text-destructive size-4" />
          <Text className="text-destructive">Delete</Text>
        </Button>
      </ArkBottomSheet>

      <ConfirmModal
        visible={!!confirmDeleteNote}
        title="Delete note?"
        description="This removes the note from active use and keeps it out of your vault views."
        confirmVariant="destructive"
        onCancel={() => setConfirmDeleteNote(null)}
        onConfirm={() => {
          if (confirmDeleteNote) void deleteNote(confirmDeleteNote);
        }}
      />
    </View>
  );
}
