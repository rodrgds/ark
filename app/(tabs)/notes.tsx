import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { RagService } from '@/services/ai/rag.service';
import { NotesRepository } from '@/services/db/repositories/notes.repo';
import { VaultService } from '@/services/security/vault.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Note } from '@/types/db';
import { format } from 'date-fns';
import {
  Bold,
  Eye,
  FileText,
  Heading1,
  Italic,
  List,
  PenLine,
  Search,
  Star,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';
import { RefreshControl } from 'react-native';

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatTimestamp(value: number) {
  return format(new Date(value), 'MMM d, yyyy HH:mm');
}

function MarkdownPreview({ body }: { body: string }) {
  const lines = body.split('\n');
  if (!body.trim()) return <Text variant="muted">Nothing to preview yet.</Text>;
  return (
    <View className="gap-2">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        if (!line.trim()) return <View key={key} className="h-2" />;
        if (line.startsWith('# ')) {
          return (
            <Text key={key} variant="h3">
              {line.replace(/^#\s+/, '')}
            </Text>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <View key={key} className="flex-row gap-2">
              <Text>-</Text>
              <Text className="flex-1">{line.replace(/^-\s+/, '')}</Text>
            </View>
          );
        }
        return (
          <Text key={key} className="leading-6">
            {line}
          </Text>
        );
      })}
    </View>
  );
}

export default function NotesScreen() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [password, setPassword] = React.useState('');
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [query, setQuery] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');
  const [preview, setPreview] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const charCount = body.length;
  const editingNote = notes.find((note) => note.id === editingId) ?? null;

  async function load(search = query) {
    if (!unlocked) return;
    setNotes(await NotesRepository.list(search));
    setInitialLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [unlocked]);

  async function unlock() {
    const result = await VaultService.unlockWithPassword(password);
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock.'));
  }

  async function unlockBio() {
    const result = await VaultService.unlockWithBiometrics();
    setUnlockError(result.ok ? null : (result.reason ?? 'Unable to unlock with biometrics.'));
  }

  function resetEditor() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setTagsText('');
    setPreview(false);
  }

  function editNote(note: Note) {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setTagsText(note.tags.join(', '));
    setPreview(false);
  }

  async function saveNote() {
    if (!title.trim() && !body.trim()) return;
    const tags = parseTags(tagsText);
    const saved = editingId
      ? await NotesRepository.update(editingId, { title, body, tags })
      : await NotesRepository.create({ title, body, tags });
    if (saved) await RagService.indexNote(saved.id);
    resetEditor();
    await load('');
  }

  function insertMarkdown(prefix: string, suffix = '') {
    const insertion = body ? `\n${prefix}${suffix}` : `${prefix}${suffix}`;
    setBody((current) => `${current}${insertion}`);
  }

  function confirmDelete(note: Note) {
    Alert.alert('Delete note?', `"${note.title}" will be removed from local search.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await NotesRepository.softDelete(note.id);
          if (editingId === note.id) resetEditor();
          await load();
        },
      },
    ]);
  }

  if (!unlocked) {
    return (
      <Screen>
        <Card className="items-center gap-4 py-8">
          <Arky pose="secure" size={160} />
          <Text variant="h2">Vault Locked</Text>
          <Text variant="muted" className="text-center px-4">
            Secure notes and personal documents are inaccessible until the vault is unlocked.
          </Text>
          <View className="w-full gap-3 mt-4">
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
      <View className="gap-2">
        <Text variant="h1">Notes</Text>
        <Text variant="muted">Vault-gated field notes indexed for Ark search.</Text>
      </View>

      <Card className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="large">{editingId ? 'Edit note' : 'New secure note'}</Text>
            {editingNote ? (
              <Text variant="muted">
                Updated {formatTimestamp(editingNote.updatedAt)} - Created{' '}
                {formatTimestamp(editingNote.createdAt)}
              </Text>
            ) : null}
          </View>
          {editingId ? (
            <Button size="sm" variant="ghost" onPress={resetEditor}>
              <Text>Cancel</Text>
            </Button>
          ) : null}
        </View>

        <Input value={title} onChangeText={setTitle} placeholder="Title" />

        <View className="flex-row flex-wrap gap-2">
          <Button size="icon" variant="outline" onPress={() => insertMarkdown('# ')}>
            <Icon as={Heading1} className="size-4" />
          </Button>
          <Button size="icon" variant="outline" onPress={() => insertMarkdown('**bold**')}>
            <Icon as={Bold} className="size-4" />
          </Button>
          <Button size="icon" variant="outline" onPress={() => insertMarkdown('*italic*')}>
            <Icon as={Italic} className="size-4" />
          </Button>
          <Button size="icon" variant="outline" onPress={() => insertMarkdown('- ')}>
            <Icon as={List} className="size-4" />
          </Button>
          <Button
            className="ml-auto"
            size="sm"
            variant={preview ? 'default' : 'outline'}
            onPress={() => setPreview((value) => !value)}>
            <Icon as={Eye} className="size-4" />
            <Text>{preview ? 'Preview' : 'Edit'}</Text>
          </Button>
        </View>

        {preview ? (
          <Card className="bg-background min-h-56 gap-2">
            <MarkdownPreview body={body} />
          </Card>
        ) : (
          <Input
            className="min-h-56 items-start py-3"
            value={body}
            onChangeText={setBody}
            placeholder="Body"
            multiline
            textAlignVertical="top"
          />
        )}

        <Input value={tagsText} onChangeText={setTagsText} placeholder="Tags, comma separated" />
        <View className="flex-row justify-between gap-3">
          <Text variant="muted">
            {wordCount} words - {charCount} chars
          </Text>
          <Button onPress={saveNote} disabled={!title.trim() && !body.trim()}>
            <Icon as={PenLine} className="size-4" />
            <Text>{editingId ? 'Save' : 'Create'}</Text>
          </Button>
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon as={Search} className="text-primary size-5" />
          <Text variant="large">Search</Text>
        </View>
        <Input
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            void load(value);
          }}
          placeholder="Search notes with FTS"
        />
      </Card>

      {initialLoading ? (
        <View className="gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </View>
      ) : notes.length === 0 ? (
        <Card className="items-center gap-3 py-8">
          <Arky pose="scholar" size={120} />
          <Text variant="large">{query ? 'No matching notes' : 'No notes yet'}</Text>
          <Text variant="muted" className="text-center">
            {query ? 'Try a different search term.' : 'Create a secure note to seed local RAG.'}
          </Text>
        </Card>
      ) : (
        notes.map((note) => (
          <Card key={note.id} className="gap-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">{note.title}</Text>
                <Text variant="muted">
                  Updated {formatTimestamp(note.updatedAt)}
                  {note.tags.length ? ` - ${note.tags.join(', ')}` : ''}
                </Text>
              </View>
              <Button
                size="icon"
                variant={note.isFavorite ? 'default' : 'outline'}
                onPress={async () => {
                  await NotesRepository.update(note.id, { isFavorite: !note.isFavorite });
                  await load();
                }}>
                <Icon as={Star} className="size-4" />
              </Button>
            </View>
            <Text selectable numberOfLines={5}>
              {note.body}
            </Text>
            <View className="flex-row gap-2">
              <Button className="flex-1" size="sm" variant="outline" onPress={() => editNote(note)}>
                <Icon as={PenLine} className="size-4" />
                <Text>Edit</Text>
              </Button>
              <Button size="icon" variant="destructive" onPress={() => confirmDelete(note)}>
                <Icon as={Trash2} className="size-4" />
              </Button>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
