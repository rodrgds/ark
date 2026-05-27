export type AiCitation = {
  sourceId: string;
  title: string;
  snippet: string;
  sourceRef?: string;
  sectionTitle?: string;
  page?: number;
  chunkIndex?: number;
  targetHref?: string;
};

export type AiThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
  selectedModelId?: string | null;
  chatModelDisabled?: boolean | null;
};

export type AiMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type AiMessageMetadata = {
  actions?: Array<{
    tool?: string;
    summary: string;
  }>;
};

export type AiMessage = {
  id: string;
  threadId: string;
  role: AiMessageRole;
  content: string;
  citations: AiCitation[];
  reasoning?: string;
  metadata?: AiMessageMetadata;
  createdAt: number;
};

export type AiSendMessageInput = {
  threadId?: string;
  content: string;
  useRag: boolean;
  selectedModelId?: string | null;
  chatModelDisabled?: boolean;
};

export type AiSendMessageOptions = {
  onToken?: (content: string) => void;
  onReasoning?: (content: string) => void;
  onProgress?: (progress: AiProgressEvent) => void;
};

export type AiProgressStage =
  | 'opening_database'
  | 'searching_notes'
  | 'searching_guides'
  | 'searching_documents'
  | 'searching_zim'
  | 'searching_rss'
  | 'searching_maps'
  | 'ranking_sources'
  | 'preparing_context'
  | 'loading_model'
  | 'generating_response';

export type AiProgressEvent = {
  stage: AiProgressStage;
  label: string;
};

export type AiAdapterResponse = {
  content: string;
  citations: AiCitation[];
  reasoning?: string;
};

export type AiAdapterSendInput = {
  content: string;
  selectedModelId?: string | null;
  history?: Array<Pick<AiMessage, 'role' | 'content'>>;
  citations: AiCitation[];
  sourceContext?: Array<{
    sourceId: string;
    title: string;
    content: string;
  }>;
  toolTrace?: Array<{
    tool: 'search_local_knowledge' | 'read_local_source' | 'read_cached_weather';
    summary: string;
  }>;
  onToken?: (content: string) => void;
  onReasoning?: (content: string) => void;
};
