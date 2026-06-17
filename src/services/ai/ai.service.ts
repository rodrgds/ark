import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { sqliteBoolean } from '@/services/db/sqlite-values';
import { HapticsService } from '@/services/device/haptics.service';
import { AiToolService, type AiToolRun } from '@/services/ai/ai-tools.service';
import { LlamaAdapter } from '@/services/ai/llama-adapter';
import { MockAIAdapter } from '@/services/ai/mock-ai-adapter';
import { chatMessageSchema, parseOrThrow } from '@/lib/validation';
import type {
  AiAdapterResponse,
  AiAttachment,
  AiCitation,
  AiMessageAttachment,
  AiMessage,
  AiSendMessageInput,
  AiSendMessageOptions,
  AiThread,
} from '@/types/ai';
import { PreferencesService } from '@/services/preferences/preferences.service';

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
  threadId: string;
  cancelled: boolean;
};

const activeRequests = new Map<string, ActiveAiRequest>();

function registerRequest(threadId: string): ActiveAiRequest {
  const existing = activeRequests.get(threadId);
  if (existing) existing.cancelled = true;
  const request: ActiveAiRequest = { id: randomUUID(), threadId, cancelled: false };
  activeRequests.set(threadId, request);
  return request;
}

function unregisterRequest(request: ActiveAiRequest) {
  if (activeRequests.get(request.threadId) === request) {
    activeRequests.delete(request.threadId);
  }
}

function throwIfCancelled(request: ActiveAiRequest) {
  if (request.cancelled) throw new AiRequestCancelledError();
}

export function isAiRequestCancelledError(error: unknown) {
  return error instanceof AiRequestCancelledError;
}

