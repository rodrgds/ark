export type GuideSection = {
  title: string;
  detail: string;
  page?: number;
};

const GUIDE_SECTIONS: Record<string, GuideSection[]> = {
  'hesperian-first-aid': [
    {
      title: 'Calm and assess',
      detail: 'Scene safety, breathing, bleeding, and whole-body check.',
      page: 1,
    },
    {
      title: 'Breathing',
      detail: 'Choking, drowning, rescue breathing, and compressions.',
      page: 5,
    },
    {
      title: 'Bleeding and shock',
      detail: 'Direct pressure, danger signs, and shock response.',
      page: 9,
    },
    {
      title: 'Broken bones',
      detail: 'Splints, dislocations, sprains, and transport cautions.',
      page: 29,
    },
    {
      title: 'Burns',
      detail: 'Cooling burns, avoiding infection, and recognizing severe burns.',
      page: 41,
    },
    {
      title: 'Poisoning',
      detail: 'When to avoid vomiting, airway watch, and urgent referral signs.',
      page: 53,
    },
    {
      title: 'Heat and cold',
      detail: 'Heat exhaustion, heat stroke, hypothermia, and warming/cooling priorities.',
      page: 61,
    },
  ],
  'where-there-is-no-doctor-first-aid': [
    {
      title: 'Emergency order',
      detail: 'Immediate priorities for loss of consciousness and breathing.',
      page: 1,
    },
    { title: 'Bleeding', detail: 'Pressure, bandaging, and shock warning signs.', page: 8 },
    { title: 'Burns', detail: 'Cooling, infection prevention, and when to seek help.', page: 20 },
    {
      title: 'Wounds',
      detail: 'Cleaning wounds, covering them, and watching for infection.',
      page: 27,
    },
    {
      title: 'Animal bites',
      detail: 'Wash immediately, control bleeding, and understand rabies risk.',
      page: 34,
    },
    {
      title: 'Transport',
      detail: 'Stabilize before moving and protect neck/back injuries.',
      page: 42,
    },
  ],
  'us-army-survival-fm-21-76': [
    {
      title: 'Survival planning',
      detail: 'Priorities, psychology, and survival actions.',
      page: 1,
    },
    { title: 'Shelter', detail: 'Expedient shelters by climate and terrain.', page: 45 },
    { title: 'Water', detail: 'Finding, collecting, and treating water.', page: 63 },
    { title: 'Fire', detail: 'Fire principles, materials, and field methods.', page: 75 },
    {
      title: 'Food',
      detail: 'Food priorities, trapping/fishing overview, and avoiding unsafe improvisation.',
      page: 91,
    },
    {
      title: 'Plants',
      detail: 'Universal edibility test context and why uncertain plant ID is dangerous.',
      page: 117,
    },
    {
      title: 'Navigation',
      detail: 'Map, compass, sun, stars, and improvised direction finding.',
      page: 149,
    },
    {
      title: 'Signaling',
      detail: 'Ground-to-air signals, mirrors, fires, and improvised markers.',
      page: 175,
    },
    {
      title: 'First aid',
      detail: 'Field priorities for breathing, bleeding, shock, wounds, and evacuation.',
      page: 205,
    },
    {
      title: 'Sea survival',
      detail: 'Rafts, water discipline, signaling, and exposure hazards.',
      page: 255,
    },
  ],
};

export class GuideService {
  static getSections(packId: string) {
    return GUIDE_SECTIONS[packId] ?? [];
  }
}
