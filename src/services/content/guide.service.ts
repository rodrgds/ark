export type GuideSection = {
  title: string;
  detail: string;
  page?: number;
  htmlTargets?: string[];
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
      page: 38,
    },
    {
      title: 'Poisoning',
      detail: 'When to avoid vomiting, airway watch, and urgent referral signs.',
      page: 45,
    },
    {
      title: 'Heat and cold',
      detail: 'Heat exhaustion, heat stroke, hypothermia, and warming/cooling priorities.',
      page: 56,
    },
  ],

  'where-there-is-no-doctor-first-aid': [
    {
      title: 'Emergency order',
      detail: 'Immediate priorities for loss of consciousness and breathing.',
      page: 4,
    },
    {
      title: 'Bleeding',
      detail: 'Pressure, bandaging, and shock warning signs.',
      page: 8,
    },
    {
      title: 'Burns',
      detail: 'Cooling, infection prevention, and when to seek help.',
      page: 22,
    },
    {
      title: 'Wounds',
      detail: 'Cleaning wounds, covering them, and watching for infection.',
      page: 10,
    },
    {
      title: 'Animal bites',
      detail: 'Wash immediately, control bleeding, and understand rabies risk.',
      page: 15,
    },
    {
      title: 'Transport',
      detail: 'Stabilize before moving and protect neck/back injuries.',
      page: 26,
    },
  ],

  'us-army-survival-fm-21-76': [
    {
      title: 'Survival planning',
      detail: 'Priorities, psychology, and survival actions.',
      page: 7,
    },
    {
      title: 'Shelter',
      detail: 'Expedient shelters by climate and terrain.',
      page: 38,
    },
    {
      title: 'Water',
      detail: 'Finding, collecting, and treating water.',
      page: 53,
    },
    {
      title: 'Fire',
      detail: 'Fire principles, materials, and field methods.',
      page: 63,
    },
    {
      title: 'Food',
      detail: 'Food priorities, trapping/fishing overview, and avoiding unsafe improvisation.',
      page: 72,
    },
    {
      title: 'Plants',
      detail: 'Universal edibility test context and why uncertain plant ID is dangerous.',
      page: 99,
    },
    {
      title: 'Navigation',
      detail: 'Map, compass, sun, stars, and improvised direction finding.',
      page: 194,
    },
    {
      title: 'Signaling',
      detail: 'Ground-to-air signals, mirrors, fires, and improvised markers.',
      page: 200,
    },
    {
      title: 'First aid',
      detail: 'Field priorities for breathing, bleeding, shock, wounds, and evacuation.',
      page: 16,
    },
    {
      title: 'Sea survival',
      detail: 'Rafts, water discipline, signaling, and exposure hazards.',
      page: 162,
    },
  ],

  'usda-special-forest-products-harvest': [
    {
      title: 'Why restraint matters',
      detail:
        'Wild foods can be a safety net, but gathering pressure can damage local plant populations.',
      page: 14,
    },
    {
      title: 'General harvest rules',
      detail:
        'Gather where plants are abundant, take only a little, rotate sites, and leave enough for wildlife and other people.',
      page: 20,
    },
    {
      title: 'Know what you gather',
      detail:
        'Use a regional field guide, avoid threatened plants, and do not rely on Ark for positive plant or mushroom identification.',
      page: 20,
    },
    {
      title: 'Do not ship mushroom ID',
      detail:
        'The report discusses mushrooms as forest products, but Ark treats mushroom identification as out of scope without expert local sources.',
      page: 51,
    },
    {
      title: 'Appendix guidelines',
      detail:
        'Harvest norms from field guides and gatherer research: minimize impact, gather selectively, rotate areas, and avoid fragile habitats.',
      page: 54,
    },
  ],

  // Official web guides — no page numbers because source is HTML
  'disaster-power-outage': [
    {
      title: 'Power Outage Tips',
      detail:
        'Keep refrigerators closed, avoid unsafe heating, disconnect electronics, and plan for medical needs.',
    },
    {
      title: 'Preparing for a Power Outage',
      detail:
        'Inventory electric-dependent items and prepare batteries, chargers, and flashlights.',
    },
    {
      title: 'Generator Safety',
      detail: 'Use generators outdoors, away from windows, doors, and garages.',
    },
    {
      title: 'Food Storage',
      detail: 'Keep fridges/freezers closed and discard unsafe food after temperature abuse.',
    },
  ],

  'disaster-floods': [
    {
      title: 'Know Your Risk',
      detail: 'Check local flood maps and understand flash-flood vs river-flood warnings.',
    },
    {
      title: 'Evacuation',
      detail: 'Do not drive through flooded roads. Move to higher ground immediately.',
    },
    {
      title: 'During a Flood',
      detail: 'Avoid moving water, stay off bridges, and listen to emergency broadcasts.',
    },
    {
      title: 'After a Flood',
      detail: 'Avoid contaminated water, check structural damage, and document losses for aid.',
    },
  ],

  'disaster-earthquakes': [
    {
      title: 'Drop, Cover, and Hold On',
      detail: 'Protect your head and neck under sturdy furniture or against an interior wall.',
    },
    {
      title: 'Indoor Safety',
      detail: 'Stay away from windows, glass, and exterior walls. Do not use elevators.',
    },
    {
      title: 'If Outdoors',
      detail: 'Move to an open area away from buildings, trees, power lines, and vehicles.',
    },
    {
      title: 'Aftershocks',
      detail: 'Expect aftershocks. Check for injuries and damage before moving around.',
    },
  ],

  'disaster-wildfires': [
    {
      title: 'Evacuation Timing',
      detail: 'Know your routes early and evacuate immediately when authorities tell you to.',
      htmlTargets: [
        'You may have to evacuate quickly due to a wildfire',
        'Evacuate immediately if authorities tell you to do so',
        '#during',
      ],
    },
    {
      title: 'Air Quality',
      detail: 'Close off smoky air, use filtration when possible, and use an N95 if available.',
      htmlTargets: [
        'Designate a room that can be closed off from outside air',
        'Use an N95 mask to protect yourself from smoke inhalation',
        '#during',
      ],
    },
    {
      title: 'Protecting Your Home',
      detail: 'Use fire-resistant materials and clear leaves, debris, and flammable materials.',
      htmlTargets: [
        'Strengthen your Home',
        'Use fire-resistant materials to build, renovate or make repairs',
        'Create a fire-resistant zone',
        '#prepare',
      ],
    },
    {
      title: 'If Trapped',
      detail: 'Call 9-1-1, give your location, and turn on lights to help rescuers find you.',
      htmlTargets: ['If trapped, call 9-1-1 and give your location', '#during'],
    },
  ],

  'disaster-extreme-heat': [
    {
      title: 'Stay Cool',
      detail: 'Seek air conditioning, cool showers, and shaded outdoor spaces.',
    },
    {
      title: 'Hydration',
      detail: 'Drink water regularly, avoid alcohol and caffeine, and check on vulnerable people.',
    },
    {
      title: 'Heat Illness Signs',
      detail: 'Heavy sweating, cramps, nausea, dizziness, and confusion require cooling and rest.',
    },
    {
      title: 'Never Leave People or Pets in Vehicles',
      detail: 'Temperatures inside vehicles can become lethal within minutes.',
    },
  ],

  'food-preservation-usda': [
    {
      title: 'Principles of Home Canning',
      detail:
        'Understand acidity, heat penetration, and the role of pressure canners vs water baths.',
    },
    {
      title: 'Selecting and Preparing Food',
      detail: 'Use fresh, high-quality produce and follow tested recipes precisely.',
    },
    {
      title: 'Fruits and Fruit Products',
      detail: 'Jams, jellies, and canned fruits with proper sugar and pH levels.',
    },
    {
      title: 'Tomatoes, Vegetables, and Meats',
      detail: 'Low-acid foods require pressure canning to destroy botulism spores.',
    },
  ],

  'sanitation-hygiene': [
    {
      title: 'Clean Water Priorities',
      detail:
        'Drinking, cooking, handwashing, wound cleaning, and dishwashing in order of importance.',
    },
    {
      title: 'Toilet and Waste Setup',
      detail: 'Temporary toilets, waste separation, smell control, and contamination zones.',
    },
    {
      title: 'Food Safety',
      detail: 'Spoilage, dirty water, pests, and safe disposal after a disaster.',
    },
    {
      title: 'Prevent Disease Spread',
      detail: 'Hand hygiene, isolation, laundry, masks, and shared-space precautions.',
    },
  ],

  // Authored guides — no page numbers because source is authored HTML
  'emergency-cooking': [
    {
      title: 'Cook safely without power',
      detail: 'Gas, camping stoves, fire, ventilation, and carbon monoxide risks.',
    },
    {
      title: 'Use food before it spoils',
      detail: 'Fridge, freezer, pantry order, and when to discard food.',
    },
    {
      title: 'Low-water cooking',
      detail: 'Meals that conserve water and fuel.',
    },
    {
      title: 'No-cook meals',
      detail: 'Shelf-stable combinations when fire is unsafe.',
    },
  ],

  'foraging-basics': [
    {
      title: 'Do not guess',
      detail: 'Why uncertain plant ID is dangerous and when not to forage.',
    },
    {
      title: 'Universal edibility test is not enough',
      detail: 'Why slow testing does not make unknown plants safe.',
    },
    {
      title: 'High-risk lookalikes',
      detail: 'Mushrooms, berries, bulbs, hemlock-like plants, and polluted areas.',
    },
    {
      title: 'Safer food priorities',
      detail: 'Prefer stored food, known local plants, fishing, and community knowledge.',
    },
  ],

  'food-procurement-basics': [
    {
      title: 'Before hunting or fishing',
      detail: 'Legal limits, safety, contamination, humane handling, and energy cost.',
    },
    {
      title: 'Fishing first',
      detail: 'Why fishing is often safer and more efficient than hunting.',
    },
    {
      title: 'Animal handling risks',
      detail: 'Parasites, spoilage, bites, disease, and safe cooking temperatures.',
    },
    {
      title: 'When not to hunt',
      detail: 'Injury risk, ammunition scarcity, noise, legality, and community safety.',
    },
  ],

  'personal-safety-conflict': [
    {
      title: 'Avoid becoming a target',
      detail: 'Movement, visibility, valuables, groups, and low-profile behavior.',
    },
    {
      title: 'De-escalation',
      detail: 'Distance, calm speech, exits, witnesses, and non-provocation.',
    },
    {
      title: 'Escape planning',
      detail: 'Routes, barriers, safe rooms, alarms, and regroup points.',
    },
    {
      title: 'After an incident',
      detail: 'Medical check, documentation, police/contact options, and mental recovery.',
    },
  ],

  'offline-communications': [
    {
      title: 'First rule: preserve battery',
      detail: 'Airplane mode, low brightness, OLED black UI, power banks, and duty cycles.',
    },
    {
      title: 'SMS, radio, and meeting points',
      detail: 'Use low-bandwidth channels and pre-agreed physical fallback plans.',
    },
    {
      title: 'Signal methods',
      detail: 'Whistles, mirrors, flashlights, flags, and ground markers.',
    },
    {
      title: 'Information hygiene',
      detail: 'Avoid rumors, verify before moving, and record trusted updates.',
    },
  ],
};

export class GuideService {
  static getSections(packId: string) {
    return GUIDE_SECTIONS[packId] ?? [];
  }
}
