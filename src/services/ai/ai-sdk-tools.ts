import { tool } from 'ai';
import { z } from 'zod';
import { AiToolService, type AiToolRun } from '@/services/ai/ai-tools.service';
import { RagService } from '@/services/ai/rag.service';
import type { AiCitation } from '@/types/ai';

const searchLocalKnowledgeSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(6).default(4),
});

const readCachedWeatherSchema = z.object({
  query: z.string().trim().max(300).optional(),
});

type ArkToolOutput = {
  summary: string;
  citations: AiCitation[];
  sources: Array<{
    sourceId: string;
    title: string;
    content: string;
  }>;
};

type CreateArkAiSdkToolsOptions = {
  onRun?: (run: AiToolRun) => void;
};

export function createArkAiSdkTools(options: CreateArkAiSdkToolsOptions = {}) {
  return {
    search_local_knowledge: tool({
      description:
        'Search Ark offline notes, guides, documents, RSS items, maps, and cached ZIM content.',
      inputSchema: searchLocalKnowledgeSchema,
      execute: async ({ query, limit }): Promise<ArkToolOutput> => {
        const citations = await RagService.search(query, { limit });
        const sourceContext = await RagService.expandCitations(citations, {
          maxSources: Math.min(3, limit),
          maxCharsPerSource: 1800,
        });
        const run: AiToolRun = {
          citations,
          sourceContext,
          toolTrace: [
            {
              tool: 'search_local_knowledge',
              summary: citations.length
                ? `Found ${citations.length} local source matches for "${query}".`
                : `No local matches found for "${query}".`,
            },
            ...sourceContext.map((source) => ({
              tool: 'read_local_source' as const,
              summary: `Opened ${source.title} for fuller context.`,
            })),
          ],
        };
        options.onRun?.(run);
        return toToolOutput(run);
      },
    }),
    read_cached_weather: tool({
      description: 'Read the latest weather forecast cached on this device.',
      inputSchema: readCachedWeatherSchema,
      execute: async ({ query }): Promise<ArkToolOutput> => {
        const run =
          (await AiToolService.runCachedWeatherTool(query || 'current weather forecast')) ??
          AiToolService.emptyRun();
        options.onRun?.(run);
        return toToolOutput(run);
      },
    }),
  };
}

function toToolOutput(run: AiToolRun): ArkToolOutput {
  return {
    summary: run.toolTrace.map((entry) => entry.summary).join('\n') || 'Tool returned no results.',
    citations: run.citations,
    sources: run.sourceContext.map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      content: source.content.slice(0, 1800),
    })),
  };
}
