export type ArkTabId = 'chat' | 'tracks' | 'map' | 'library' | 'notes' | 'tools' | 'settings';

export type ArkTabDefinition = {
  id: ArkTabId;
  routeName: string;
  label: string;
  description: string;
  locked?: boolean;
  sfSymbol: {
    default: string;
    selected: string;
  };
  materialIcon: {
    default: string;
    selected: string;
  };
};

export const ARK_TABS: ArkTabDefinition[] = [
  {
    id: 'chat',
    routeName: 'chat',
    label: 'Arky',
    description: 'Local AI chat and source-grounded answers.',
    locked: true,
    sfSymbol: {
      default: 'bubble.left.and.bubble.right',
      selected: 'bubble.left.and.bubble.right.fill',
    },
    materialIcon: { default: 'message-outline', selected: 'message' },
  },
  {
    id: 'tracks',
    routeName: 'tracks',
    label: 'Tracks',
    description: 'Record field movement, photos, markers, charts, and GPX history.',
    sfSymbol: { default: 'figure.walk', selected: 'figure.walk' },
    materialIcon: { default: 'map-marker-path', selected: 'map-marker-path' },
  },
  {
    id: 'map',
    routeName: 'map',
    label: 'Map',
    description: 'Offline maps, saved spots, heading, and route drafts.',
    sfSymbol: { default: 'map', selected: 'map.fill' },
    materialIcon: { default: 'map-outline', selected: 'map' },
  },
  {
    id: 'library',
    routeName: 'library',
    label: 'Library',
    description: 'Downloaded guides, documents, ZIM packs, and references.',
    sfSymbol: { default: 'books.vertical', selected: 'books.vertical.fill' },
    materialIcon: {
      default: 'book-open-variant-outline',
      selected: 'book-open-variant',
    },
  },
  {
    id: 'notes',
    routeName: 'notes',
    label: 'Notes',
    description: 'Vault-gated notes and field records.',
    sfSymbol: { default: 'note.text', selected: 'note.text' },
    materialIcon: { default: 'note-edit-outline', selected: 'note-edit' },
  },
  {
    id: 'tools',
    routeName: 'tools',
    label: 'Tools',
    description: 'Compass, coordinates, barometer, weather, and readiness tools.',
    sfSymbol: { default: 'safari', selected: 'safari.fill' },
    materialIcon: { default: 'compass-outline', selected: 'compass' },
  },
  {
    id: 'settings',
    routeName: 'settings',
    label: 'Settings',
    description: 'Device, vault, downloads, and interface controls.',
    locked: true,
    sfSymbol: { default: 'gearshape', selected: 'gearshape.fill' },
    materialIcon: { default: 'cog-outline', selected: 'cog' },
  },
];

export const DEFAULT_TAB_ORDER = ARK_TABS.map((tab) => tab.id);
export const DEFAULT_ENABLED_TABS: ArkTabId[] = ['chat', 'tracks', 'map', 'library', 'settings'];
// Expo NativeTabs uses react-native-screens' Material BottomNavigationView on Android.
// Material 1.13 reports a max item count of 6, so persisted preferences are capped here.
export const MAX_VISIBLE_NATIVE_TABS = 6;
