export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.debug('[Ark]', ...args);
  },
  warn: (...args: unknown[]) => console.warn('[Ark]', ...args),
  error: (...args: unknown[]) => console.error('[Ark]', ...args),
};
