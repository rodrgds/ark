import { create } from 'zustand';
import { TrackRecordingService } from '@/services/tracks/track-recording.service';
import type { Track, TrackMarker, TrackPoint, TrackActivityType } from '@/types/tracks';

type TrackStoreState = {
  activeTrack: Track | null;
  lastPoint: TrackPoint | null;
  markers: TrackMarker[];
  foregroundPermissionGranted: boolean;
  backgroundPermissionGranted: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  start: (input: { activityType: TrackActivityType; title?: string }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  discard: () => Promise<void>;
};

let subscribed = false;

export const useTrackStore = create<TrackStoreState>((set, get) => ({
  activeTrack: null,
  lastPoint: null,
  markers: [],
  foregroundPermissionGranted: false,
  backgroundPermissionGranted: false,
  loading: false,
  error: null,
  refresh: async () => {
    if (!subscribed) {
      subscribed = true;
      TrackRecordingService.subscribe(() => {
        void useTrackStore.getState().refresh();
      });
    }
    set({ loading: true, error: null });
    try {
      const snapshot = await TrackRecordingService.getSnapshot();
      set({ ...snapshot, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Track state unavailable.',
      });
    }
  },
  start: async (input) => {
    set({ loading: true, error: null });
    try {
      await TrackRecordingService.startRecording(input);
      await get().refresh();
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to start track.',
      });
      throw error;
    }
  },
  pause: async () => {
    const track = get().activeTrack;
    if (!track) return;
    await TrackRecordingService.pauseRecording(track.id);
    await get().refresh();
  },
  resume: async () => {
    const track = get().activeTrack;
    if (!track) return;
    await TrackRecordingService.resumeRecording(track.id);
    await get().refresh();
  },
  finish: async () => {
    const track = get().activeTrack;
    if (!track) return;
    await TrackRecordingService.finishRecording(track.id);
    await get().refresh();
  },
  discard: async () => {
    const track = get().activeTrack;
    if (!track) return;
    await TrackRecordingService.discardRecording(track.id);
    await get().refresh();
  },
}));
