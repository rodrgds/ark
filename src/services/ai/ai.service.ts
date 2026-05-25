import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { HapticsService } from '@/services/device/haptics.service';
import { AiToolService } from '@/services/ai/ai-tools.service';
import { LlamaAdapter } from '@/services/ai/llama-adapter';
import { MockAIAdapter } from '@/services/ai/mock-ai-adapter';
import { chatMessageSchema, parseOrThrow } from '@/lib/validation';
import type { AiMessage, AiSendMessageInput, AiSendMessageOptions } from '@/types/ai';

const mockAdapter = new MockAIAdapter();
const llamaAdapter = new LlamaAdapter();

class AiRequestCancelledError extends Error {
  constructor() {
    super('AI request cancelled.');
    this.name = 'AiRequestCancelledError';
  }
}

type ActiveAiRequest = {
  id: string;
  cancelled: boolean;
};

let activeRequest: ActiveAiRequest | null = null;

function throwIfCancelled(request: ActiveAiRequest) {
  if (request.cancelled) throw new AiRequestCancelledError();
}

export function isAiRequestCancelledError(error: unknown) {
  return error instanceof AiRequestCancelledError;
}

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
    const request: ActiveAiRequest = { id: randomUUID(), cancelled: false };
    activeRequest = request;
    const validated = parseOrThrow(chatMessageSchema, input);
    try {
      const db = await DatabaseClient.getDb();
      options.onProgress?.({ stage: 'opening_database', label: 'Opening local database' });
      throwIfCancelled(request);
      const threadId = await this.ensureThread(
        validated.threadId,
        validated.content.slice(0, 42) || 'Offline chat'
      );
      throwIfCancelled(request);
      const timestamp = Date.now();
      const userMessage: AiMessage = {
        id: randomUUID(),
        threadId,
        role: 'user',
        content: validated.content,
        citations: [],
        createdAt: timestamp,
      };
      const toolRun = validated.useRag
        ? await AiToolService.runLocalKnowledgeTools(validated.content, options.onProgress)
        : AiToolService.emptyRun();
      throwIfCancelled(request);
      const toolMessage: AiMessage | null = toolRun.toolTrace.length
        ? {
            id: randomUUID(),
            threadId,
            role: 'tool',
            content: toolRun.toolTrace.map((entry) => entry.summary).join('\n'),
            citations: toolRun.citations,
            createdAt: timestamp + 1,
          }
        : null;
      const adapter = (await llamaAdapter.isAvailable()) ? llamaAdapter : mockAdapter;
      options.onProgress?.({
        stage: 'loading_model',
        label: adapter === llamaAdapter ? 'Loading local model' : 'Preparing response',
      });
      throwIfCancelled(request);
      options.onProgress?.({ stage: 'generating_response', label: 'Generating response' });
      const response = await adapter.sendMessage({
        content: validated.content,
        citations: toolRun.citations,
        sourceContext: toolRun.sourceContext,
        toolTrace: toolRun.toolTrace,
        onToken: (token) => {
          if (!request.cancelled) options.onToken?.(token);
        },
      });
      throwIfCancelled(request);
      const assistantMessage: AiMessage = {
        id: randomUUID(),
        threadId,
        role: 'assistant',
        content: response.content,
        citations: response.citations,
        createdAt: Math.max(Date.now(), timestamp + 2),
      };

      await db.withTransactionAsync(async () => {
        throwIfCancelled(request);
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
        if (toolMessage) {
          await db.runAsync(
            'INSERT INTO chat_messages (id, thread_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [
              toolMessage.id,
              threadId,
              toolMessage.role,
              toolMessage.content,
              JSON.stringify(toolMessage.citations),
              toolMessage.createdAt,
            ]
          );
        }
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
      return {
        threadId,
        messages: [userMessage, ...(toolMessage ? [toolMessage] : []), assistantMessage],
      };
    } finally {
      if (activeRequest === request) activeRequest = null;
    }
  }

  static async cancelActiveResponse() {
    if (activeRequest) activeRequest.cancelled = true;
    await llamaAdapter.cancelActiveCompletion();
  }
}
