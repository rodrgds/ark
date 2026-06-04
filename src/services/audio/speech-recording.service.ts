import { AudioManager, AudioRecorder } from 'react-native-audio-api';

const SPEECH_SAMPLE_RATE = 16000;
const SPEECH_BUFFER_LENGTH = SPEECH_SAMPLE_RATE * 0.1;

const recorder = new AudioRecorder();

let chunks: Float32Array[] = [];
let totalSamples = 0;
let recording = false;
let recordingError: Error | null = null;
let levelListener: ((level: number) => void) | null = null;

export class SpeechRecordingService {
  static async start(onLevel?: (level: number) => void) {
    if (recording) throw new Error('Voice input is already recording.');

    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== 'Granted') {
      throw new Error('Microphone permission is required for voice input.');
    }

    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'spokenAudio',
      iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
    });
    await AudioManager.setAudioSessionActivity(true);

    chunks = [];
    totalSamples = 0;
    recordingError = null;
    levelListener = onLevel ?? null;

    recorder.onError((error) => {
      recordingError = new Error(error.message || 'Voice recording failed.');
    });
    const callbackResult = recorder.onAudioReady(
      {
        sampleRate: SPEECH_SAMPLE_RATE,
        bufferLength: SPEECH_BUFFER_LENGTH,
        channelCount: 1,
      },
      ({ buffer }) => {
        const samples = buffer.getChannelData(0).slice();
        chunks.push(samples);
        totalSamples += samples.length;
        levelListener?.(calculateLevel(samples));
      }
    );
    if (callbackResult.status === 'error') {
      await this.cleanup();
      throw new Error(callbackResult.message);
    }

    const startResult = recorder.start();
    if (startResult.status === 'error') {
      await this.cleanup();
      throw new Error(startResult.message);
    }
    recording = true;
  }

  static async stop() {
    if (!recording) throw new Error('Voice input is not recording.');

    const stopResult = recorder.stop();
    recording = false;
    const error = recordingError;
    const waveform = concatenateChunks(chunks, totalSamples);
    await this.cleanup();

    if (stopResult.status === 'error') throw new Error(stopResult.message);
    if (error) throw error;
    return waveform;
  }

  static async cancel() {
    if (recording) {
      recorder.stop();
      recording = false;
    }
    await this.cleanup();
  }

  private static async cleanup() {
    recorder.clearOnAudioReady();
    recorder.clearOnError();
    chunks = [];
    totalSamples = 0;
    recordingError = null;
    levelListener = null;
    await AudioManager.setAudioSessionActivity(false).catch(() => undefined);
  }
}

function calculateLevel(samples: Float32Array) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 5);
}

function concatenateChunks(input: Float32Array[], length: number) {
  const output = new Float32Array(length);
  let offset = 0;
  for (const chunk of input) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
