export class ArkError extends Error {
  constructor(
    message: string,
    public readonly code = 'ARK_ERROR'
  ) {
    super(message);
    this.name = 'ArkError';
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
