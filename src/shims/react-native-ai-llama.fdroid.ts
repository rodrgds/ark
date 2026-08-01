// F-Droid shim for @react-native-ai/llama.
//
// This module must NOT throw at module evaluation: Metro/Hermes can propagate a
// top-level throw from a dynamically imported module synchronously, which
// bypasses `import(...).catch()` and becomes an unhandled rejection that crashes
// release builds. The app normally avoids importing this package on F-Droid
// (loadLlamaModule gates on the localLlm capability), but if it is ever reached
// it must evaluate cleanly and only fail at use time, where the app's model
// loading code already handles errors.
const UNAVAILABLE = 'On-device AI models are not available in Ark\u2019s F-Droid build.';

export const llama = {
  languageModel: () => {
    throw new Error(UNAVAILABLE);
  },
};
