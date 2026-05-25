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
      title: 'Introduction and survival actions',
      detail: 'Survival mindset, planning, priorities, and immediate actions.',
      page: 7,
    },
    {
      title: 'Psychology of survival',
      detail: 'Stress, fear, fatigue, isolation, and mental discipline in emergencies.',
      page: 11,
    },
    {
      title: 'Survival medicine',
      detail: 'Breathing, bleeding, shock, wounds, infection, fractures, bites, and evacuation.',
      page: 16,
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
      title: 'Animals for food',
      detail: 'Insects, fish, reptiles, birds, mammals, traps, snares, and preparation cautions.',
      page: 83,
    },
    {
      title: 'Plants',
      detail: 'Universal edibility test context and why uncertain plant ID is dangerous.',
      page: 99,
    },
    {
      title: 'Poisonous plants',
      detail: 'Identification limits, contact hazards, ingestion hazards, and avoidance.',
      page: 123,
    },
    {
      title: 'Dangerous animals',
      detail: 'Insects, snakes, aquatic hazards, mammals, and defensive precautions.',
      page: 132,
    },
    {
      title: 'Weapons, tools, and equipment',
      detail: 'Field expedient tools, cordage, packs, clothing, and basic repairs.',
      page: 150,
    },
    {
      title: 'Desert survival',
      detail: 'Heat, water discipline, desert shelters, travel timing, and hazards.',
      page: 155,
    },
    {
      title: 'Tropical survival',
      detail: 'Jungle travel, shelter, water, food, insects, disease, and visibility.',
      page: 172,
    },
    {
      title: 'Cold weather survival',
      detail: 'Shelter, clothing, frostbite, hypothermia, snow travel, and fire.',
      page: 181,
    },
    {
      title: 'Sea survival',
      detail: 'Rafts, water discipline, signaling, fishing, exposure, and shore approach.',
      page: 194,
    },
    {
      title: 'Expedient water crossings',
      detail: 'Fording, flotation aids, rafts, and river crossing risk controls.',
      page: 211,
    },
    {
      title: 'Field-expedient direction finding',
      detail: 'Map, compass, sun, stars, shadows, and improvised direction finding.',
      page: 216,
    },
    {
      title: 'Signaling',
      detail: 'Ground-to-air signals, mirrors, fires, markers, radios, and improvised signals.',
      page: 223,
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
      title: 'Prepare Before an Earthquake',
      detail: 'Secure heavy items, make a family plan, and keep supplies ready before shaking starts.',
      htmlTargets: ['#before', 'Prepare Before an Earthquake'],
    },
    {
      title: 'During an Earthquake',
      detail: 'Drop, cover, and hold on. Stay away from glass, exterior walls, and falling objects.',
      htmlTargets: ['#during', 'During an Earthquake', 'Protect Yourself During Earthquakes'],
    },
    {
      title: 'Drop, Cover, and Hold On',
      detail: 'Protect your head and neck under sturdy furniture or against an interior wall.',
      htmlTargets: ['1. Drop (or Lock)', '2. Cover', '3. Hold On', '#during'],
    },
    {
      title: 'After an Earthquake',
      detail: 'Expect aftershocks. Check for injuries and damage before moving around.',
      htmlTargets: ['#after', 'After an Earthquake', 'Expect aftershocks'],
    },
    {
      title: 'Additional Resources',
      detail: 'Open partner earthquake safety resources from Ready.gov.',
      htmlTargets: ['#resources', 'Additional Resources', 'Partner Resources'],
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
      title: 'Before Extreme Heat',
      detail: 'Plan cooling options, check insulation, and prepare for heat emergencies before they happen.',
      htmlTargets: ['#prepare', 'Before Extreme Heat'],
    },
    {
      title: 'During Extreme Heat',
      detail: 'Stay cool, drink water regularly, avoid strenuous activity, and check vulnerable people.',
      htmlTargets: ['#during', 'During Extreme Heat'],
    },
    {
      title: 'Heat-Related Illnesses',
      detail: 'Recognize heat cramps, heat exhaustion, and heat stroke so you can act quickly.',
      htmlTargets: ['#illness', 'Heat-Related Illnesses', 'HEAT STROKE', 'HEAT EXHAUSTION'],
    },
    {
      title: 'Summer Break',
      detail: 'Follow summer safety guidance for children, pets, outdoor work, and heat exposure.',
      htmlTargets: ['#break', 'Summer Break'],
    },
    {
      title: 'Additional Resources',
      detail: 'Open Ready.gov heat safety resource links and partner guidance.',
      htmlTargets: ['#content', 'Additional Resources'],
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
      htmlTargets: ['#cook-safely-without-power'],
    },
    {
      title: 'Use food before it spoils',
      detail: 'Fridge, freezer, pantry order, and when to discard food.',
      htmlTargets: ['#use-food-before-it-spoils'],
    },
    {
      title: 'Low-water cooking',
      detail: 'Meals that conserve water and fuel.',
      htmlTargets: ['#low-water-cooking'],
    },
    {
      title: 'No-cook meals',
      detail: 'Shelf-stable combinations when fire is unsafe.',
      htmlTargets: ['#no-cook-meals'],
    },
  ],

  'foraging-basics': [
    {
      title: 'Do not guess',
      detail: 'Why uncertain plant ID is dangerous and when not to forage.',
      htmlTargets: ['#do-not-guess'],
    },
    {
      title: 'Universal edibility test is not enough',
      detail: 'Why slow testing does not make unknown plants safe.',
      htmlTargets: ['#universal-edibility-test-is-not-enough'],
    },
    {
      title: 'High-risk lookalikes',
      detail: 'Mushrooms, berries, bulbs, hemlock-like plants, and polluted areas.',
      htmlTargets: ['#high-risk-lookalikes'],
    },
    {
      title: 'Safer food priorities',
      detail: 'Prefer stored food, known local plants, fishing, and community knowledge.',
      htmlTargets: ['#safer-food-priorities'],
    },
  ],

  'food-procurement-basics': [
    {
      title: 'Before hunting or fishing',
      detail: 'Legal limits, safety, contamination, humane handling, and energy cost.',
      htmlTargets: ['#before-hunting-or-fishing'],
    },
    {
      title: 'Fishing first',
      detail: 'Why fishing is often safer and more efficient than hunting.',
      htmlTargets: ['#fishing-first'],
    },
    {
      title: 'Animal handling risks',
      detail: 'Parasites, spoilage, bites, disease, and safe cooking temperatures.',
      htmlTargets: ['#animal-handling-risks'],
    },
    {
      title: 'When not to hunt',
      detail: 'Injury risk, ammunition scarcity, noise, legality, and community safety.',
      htmlTargets: ['#when-not-to-hunt'],
    },
  ],

  'personal-safety-conflict': [
    {
      title: 'Avoid becoming a target',
      detail: 'Movement, visibility, valuables, groups, and low-profile behavior.',
      htmlTargets: ['#avoid-becoming-a-target'],
    },
    {
      title: 'De-escalation',
      detail: 'Distance, calm speech, exits, witnesses, and non-provocation.',
      htmlTargets: ['#de-escalation'],
    },
    {
      title: 'Escape planning',
      detail: 'Routes, barriers, safe rooms, alarms, and regroup points.',
      htmlTargets: ['#escape-planning'],
    },
    {
      title: 'After an incident',
      detail: 'Medical check, documentation, police/contact options, and mental recovery.',
      htmlTargets: ['#after-an-incident'],
    },
  ],

  'offline-communications': [
    {
      title: 'First rule: preserve battery',
      detail: 'Airplane mode, low brightness, OLED black UI, power banks, and duty cycles.',
      htmlTargets: ['#first-rule-preserve-battery'],
    },
    {
      title: 'SMS, radio, and meeting points',
      detail: 'Use low-bandwidth channels and pre-agreed physical fallback plans.',
      htmlTargets: ['#sms-radio-and-meeting-points'],
    },
    {
      title: 'Signal methods',
      detail: 'Whistles, mirrors, flashlights, flags, and ground markers.',
      htmlTargets: ['#signal-methods'],
    },
    {
      title: 'Information hygiene',
      detail: 'Avoid rumors, verify before moving, and record trusted updates.',
      htmlTargets: ['#information-hygiene'],
    },
  ],
};

export class GuideService {
  static getSections(packId: string) {
    return GUIDE_SECTIONS[packId] ?? [];
  }

  static getSectionForPage(packId: string, page: number) {
    const sections = this.getSections(packId)
      .filter((section) => typeof section.page === 'number' && section.page <= page)
      .sort((left, right) => (right.page ?? 0) - (left.page ?? 0));
    return sections[0] ?? null;
  }
}