export class AIService {
  static async listThreads(): Promise<AiThread[]> {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{
      id: string;
      title: string;
      created_at: number;
      updated_at: number;
      message_count: number;
      last_message: string | null;
      selected_model_id: string | null;
      chat_model_disabled: number | null;
    }>(
      `SELECT t.id,
              t.title,
              t.created_at,
              t.updated_at,
              t.selected_model_id,
              t.chat_model_disabled,
              COUNT(m.id) AS message_count,
              (
                SELECT content FROM chat_messages latest
                WHERE latest.thread_id = t.id
                  AND latest.deleted_at IS NULL
                  AND latest.role IN ('user', 'assistant')
                ORDER BY latest.created_at DESC
                LIMIT 1
              ) AS last_message
       FROM chat_threads t
       LEFT JOIN chat_messages m ON m.thread_id = t.id AND m.deleted_at IS NULL
       GROUP BY t.id
       ORDER BY t.updated_at DESC`
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count,
      lastMessage: row.last_message ?? undefined,
      selectedModelId: row.selected_model_id,
      chatModelDisabled:
        row.chat_model_disabled === null ? null : sqliteBoolean(row.chat_model_disabled),
    }));
  }

  static async getThread(threadId: string): Promise<AiThread | null> {
    return (await this.listThreads()).find((thread) => thread.id === threadId) ?? null;
  }

  static async listMessages(
    threadId: string,
    options: { limit?: number; before?: number } = {}
  ): Promise<AiMessage[]> {
    const db = await DatabaseClient.getDb();
    const params: Array<string | number> = [threadId];
    const beforeClause =
      typeof options.before === 'number'
        ? (() => {
            params.push(options.before);
            return 'AND created_at < ?';
          })()
        : '';
    const limitClause =
      typeof options.limit === 'number'
        ? (() => {
            params.push(options.limit);
            return 'LIMIT ?';
          })()
        : '';
    const rows = await db.getAllAsync<{
      id: string;
      thread_id: string;
      role: AiMessage['role'];
      content: string;
      citations_json: string | null;
      reasoning: string | null;
      metadata_json: string | null;
      created_at: number;
    }>(
      `SELECT id, thread_id, role, content, citations_json, reasoning, metadata_json, created_at
       FROM chat_messages
       WHERE thread_id = ? AND deleted_at IS NULL AND role != 'context_break' ${beforeClause}
       ORDER BY created_at DESC
       ${limitClause}`,
      params
    );
    return rows.reverse().map(rowToMessage);
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

  static async getThreadModelSettings(threadId: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{
      selected_model_id: string | null;
      chat_model_disabled: number | null;
    }>('SELECT selected_model_id, chat_model_disabled FROM chat_threads WHERE id = ?', [threadId]);
    return {
      selectedModelId: row?.selected_model_id ?? null,
      chatModelDisabled:
        row?.chat_model_disabled === null || row?.chat_model_disabled === undefined
          ? null
          : sqliteBoolean(row.chat_model_disabled),
    };
  }

  static async updateThreadModelSettings(
    threadId: string,
    settings: { selectedModelId?: string | null; chatModelDisabled?: boolean | null }
  ) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE chat_threads
       SET selected_model_id = ?,
           chat_model_disabled = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        settings.selectedModelId ?? null,
        typeof settings.chatModelDisabled === 'boolean'
          ? settings.chatModelDisabled
            ? 1
            : 0
          : null,
        Date.now(),
        threadId,
      ]
    );
  }

  static async deleteMessage(messageId: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE chat_messages SET deleted_at = ? WHERE id = ? AND role = ?', [
      Date.now(),
      messageId,
      'user',
    ]);
  }

  static async sendMessage(input: AiSendMessageInput, options: AiSendMessageOptions = {}) {
    const validated = parseOrThrow(chatMessageSchema, input);
    const provisionalThreadId = validated.threadId ?? '__pending__';
    const request = registerRequest(provisionalThreadId);
    try {
      const db = await DatabaseClient.getDb();
      options.onProgress?.({ stage: 'opening_database', label: 'Opening local database' });
      throwIfCancelled(request);
      const threadId = await this.ensureThread(
        validated.threadId,
        validated.content.slice(0, 42) || 'Offline chat'
      );
      if (threadId !== request.threadId) {
        unregisterRequest(request);
        request.threadId = threadId;
        activeRequests.set(threadId, request);
      }
      if ('selectedModelId' in validated || typeof validated.chatModelDisabled === 'boolean') {
        await this.updateThreadModelSettings(threadId, {
          selectedModelId: validated.selectedModelId ?? null,
          chatModelDisabled: validated.chatModelDisabled ?? null,
        });
      }
      const modelSettings = await this.resolveThreadModelSettings(threadId);
      throwIfCancelled(request);
      const history = validated.threadId ? await this.listContextMessages(validated.threadId) : [];
      throwIfCancelled(request);
      const timestamp = await nextThreadTimestamp(db, threadId);
      const userMessage: AiMessage = {
        id: randomUUID(),
        threadId,
        role: 'user',
        content: validated.content,
        citations: [],
        metadata: validated.attachments?.length
          ? { attachments: messageAttachmentsFromInput(validated.attachments) }
          : undefined,
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
            metadata: { actions: toolRun.toolTrace },
            createdAt: timestamp + 1,
          }
        : null;
      const response = modelSettings.chatModelDisabled
        ? sourceSearchResponse(toolRun.citations)
        : await this.generateAnswer({
            content: validated.content,
            selectedModelId: modelSettings.selectedModelId,
            history,
            attachments: validated.attachments,
            toolRun,
            options,
            request,
          });
      throwIfCancelled(request);
      const assistantMessage: AiMessage = {
        id: randomUUID(),
        threadId,
        role: 'assistant',
        content: response.content,
        citations: response.citations,
        reasoning: response.reasoning,
        createdAt: timestamp + 2,
      };

      await db.withTransactionAsync(async () => {
        throwIfCancelled(request);
        await insertMessage(db, userMessage);
        if (toolMessage) {
          await insertMessage(db, toolMessage);
        }
        await insertMessage(db, assistantMessage);
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
    } catch (error) {
      if (request.cancelled) {
        throwIfCancelled(request);
      }
      throw error;
    } finally {
      unregisterRequest(request);
    }
  }

  static async cancelActiveResponse(threadId?: string) {
    if (threadId) {
      const request = activeRequests.get(threadId);
      if (request) request.cancelled = true;
    } else {
      for (const request of activeRequests.values()) {
        request.cancelled = true;
      }
    }
    await llamaAdapter.cancelActiveCompletion();
  }

  private static async listContextMessages(threadId: string) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<{
      role: 'user' | 'assistant';
      content: string;
      created_at: number;
    }>(
      `SELECT role, content, created_at FROM chat_messages
       WHERE thread_id = ?
         AND deleted_at IS NULL
         AND role IN ('user', 'assistant')
       ORDER BY created_at DESC
       LIMIT 8`,
      [threadId]
    );
    return rows.reverse().map((message) => ({ role: message.role, content: message.content }));
  }

  private static async generateAnswer({
    content,
    selectedModelId,
    history,
    attachments,
    toolRun,
    options,
    request,
  }: {
    content: string;
    selectedModelId?: string | null;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    attachments?: AiSendMessageInput['attachments'];
    toolRun: AiToolRun;
    options: AiSendMessageOptions;
    request: ActiveAiRequest;
  }) {
    const adapter = (await llamaAdapter.isAvailable(selectedModelId)) ? llamaAdapter : mockAdapter;
    options.onProgress?.({
      stage: 'loading_model',
      label: adapter === llamaAdapter ? 'Loading local model' : 'Preparing response',
    });
    throwIfCancelled(request);
    options.onProgress?.({ stage: 'generating_response', label: 'Generating response' });
    return adapter.sendMessage({
      content,
      selectedModelId,
      history,
      attachments,
      citations: toolRun.citations,
      sourceContext: toolRun.sourceContext,
      toolTrace: toolRun.toolTrace,
      onToken: (token) => {
        if (!request.cancelled) options.onToken?.(token);
      },
      onReasoning: (reasoning) => {
        if (!request.cancelled) options.onReasoning?.(reasoning);
      },
    });
  }

  private static async resolveThreadModelSettings(threadId: string) {
    const threadSettings = await this.getThreadModelSettings(threadId);
    const [globalSelectedModelId, globalDisabled] = await Promise.all([
      PreferencesService.getSelectedAiModelId(),
      PreferencesService.getAiChatModelDisabled(),
    ]);
    return {
      selectedModelId: threadSettings.selectedModelId ?? globalSelectedModelId,
      chatModelDisabled: threadSettings.chatModelDisabled ?? globalDisabled,
    };
  }
}

