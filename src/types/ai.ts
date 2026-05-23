export type AiCitation = {
  sourceId: string;
  title: string;
  snippet: string;
  sourceRef?: string;
  sectionTitle?: string;
  page?: number;
  targetHref?: string;
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

export type AiSendMessageOptions = {
  onToken?: (content: string) => void;
};

export type AiAdapterResponse = {
  content: string;
  citations: AiCitation[];
};

export type AiAdapterSendInput = {
  content: string;
  citations: AiCitation[];
  onToken?: (content: string) => void;
};
