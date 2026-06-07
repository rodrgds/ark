export type ArkTabId = 'chat' | 'map' | 'library' | 'notes' | 'tools' | 'settings';

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
  materialIcon: string;
};

export const ARK_TABS: ArkTabDefinition[] = [
  {
    id: 'chat',
    routeName: 'chat',
    label: 'Arky',
    description: 'Local AI chat and source-grounded answers.',
    locked: true,
    sfSymbol: { default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' },
    materialIcon: 'chat_bubble',
  },
  {
    id: 'map',
    routeName: 'map',
    label: 'Map',
    description: 'Offline maps, saved spots, heading, and route drafts.',
    sfSymbol: { default: 'map', selected: 'map.fill' },
    materialIcon: 'map',
  },
  {
    id: 'library',
    routeName: 'library',
    label: 'Library',
    description: 'Downloaded guides, documents, ZIM packs, and references.',
    sfSymbol: { default: 'books.vertical', selected: 'books.vertical.fill' },
    materialIcon: 'menu_book',
  },
  {
    id: 'notes',
    routeName: 'notes',
    label: 'Notes',
    description: 'Vault-gated notes and field records.',
    sfSymbol: { default: 'note.text', selected: 'note.text' },
    materialIcon: 'edit_note',
  },
  {
    id: 'tools',
    routeName: 'tools',
    label: 'Tools',
    description: 'Compass, coordinates, barometer, weather, and readiness tools.',
    sfSymbol: { default: 'safari', selected: 'safari.fill' },
    materialIcon: 'explore',
  },
  {
    id: 'settings',
    routeName: 'settings',
    label: 'Settings',
    description: 'Device, vault, downloads, and interface controls.',
    locked: true,
    sfSymbol: { default: 'gearshape', selected: 'gearshape.fill' },
    materialIcon: 'settings',
  },
];

export const DEFAULT_TAB_ORDER = ARK_TABS.map((tab) => tab.id);
export const DEFAULT_ENABLED_TABS: ArkTabId[] = ['chat', 'map', 'library', 'notes', 'settings'];
