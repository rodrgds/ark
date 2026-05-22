import { RagService } from '@/services/ai/rag.service';

export class RagRepository {
  static search(query: string, options?: { limit?: number }) {
    return RagService.search(query, options);
  }
}
