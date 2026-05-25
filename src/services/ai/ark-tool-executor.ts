import { z } from 'zod';
import { AiToolService, type AiToolRun } from '@/services/ai/ai-tools.service';
import { RagService } from '@/services/ai/rag.service';
import type { NormalizedToolCall } from '@/services/ai/response-normalizer';

const searchLocalKnowledgeSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(6).default(4),
});

const readCachedWeatherSchema = z.object({
  query: z.string().trim().max(300).optional(),
});

export const ARK_LLAMARN_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_local_knowledge',
      description:
        'Search Ark offline notes, guides, documents, RSS items, maps, and cached ZIM content.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Short search query for local emergency knowledge.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of local matches to return.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_cached_weather',
      description: 'Read the latest weather forecast cached on this device.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional weather question, such as today, tonight, or tomorrow.',
          },
        },
        additionalProperties: false,
      },
    },
  },
];

export type ExecutedArkToolCall = {
  call: NormalizedToolCall;
  output: AiToolRun;
};

export async function executeArkToolCall(call: NormalizedToolCall): Promise<ExecutedArkToolCall> {
  if (call.name === 'search_local_knowledge') {
    const args = searchLocalKnowledgeSchema.parse(call.arguments);
    const citations = await RagService.search(args.query, { limit: args.limit });
    const sourceContext = await RagService.expandCitations(citations, {
      maxSources: Math.min(3, args.limit),
      maxCharsPerSource: 1800,
    });
    return {
      call,
      output: {
        citations,
        sourceContext,
        toolTrace: [
          {
            tool: 'search_local_knowledge',
            summary: citations.length
              ? `Found ${citations.length} local source matches for "${args.query}".`
              : `No local matches found for "${args.query}".`,
          },
          ...sourceContext.map((source) => ({
            tool: 'read_local_source' as const,
            summary: `Opened ${source.title} for fuller context.`,
          })),
        ],
      },
    };
  }

  if (call.name === 'read_cached_weather') {
    const args = readCachedWeatherSchema.parse(call.arguments);
    const output = await AiToolService.runCachedWeatherTool(args.query || 'current weather forecast');
    return {
      call,
      output: output ?? AiToolService.emptyRun(),
    };
  }

  throw new Error(`Unknown Ark tool: ${call.name}`);
}
