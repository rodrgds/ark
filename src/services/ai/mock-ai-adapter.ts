import { SAFETY_COPY } from '@/constants/app';
import type { AiAdapterResponse, AiAdapterSendInput } from '@/types/ai';

export class MockAIAdapter {
  readonly id = 'mock';

  async sendMessage(input: AiAdapterSendInput): Promise<AiAdapterResponse> {
    const hasSources = input.citations.length > 0;
    const toolTrace = input.toolTrace?.map((entry) => `- ${entry.summary}`).join('\n');
    const sourceLines = input.citations.map((citation, index) => {
      const location = [
        citation.sectionTitle,
        typeof citation.page === 'number' ? `page ${citation.page}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `${index + 1}. ${citation.title}${location ? ` (${location})` : ''}`;
    });

    return {
      content: hasSources
        ? [
            'Based on the local sources Ark found:',
            toolTrace ? `Tools used:\n${toolTrace}` : null,
            sourceLines.join('\n'),
            'Treat this as a source-grounded offline summary. Open the cited items for full context before acting on critical details.',
            `Safety: ${SAFETY_COPY.ai}`,
          ]
            .filter(Boolean)
            .join('\n\n')
        : [
            'I could not find matching offline sources for that question.',
            toolTrace ? `Tools used:\n${toolTrace}` : null,
            'Download or import reference packs, save map spots or routes, add notes, or refresh cached feeds/weather while online, then ask again.',
            `Safety: ${SAFETY_COPY.ai}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
      citations: input.citations,
    };
  }
}
