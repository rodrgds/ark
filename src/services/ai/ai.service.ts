import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { HapticsService } from '@/services/device/haptics.service';
import { RagService } from '@/services/ai/rag.service';
import { LlamaAdapter } from '@/services/ai/llama-adapter';
import { MockAIAdapter } from '@/services/ai/mock-ai-adapter';
import { chatMessageSchema, parseOrThrow } from '@/lib/validation';
import type { AiMessage, AiSendMessageInput, AiSendMessageOptions } from '@/types/ai';

const mockAdapter = new MockAIAdapter();
const llamaAdapter = new LlamaAdapter();

export class AIService {
  static async listMessages(threadId: string) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{
      id: string;
      thread_id: string;
      role: AiMessage['role'];
      content: string;
      citations_json: string | null;
      created_at: number;
    }>('SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC', [threadId]);
    return rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      role: row.role,
      content: row.content,
      citations: row.citations_json ? JSON.parse(row.citations_json) : [],
      createdAt: row.created_at,
    }));
  }

  static async ensureThread(threadId?: string, title = 'Offline chat') {
    if (threadId) return threadId;
    const db = await DatabaseClient.getDb();
    const id = randomUUID();
    const timestamp = Date.now();
    await db.runAsync(
      'INSERT INTO chat_threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, title, timestamp, timestamp]
    );
    return id;
  }

  static async getLatestThread() {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM chat_threads ORDER BY updated_at DESC LIMIT 1'
    );
    return row?.id ?? null;
  }

  static async clearThread(threadId: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM chat_messages WHERE thread_id = ?', [threadId]);
      await db.runAsync('DELETE FROM chat_threads WHERE id = ?', [threadId]);
    });
  }

  static async sendMessage(input: AiSendMessageInput, options: AiSendMessageOptions = {}) {
    const validated = parseOrThrow(chatMessageSchema, input);
    const db = await DatabaseClient.getDb();
    const threadId = await this.ensureThread(
      validated.threadId,
      validated.content.slice(0, 42) || 'Offline chat'
    );
    const timestamp = Date.now();
    const userMessage: AiMessage = {
      id: randomUUID(),
      threadId,
      role: 'user',
      content: validated.content,
      citations: [],
      createdAt: timestamp,
    };
    const citations = validated.useRag
      ? await RagService.search(validated.content, { limit: 4 })
      : [];
    const adapter = (await llamaAdapter.isAvailable()) ? llamaAdapter : mockAdapter;
    const response = await adapter.sendMessage({
      content: validated.content,
      citations,
      onToken: options.onToken,
    });
    const assistantMessage: AiMessage = {
      id: randomUUID(),
      threadId,
      role: 'assistant',
      content: response.content,
      citations: response.citations,
      createdAt: Date.now(),
    };

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO chat_messages (id, thread_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          userMessage.id,
          threadId,
          userMessage.role,
          userMessage.content,
          null,
          userMessage.createdAt,
        ]
      );
      await db.runAsync(
        'INSERT INTO chat_messages (id, thread_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          assistantMessage.id,
          threadId,
          assistantMessage.role,
          assistantMessage.content,
          JSON.stringify(assistantMessage.citations),
          assistantMessage.createdAt,
        ]
      );
      await db.runAsync('UPDATE chat_threads SET updated_at = ? WHERE id = ?', [
        assistantMessage.createdAt,
        threadId,
      ]);
    });

    void HapticsService.selection();
    return { threadId, messages: [userMessage, assistantMessage] };
  }

  static async cancelActiveResponse() {
    await llamaAdapter.cancelActiveCompletion();
  }
}
