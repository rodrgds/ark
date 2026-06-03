import { AudioContext } from 'react-native-audio-api';

const SPEECH_SAMPLE_RATE = 24000;

let speechContext: AudioContext | null = null;

export function getSpeechPlaybackContext() {
  if (!speechContext) {
    speechContext = new AudioContext({ sampleRate: SPEECH_SAMPLE_RATE });
  }
  return speechContext;
}

export function getSpeechSampleRate() {
  return SPEECH_SAMPLE_RATE;
}

export async function closeSpeechPlaybackContext() {
  const context = speechContext;
  speechContext = null;
  await context?.close().catch(() => undefined);
}
