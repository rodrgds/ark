import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { TracksRepository } from '@/services/db/repositories/tracks.repo';
import { FileSystemService } from '@/services/files/filesystem.service';

export class TrackExportService {
  static async exportGpx(trackId: string) {
    const [track, points, markers] = await Promise.all([
      TracksRepository.getTrack(trackId),
      TracksRepository.listPoints(trackId),
      TracksRepository.listMarkers(trackId),
    ]);
    if (!track) throw new Error('Track not found.');
    const gpx = buildGpx({
      name: track.title,
      points,
      markers,
    });
    await FileSystemService.ensureAppDirectories();
    const fileName = `${FileSystemService.safeFileName(track.title || 'track')}.gpx`;
    const uri = `${FileSystemService.dir('tracks')}${Date.now()}-${fileName}`;
    await FileSystem.writeAsStringAsync(uri, gpx, { encoding: FileSystem.EncodingType.UTF8 });
    return { uri, fileName };
  }

  static async shareGpx(trackId: string) {
    const exported = await this.exportGpx(trackId);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exported.uri, {
        mimeType: 'application/gpx+xml',
        UTI: 'com.topografix.gpx',
        dialogTitle: 'Share track GPX',
      });
    }
    return exported;
  }
}

function buildGpx(input: {
  name: string;
  points: Awaited<ReturnType<typeof TracksRepository.listPoints>>;
  markers: Awaited<ReturnType<typeof TracksRepository.listMarkers>>;
}) {
  const trackPoints = input.points.filter(
    (point) => point.latitude != null && point.longitude != null
  );
  const waypoints = input.markers
    .map(
      (marker) => `  <wpt lat="${marker.latitude}" lon="${marker.longitude}">
    <name>${escapeXml(marker.title)}</name>
    ${marker.description ? `<desc>${escapeXml(marker.description)}</desc>` : ''}
    <time>${new Date(marker.recordedAt).toISOString()}</time>
  </wpt>`
    )
    .join('\n');
  const segments = trackPoints
    .map(
      (point) => `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        ${point.altitudeMeters == null ? '' : `<ele>${point.altitudeMeters.toFixed(2)}</ele>`}
        <time>${new Date(point.recordedAt).toISOString()}</time>
      </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ark" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
  <trk>
    <name>${escapeXml(input.name)}</name>
    <trkseg>
${segments}
    </trkseg>
  </trk>
</gpx>
`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
