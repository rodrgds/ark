import { RagService } from '@/services/ai/rag.service';
import type { AiAdapterSendInput, AiCitation } from '@/types/ai';

export type AiToolRun = {
  citations: AiCitation[];
  sourceContext: NonNullable<AiAdapterSendInput['sourceContext']>;
  toolTrace: NonNullable<AiAdapterSendInput['toolTrace']>;
};

export class AiToolService {
  static async runLocalKnowledgeTools(query: string): Promise<AiToolRun> {
    const citations = await RagService.search(query, { limit: 4 });
    const sourceContext = await RagService.expandCitations(citations, {
      maxSources: 3,
      maxCharsPerSource: 1800,
    });
    return {
      citations,
      sourceContext,
      toolTrace: [
        {
          tool: 'search_local_knowledge',
          summary: citations.length
            ? `Found ${citations.length} relevant local source matches.`
            : 'No local matches found.',
        },
        ...sourceContext.map((source) => ({
          tool: 'read_local_source' as const,
          summary: `Opened ${source.title} for fuller context.`,
        })),
      ],
    };
  }

  static emptyRun(): AiToolRun {
    return {
      citations: [],
      sourceContext: [],
      toolTrace: [],
    };
  }
}
