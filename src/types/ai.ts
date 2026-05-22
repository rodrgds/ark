export type AiCitation = {
  sourceId: string;
  title: string;
  snippet: string;
};

export type AiMessage = {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  citations: AiCitation[];
  createdAt: number;
};

export type AiSendMessageInput = {
  threadId?: string;
  content: string;
  useRag: boolean;
};

export type AiAdapterResponse = {
  content: string;
  citations: AiCitation[];
};
