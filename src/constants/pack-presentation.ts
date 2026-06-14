import type { ContentCategory, ContentPack, ContentPackManifest } from '@/types/content';
import type { LucideIcon } from 'lucide-react-native';
import {
  BookMarked,
  BookOpen,
  Bot,
  BrainCircuit,
  ChefHat,
  Cross,
  FileText,
  FlameKindling,
  HandPlatter,
  House,
  HousePlug,
  Library,
  Map,
  MessageSquareText,
  Newspaper,
  PackageOpen,
  PillBottle,
  Plane,
  ShieldAlert,
  Snowflake,
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
  'us-army-survival-fm-21-76': TentTree,
  'food-preservation-usda': UtensilsCrossed,
  'wikipedia-simple-en-nopic': Library,
  'wikipedia-simple-en-mini': BookMarked,
  'medical-wikipedia-en-nopic': PillBottle,
  'wikivoyage-en-nopic': Plane,
  'model-qwen25-15b-q4-0': MessageSquareText,
  'model-smollm2-17b-q4-0': BrainCircuit,
  'model-gemma4-e2b-it-q4-k-m': BrainCircuit,
  'model-gemma4-e4b-it-q4-k-m': BrainCircuit,
  'disaster-power-outage': HousePlug,
  'disaster-floods': Waves,
  'disaster-earthquakes': House,
  'disaster-wildfires': FlameKindling,
  'disaster-extreme-heat': SunMedium,
  'disaster-winter-weather': Snowflake,
  'sanitation-hygiene': SoapDispenserDroplet,
  'household-readiness': HandPlatter,
  'emergency-water': Waves,
  'emergency-power': HousePlug,
  'emergency-cooking': ChefHat,
  'foraging-basics': Trees,
  'shelter-evacuation': TentTree,
  'offline-communications': MessageSquareText,
  'personal-safety-conflict': ShieldAlert,
  'sanitation-principles': SoapDispenserDroplet,
  'health-continuity': Stethoscope,
};

const CATEGORY_ICONS: Partial<Record<ContentCategory, LucideIcon>> = {
  'AI Models': Bot,
  Comms: MessageSquareText,
  Disasters: TriangleAlert,
  Food: UtensilsCrossed,
  Health: Cross,
  Maps: Map,
  Medical: Stethoscope,
  'Personal Documents': FileText,
  Preparedness: HandPlatter,
  RSS: Newspaper,
  Safety: ShieldAlert,
  Survival: TentTree,
  Water: SoapDispenserDroplet,
  Wiki: BookOpen,
};

const CATEGORY_ORDER: ContentCategory[] = [
  'Preparedness',
  'Water',
  'Medical',
  'Food',
  'Survival',
  'Disasters',
  'Safety',
  'Comms',
  'Health',
  'Wiki',
  'Maps',
  'AI Models',
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
  if (pack.modelRole === 'voice') return 'Voice';
  if (pack.modelRole === 'voiceProjector') return 'Voice projector';
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
