export type ReadinessChecklistItem = {
  id: string;
  title: string;
  detail: string;
  group: 'water' | 'shelter' | 'medical' | 'navigation' | 'power' | 'comms';
};

export const READINESS_CHECKLIST: ReadinessChecklistItem[] = [
  {
    id: 'water-24h',
    group: 'water',
    title: 'Water for 24 hours',
    detail: 'Carry or stage enough water for the next day before planning anything longer.',
  },
  {
    id: 'filter-ready',
    group: 'water',
    title: 'Water filter or treatment',
    detail:
      'Pack filter, tablets, or a boil plan. Mark it checked only when it is physically ready.',
  },
  {
    id: 'warm-layer',
    group: 'shelter',
    title: 'Warm layer and rain shell',
    detail: 'One insulating layer, one rain layer, stored where you can reach them quickly.',
  },
  {
    id: 'first-aid',
    group: 'medical',
    title: 'First aid kit',
    detail:
      'Bandage, disinfectant, pain relief, personal medication, and any prescribed emergency gear.',
  },
  {
    id: 'offline-map',
    group: 'navigation',
    title: 'Offline map region',
    detail:
      'Download the area you expect to cross and save important spots before leaving service.',
  },
  {
    id: 'paper-backup',
    group: 'navigation',
    title: 'Navigation backup',
    detail: 'Compass, paper map, or written route notes. Phones fail at the worst time.',
  },
  {
    id: 'battery',
    group: 'power',
    title: 'Battery reserve',
    detail: 'Charge phone and power bank. Low-power mode should be available before departure.',
  },
  {
    id: 'contacts',
    group: 'comms',
    title: 'Emergency contacts written down',
    detail: 'Keep contact numbers and rendezvous details outside the phone as well.',
  },
];
