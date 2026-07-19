import { AIService } from '@/services/ai/ai.service';
import {
  AI_EVALUATION_CASES,
  evaluateAiAnswer,
  type AiEvaluationResult,
} from '@/services/ai/evaluation';

export class AiEvaluationService {
  static async runAll(
    onProgress?: (input: { completed: number; total: number; title: string }) => void
  ): Promise<AiEvaluationResult[]> {
    const results: AiEvaluationResult[] = [];
    for (const evaluationCase of AI_EVALUATION_CASES) {
      let threadId: string | null = null;
      let result: AiEvaluationResult;
      try {
        threadId = await AIService.ensureThread(undefined, `[Evaluation] ${evaluationCase.title}`);
        const response = await AIService.sendMessage({
          threadId,
          content: evaluationCase.prompt,
          useRag: true,
        });
        const answer = [...response.messages]
          .reverse()
          .find((message) => message.role === 'assistant');
        result = evaluateAiAnswer(evaluationCase, answer?.content ?? '', answer?.citations ?? []);
      } catch (error) {
        result = {
          caseId: evaluationCase.id,
          title: evaluationCase.title,
          pass: false,
          failures: [error instanceof Error ? error.message : 'Evaluation could not run.'],
          answer: '',
          citationCount: 0,
        };
      } finally {
        if (threadId) {
          try {
            await AIService.clearThread(threadId);
          } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unknown cleanup error.';
            result = {
              ...result!,
              pass: false,
              failures: [
                ...result!.failures,
                `Temporary evaluation chat cleanup failed: ${detail}`,
              ],
            };
          }
        }
      }
      results.push(result!);
      onProgress?.({
        completed: results.length,
        total: AI_EVALUATION_CASES.length,
        title: evaluationCase.title,
      });
    }
    return results;
  }
}
