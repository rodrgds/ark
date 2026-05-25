import type { ContentCategory, ContentPack, ContentPackManifest } from '@/types/content';
import type { LucideIcon } from 'lucide-react-native';
import {
  BookHeart,
  BookMarked,
  BookOpen,
  Bot,
  BrainCircuit,
  ChefHat,
  Cross,
  FlameKindling,
  Globe,
  HandPlatter,
  House,
  HousePlug,
  Languages,
  Library,
  Map,
  MessageSquareText,
  PackageOpen,
  PillBottle,
  Plane,
  ScanSearch,
  ShieldAlert,
  SoapDispenserDroplet,
  Stethoscope,
  SunMedium,
  TentTree,
  Trees,
  TriangleAlert,
  UtensilsCrossed,
  Waves,
} from 'lucide-react-native';

type PackLike = Pick<ContentPackManifest, 'id' | 'category' | 'modelRole'>;

const PACK_ICONS: Record<string, LucideIcon> = {
  'hesperian-first-aid': Cross,
  'us-army-survival-fm-21-76': TentTree,
  'usda-special-forest-products-harvest': Trees,
  'where-there-is-no-doctor-first-aid': BookHeart,
  'wikipedia-simple-en-nopic': Library,
  'wikipedia-simple-en-mini': BookMarked,
  'medical-wikipedia-en-nopic': PillBottle,
  'wikivoyage-en-nopic': Plane,
  'embedding-nomic-v15-q4-k-m': ScanSearch,
  'embedding-qwen3-06b-q8': Languages,
  'model-qwen25-15b-q4-0': MessageSquareText,
  'model-smollm2-17b-q4-0': BrainCircuit,
  'disaster-power-outage': HousePlug,
  'disaster-floods': Waves,
  'disaster-earthquakes': House,
  'disaster-wildfires': FlameKindling,
  'disaster-extreme-heat': SunMedium,
  'food-preservation-usda': ChefHat,
  'sanitation-hygiene': SoapDispenserDroplet,
};

const CATEGORY_ICONS: Partial<Record<ContentCategory, LucideIcon>> = {
  'AI Models': Bot,
  Disasters: TriangleAlert,
  Food: UtensilsCrossed,
  Health: Cross,
  Maps: Map,
  Medical: Stethoscope,
  Preparedness: HandPlatter,
  Safety: ShieldAlert,
  Survival: TentTree,
  Wiki: BookOpen,
};

const CATEGORY_ORDER: ContentCategory[] = [
  'Medical',
  'Survival',
  'Disasters',
  'Preparedness',
  'Wiki',
  'Maps',
  'AI Models',
  'Food',
  'Health',
  'Safety',
  'Comms',
  'RSS',
  'Personal Documents',
];

export function getPackIcon(pack: PackLike): LucideIcon {
  return PACK_ICONS[pack.id] ?? CATEGORY_ICONS[pack.category] ?? PackageOpen;
}

export function getCategoryIcon(category: ContentCategory): LucideIcon {
  return CATEGORY_ICONS[category] ?? PackageOpen;
}

export function getPackModelRoleLabel(pack: Pick<ContentPackManifest, 'category' | 'modelRole'>) {
  if (pack.category !== 'AI Models') return null;
  if (pack.modelRole === 'embedding') return 'Search';
  if (pack.modelRole === 'chat') return 'Chat';
  return 'AI';
}

export function getOrderedContentCategories(
  packs: Array<Pick<ContentPack, 'category'>>
): ContentCategory[] {
  const unique = Array.from(new Set(packs.map((pack) => pack.category)));
  return unique.sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
    return left.localeCompare(right);
  });
}
