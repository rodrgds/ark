import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { TrackRecordingService } from '@/services/tracks/track-recording.service';
import { TRACK_LOCATION_TASK } from '@/services/tracks/track-task.constants';

type LocationTaskData = {
  locations?: LocationObject[];
};

TaskManager.defineTask<LocationTaskData>(TRACK_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    await TrackRecordingService.recordTaskError(error.message);
    return;
  }
  await TrackRecordingService.handleLocationBatch(data?.locations ?? []).catch((taskError) =>
    TrackRecordingService.recordTaskError(
      taskError instanceof Error ? taskError.message : 'Track recording task failed.'
    )
  );
});
