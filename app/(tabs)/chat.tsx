import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { SAFETY_COPY } from '@/constants/app';
import { AIService } from '@/services/ai/ai.service';
import type { AiMessage } from '@/types/ai';
import * as React from 'react';
import { View } from 'react-native';

export default function ChatScreen() {
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [content, setContent] = React.useState('');
  const [useRag, setUseRag] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    AIService.getLatestThread().then(async (id) => {
      if (!id) return;
      setThreadId(id);
      setMessages(await AIService.listMessages(id));
    });
  }, []);

  async function send() {
    if (!content.trim()) return;
    setSending(true);
    const result = await AIService.sendMessage({ threadId, content, useRag });
    setThreadId(result.threadId);
    setMessages((current) => [...current, ...result.messages]);
    setContent('');
    setSending(false);
  }

  return (
    <Screen>
      <Card className="gap-2">
        <Text variant="large">Ask Ark</Text>
        <Text variant="muted">
          Mock local AI adapter. RAG searches offline FTS sources before answering.
        </Text>
        <Text className="text-destructive text-sm">{SAFETY_COPY.ai}</Text>
      </Card>
      <Button variant={useRag ? 'default' : 'outline'} onPress={() => setUseRag((value) => !value)}>
        <Text>{useRag ? 'RAG enabled' : 'RAG disabled'}</Text>
      </Button>
      {messages.map((message) => (
        <Card key={message.id} className="gap-2">
          <Text className="text-primary text-sm font-semibold">{message.role.toUpperCase()}</Text>
          <Text selectable>{message.content}</Text>
          {message.citations.length ? (
            <View className="gap-1">
              <Text variant="small">Sources</Text>
              {message.citations.map((citation) => (
                <Text key={`${message.id}-${citation.sourceId}`} variant="muted">
                  {citation.title}: {citation.snippet}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ))}
      <Card className="gap-3">
        <Input
          value={content}
          onChangeText={setContent}
          placeholder="Ask an offline question"
          multiline
        />
        <Button onPress={send} disabled={sending}>
          <Text>{sending ? 'Sending...' : 'Send'}</Text>
        </Button>
      </Card>
    </Screen>
  );
}
