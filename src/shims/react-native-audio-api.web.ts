const unavailable = {
  message: 'Voice input is available in Ark mobile builds.',
  status: 'error' as const,
};

export const AudioManager = {
  requestRecordingPermissions: async () => 'Denied',
  setAudioSessionActivity: async () => undefined,
  setAudioSessionOptions: () => undefined,
};

export class AudioRecorder {
  clearOnAudioReady() {}
  clearOnError() {}
  onAudioReady() {
    return unavailable;
  }
  onError() {}
  start() {
    return unavailable;
  }
  stop() {
    return unavailable;
  }
}

export class AudioContext {
  async close() {}
  async suspend() {}
}