function messageAttachmentsFromInput(attachments: AiAttachment[]): AiMessageAttachment[] {
  return attachments.map((attachment) => {
    if (attachment.type === 'image') {
      return {
        type: attachment.type,
        title: attachment.title,
        uri: attachment.uri,
        mimeType: attachment.mimeType,
      };
    }
    return {
      type: attachment.type,
      title: attachment.title,
      sourceId: attachment.sourceId,
    };
  });
}

function sourceSearchResponse(citations: AiCitation[]): AiAdapterResponse {
  if (!citations.length) {
    return {
      content: 'No matching local sources were found.',
      citations: [],
    };
  }

  const results = citations.map((citation, index) => {
    const location = [
      citation.sectionTitle,
      typeof citation.page === 'number' ? `page ${citation.page}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    const snippet = citation.snippet.trim().replace(/\s+/g, ' ');
    return `[${index + 1}] **${citation.title}**${location ? ` - ${location}` : ''}\n${snippet}`;
  });

  return {
    content: `Found ${citations.length} relevant local source${citations.length === 1 ? '' : 's'}:\n\n${results.join('\n\n')}`,
    citations,
  };
}

function rowToMessage(row: {
  id: string;
  thread_id: string;
  role: AiMessage['role'];
  content: string;
  citations_json: string | null;
  reasoning: string | null;
  metadata_json: string | null;
  created_at: number;
}): AiMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    content: row.content,
    citations: row.citations_json ? JSON.parse(row.citations_json) : [],
    reasoning: row.reasoning ?? undefined,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    createdAt: row.created_at,
  };
}

async function insertMessage(
  db: Awaited<ReturnType<typeof DatabaseClient.getDb>>,
  message: AiMessage
) {
  await db.runAsync(
    `INSERT INTO chat_messages
      (id, thread_id, role, content, citations_json, reasoning, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.threadId,
      message.role,
      message.content,
      message.citations.length ? JSON.stringify(message.citations) : null,
      message.reasoning ?? null,
      message.metadata ? JSON.stringify(message.metadata) : null,
      message.createdAt,
    ]
  );
}

async function nextThreadTimestamp(
  db: Awaited<ReturnType<typeof DatabaseClient.getDb>>,
  threadId: string
) {
  const row = await db.getFirstAsync<{ created_at: number | null }>(
    'SELECT MAX(created_at) AS created_at FROM chat_messages WHERE thread_id = ?',
    [threadId]
  );
  return Math.max(Date.now(), row?.created_at ? row.created_at + 1 : 0);
}
