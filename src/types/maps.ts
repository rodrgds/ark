export type MapRegion = {
  id: string;
  name: string;
  provider: string;
  styleUrl?: string | null;
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
  minZoom?: number | null;
  maxZoom?: number | null;
  offlinePackId?: string | null;
  status: 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'failed';
  progress: number;
  sizeBytes?: number | null;
  createdAt: number;
  updatedAt: number;
};
