import { SAFETY_COPY } from '@/constants/app';
import type { AiAdapterResponse, AiAdapterSendInput } from '@/types/ai';

export class MockAIAdapter {
  readonly id = 'mock';

  async sendMessage(input: AiAdapterSendInput): Promise<AiAdapterResponse> {
    const hasSources = input.citations.length > 0;
    return {
      content: [
        'Local AI is running in mock mode in this build.',
        hasSources
          ? `I found ${input.citations.length} offline source item(s) that may be relevant:\n${input.citations
              .map((citation, index) => {
                const location = [
                  citation.sectionTitle,
                  typeof citation.page === 'number' ? `page ${citation.page}` : null,
                ]
                  .filter(Boolean)
                  .join(', ');
                return `${index + 1}. ${citation.title}${
                  location ? ` (${location})` : ''
                }: ${citation.snippet}`;
              })
              .join('\n')}\n\nUse these as a starting point, then verify critical details.`
          : 'No offline RAG sources matched yet. Add notes or packs, then enable RAG again.',
        `Safety: ${SAFETY_COPY.ai}`,
      ].join('\n\n'),
      citations: input.citations,
    };
  }
}
