import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { RagService } from '@/services/ai/rag.service';
import { VaultService } from '@/services/security/vault.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Note } from '@/types/db';
import * as React from 'react';
import { View } from 'react-native';

export default function NotesScreen() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [password, setPassword] = React.useState('');
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [query, setQuery] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');

  async function load(search = query) {
    if (!unlocked) return;
    setNotes(await NotesRepository.list(search));
  }

  React.useEffect(() => {
    load();
  }, [unlocked]);

  async function unlock() {
    const result = await VaultService.unlockWithPassword(password);
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock.'));
  }

  async function unlockBio() {
    const result = await VaultService.unlockWithBiometrics();
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock with biometrics.'));
  }

  async function createNote() {
    if (!title.trim() && !body.trim()) return;
    const note = await NotesRepository.create({ title, body });
    await RagService.indexNote(note.id);
    setTitle('');
    setBody('');
    await load('');
  }

  if (!unlocked) {
    return (
      <Screen>
        <Card className="gap-3">
          <Text variant="large">Vault locked</Text>
          <Text variant="muted">
            Secure notes and personal documents are inaccessible until the vault is unlocked.
          </Text>
          <Input
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Vault passphrase"
          />
          <Button onPress={unlock}>
            <Text>Unlock with password</Text>
          </Button>
          <Button variant="outline" onPress={unlockBio}>
            <Text>Unlock with biometrics</Text>
          </Button>
          {unlockError ? <Text className="text-destructive">{unlockError}</Text> : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card className="gap-3">
        <Text variant="large">New secure note</Text>
        <Input value={title} onChangeText={setTitle} placeholder="Title" />
        <Input value={body} onChangeText={setBody} placeholder="Body" multiline />
        <Button onPress={createNote}>
          <Text>Create note</Text>
        </Button>
      </Card>
      <Card className="gap-3">
        <Input
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            load(value);
          }}
          placeholder="Search notes with FTS"
        />
      </Card>
      {notes.map((note) => (
        <Card key={note.id} className="gap-2">
          <View className="flex-row items-start justify-between gap-3">
            <Text variant="large" className="flex-1">
              {note.title}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              onPress={async () => {
                await NotesRepository.update(note.id, { isFavorite: !note.isFavorite });
                await load();
              }}>
              <Text>{note.isFavorite ? 'Starred' : 'Star'}</Text>
            </Button>
          </View>
          <Text selectable>{note.body}</Text>
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={async () => {
                const updated = await NotesRepository.update(note.id, {
                  body: `${note.body}\n\nUpdated ${new Date().toLocaleString()}`,
                });
                if (updated) await RagService.indexNote(updated.id);
                await load();
              }}>
              <Text>Quick edit</Text>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onPress={async () => {
                await NotesRepository.softDelete(note.id);
                await load();
              }}>
              <Text>Delete</Text>
            </Button>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
