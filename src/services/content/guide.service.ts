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
      title: 'Home Cures and Popular Beliefs',
      detail: 'When home remedies help, when they harm, and how to test them.',
      page: 48,
    },
    {
      title: 'Sicknesses That Are Often Confused',
      detail: 'Distinguishing between sicknesses with similar signs.',
      page: 64,
    },
    {
      title: 'How to Examine a Sick Person',
      detail: 'Questions, observation, pulse, temperature, and the physical exam.',
      page: 76,
    },
    {
      title: 'How to Take Care of a Sick Person',
      detail: 'Comfort, fluids, food, cleanliness, and when to seek help.',
      page: 86,
    },
    {
      title: 'Healing Without Medicines',
      detail: 'Water therapy and the limits of medicine-free treatment.',
      page: 92,
    },
    {
      title: 'Right and Wrong Use of Modern Medicines',
      detail: 'Guidelines for when and when not to use modern drugs.',
      page: 96,
    },
    {
      title: 'Antibiotics: What They Are and How to Use Them',
      detail: 'Appropriate use, resistance, and limits of antibiotics.',
      page: 102,
    },
    {
      title: 'How to Measure and Give Medicine',
      detail: 'Liquid dosing, children, and how often to take medicines.',
      page: 106,
    },
    {
      title: 'Instructions and Precautions for Injections',
      detail: 'When to inject, dangerous reactions, and sterilising equipment.',
      page: 112,
    },
    {
      title: 'First Aid',
      detail: 'Bleeding, shock, drowning, burns, fractures, poisoning, and snakebite.',
      page: 122,
    },
    {
      title: 'Nutrition: What to Eat to Be Healthy',
      detail: 'Main and helper foods, malnutrition, and diet for specific problems.',
      page: 154,
    },
    {
      title: 'Prevention: How to Avoid Many Sicknesses',
      detail: 'Cleanliness, sanitation, worm prevention, and vaccines.',
      page: 178,
    },
    {
      title: 'Some Very Common Sicknesses',
      detail: 'Dehydration, diarrhea, colds, asthma, headaches, and seizures.',
      page: 198,
    },
    {
      title: 'Serious Illnesses That Need Special Attention',
      detail: 'TB, rabies, tetanus, malaria, dengue, typhoid, and leprosy.',
      page: 226,
    },
    {
      title: 'Skin Problems',
      detail: 'Identification, scabies, lice, fungal infections, ulcers, and eczema.',
      page: 240,
    },
    {
      title: 'The Eyes',
      detail: 'Injuries, infections, cataracts, and vitamin A deficiency.',
      page: 264,
    },
    {
      title: 'The Teeth, Gums, and Mouth',
      detail: 'Cavities, abscesses, pyorrhea, and oral hygiene.',
      page: 276,
    },
    {
      title: 'The Urinary System and the Genitals',
      detail: 'UTIs, kidney stones, STIs, and discharge in women and men.',
      page: 280,
    },
    {
      title: 'Information for Mothers and Midwives',
      detail: 'Pregnancy, birth, and care of the mother after delivery.',
      page: 292,
    },
    {
      title: 'Family Planning',
      detail: 'Methods, effectiveness, side effects, and choosing what fits.',
      page: 330,
    },
    {
      title: 'Health and Sicknesses of Children',
      detail: 'Common childhood diseases, growth, and care of the sick child.',
      page: 342,
    },
    {
      title: 'Health and Sicknesses of Older People',
      detail: 'Chronic disease, dementia, and care at the end of life.',
      page: 370,
    },
    {
      title: 'The Medicine Kit',
      detail: 'Recommended medicines, supplies, and how to use each one.',
      page: 378,
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
      detail:
        'Secure heavy items, make a family plan, and keep supplies ready before shaking starts.',
      htmlTargets: ['#before', 'Prepare Before an Earthquake'],
    },
    {
      title: 'During an Earthquake',
      detail:
        'Drop, cover, and hold on. Stay away from glass, exterior walls, and falling objects.',
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
      detail:
        'Plan cooling options, check insulation, and prepare for heat emergencies before they happen.',
      htmlTargets: ['#prepare', 'Before Extreme Heat'],
    },
    {
      title: 'During Extreme Heat',
      detail:
        'Stay cool, drink water regularly, avoid strenuous activity, and check vulnerable people.',
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

  'disaster-winter-weather': [
    {
      title: 'Understand the alert',
      detail:
        'Know the difference between a winter storm watch, advisory, and warning, and act before the worst hits.',
    },
    {
      title: 'Prepare your home',
      detail:
        'Insulate pipes, test CO and smoke detectors, gather supplies, and protect pets and people with medical needs.',
    },
    {
      title: 'Stay safe during the storm',
      detail:
        'Stay off roads, limit time outside, watch for frostbite and hypothermia, and avoid overexertion when shoveling.',
    },
    {
      title: 'Generator and CO safety',
      detail:
        'Run generators outdoors at least 20 feet from windows, and never heat your home with a gas stovetop or oven.',
    },
    {
      title: 'Recovering after',
      detail:
        'Watch for ice, damaged power lines, and pipes; clear snow safely; and check on neighbors.',
    },
  ],

  'food-preservation-usda': [
    {
      title: 'Key principles',
      detail:
        'A full fridge holds 4 hours, a full freezer holds 48 hours, a half-full freezer holds 24 hours, and never taste food to test safety.',
    },
    {
      title: 'Refrigerated food: save or discard',
      detail:
        'Perishable meat, dairy, and cut produce go after 2 hours above 40°F. Hard cheese, butter, uncut fruit, and condiments often keep.',
    },
    {
      title: 'Frozen food: refreeze or discard',
      detail:
        'Items with ice crystals and a fridge-like temperature are safe to refreeze, with quality loss; otherwise discard.',
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
  'household-readiness': [
    {
      title: 'The 72-hour baseline',
      detail:
        'Start with three days of self-reliance per person, focused on water, medication, power, food, documents, warmth, and communication.',
      htmlTargets: ['#the-72-hour-baseline'],
    },
    {
      title: 'Home kit',
      detail:
        'The core supplies to keep in one place, and why the kit should be checked twice a year.',
      htmlTargets: ['#home-kit'],
    },
    {
      title: 'Go-bag',
      detail:
        'A lighter, grab-and-go set: documents, water, food, medication, power, layers, and a whistle.',
      htmlTargets: ['#go-bag'],
    },
    {
      title: 'Household roles',
      detail:
        'Decide who shuts off utilities, grabs documents, checks people, and contacts the outside fallback contact.',
      htmlTargets: ['#household-roles'],
    },
    {
      title: 'Maintenance rhythm',
      detail:
        'Monthly battery and flashlight checks, twice-yearly rotation, and a post-incident review.',
      htmlTargets: ['#maintenance-rhythm'],
    },
  ],

  'emergency-water': [
    {
      title: 'Priorities',
      detail:
        'Order of preference: sealed water, stored water, safe household water, treated clear water, then treated cloudy water.',
      htmlTargets: ['#priorities'],
    },
    {
      title: 'Storage',
      detail:
        'Clean food-grade containers, cool and dark, away from fuel and chemicals, and labelled with the fill date.',
      htmlTargets: ['#storage'],
    },
    {
      title: 'Finding water at home',
      detail:
        'Water heater, ice cubes, toilet tank (no cleaners), canned food liquid, and rainwater (after treatment).',
      htmlTargets: ['#finding-water-at-home'],
    },
    {
      title: 'Treatment methods',
      detail:
        'Boiling is the most reliable, with filtration, household bleach, and solar disinfection as backups.',
      htmlTargets: ['#treatment-methods'],
    },
    {
      title: 'Rationing',
      detail:
        'Drink enough to think clearly: no-cook food, disposable plates, hand sanitizer for clean hands, and gray water for flushing only.',
      htmlTargets: ['#rationing'],
    },
  ],

  'shelter-evacuation': [
    {
      title: 'Stay or leave',
      detail:
        'Decide whether to shelter in place or evacuate based on hazard type, mobility, medical needs, and road time.',
      htmlTargets: ['#stay-or-leave'],
    },
    {
      title: 'Shelter in place',
      detail:
        'Choose interior, higher ground, or clean-air rooms based on the hazard, and control doors and windows deliberately.',
      htmlTargets: ['#shelter-in-place'],
    },
    {
      title: 'Evacuation route',
      detail:
        'Plan two routes, tell a trusted contact, take documents and medication, and leave early.',
      htmlTargets: ['#evacuation-route'],
    },
    {
      title: 'Cold exposure',
      detail:
        'Stay dry, block wind, insulate from the ground, and warm severely hypothermic people slowly.',
      htmlTargets: ['#cold-exposure'],
    },
    {
      title: 'Heat and smoke',
      detail:
        'Heat stroke is an emergency; for smoke, close up, reduce exertion, and use a well-fitting respirator.',
      htmlTargets: ['#heat-and-smoke'],
    },
  ],

  'emergency-power': [
    {
      title: 'Power priorities',
      detail:
        'Rank devices before the outage: medical, communication, light, navigation, then comfort.',
      htmlTargets: ['#power-priorities'],
    },
    {
      title: 'Phone discipline',
      detail:
        'Airplane mode, low brightness, battery saver, and short scheduled check-ins instead of constant signal searching.',
      htmlTargets: ['#phone-discipline'],
    },
    {
      title: 'Power banks',
      detail:
        'Label banks by role, recharge monthly, and confirm cables match every device you depend on.',
      htmlTargets: ['#power-banks'],
    },
    {
      title: 'Generators and combustion',
      detail:
        'Outdoors only, away from openings, and use a battery CO detector; headache or confusion means move to fresh air.',
      htmlTargets: ['#generators-and-combustion'],
    },
    {
      title: 'Solar and vehicle charging',
      detail:
        'Solar tops up banks slowly; vehicle charging is useful but watch fuel level and CO risk.',
      htmlTargets: ['#solar-and-vehicle-charging'],
    },
  ],

  'emergency-cooking': [
    {
      title: 'Safety first',
      detail:
        'Carbon monoxide is the main cooking danger; keep flames and generators outdoors and away from openings.',
      htmlTargets: ['#safety-first'],
    },
    {
      title: 'Food order',
      detail:
        'Open, then fridge, then freezer, then pantry, then emergency reserve; never taste to test safety.',
      htmlTargets: ['#food-order'],
    },
    {
      title: 'Low-fuel cooking',
      detail:
        'One-pot meals, soaked grains, smaller cuts, lids, and retained-heat cooking all save fuel.',
      htmlTargets: ['#low-fuel-cooking'],
    },
    {
      title: 'Low-water cooking',
      detail:
        'Reuse pasta or potato water, steam when you can, and choose couscous, oats, and canned food over long-boil grains.',
      htmlTargets: ['#low-water-cooking'],
    },
    {
      title: 'No-cook meals',
      detail:
        'Shelf-stable combinations: nut butter, canned protein, dried fruit, bars, and ready-to-eat soups safe cold.',
      htmlTargets: ['#no-cook-meals'],
    },
  ],

  'foraging-basics': [
    {
      title: 'Do not guess',
      detail:
        'A confident app result is not field ID; never eat a wild plant or mushroom on a single photo or vague memory.',
      htmlTargets: ['#do-not-guess'],
    },
    {
      title: 'Why apps are not enough',
      detail:
        'Safety depends on species, season, plant part, lookalikes, soil, contamination, and individual allergies.',
      htmlTargets: ['#why-apps-are-not-enough'],
    },
    {
      title: 'Better emergency food order',
      detail:
        'Stored food, community food, known local sources, familiar fishing, expert-confirmed wild plants, then last-resort unknowns.',
      htmlTargets: ['#better-emergency-food-order'],
    },
    {
      title: 'High-risk groups',
      detail:
        'Avoid mushrooms, unknown berries, bulbs, milky-sap plants, bitter-almond smells, and road-side greens.',
      htmlTargets: ['#high-risk-groups'],
    },
  ],

  'personal-safety-conflict': [
    {
      title: 'Avoid becoming a target',
      detail:
        'Move with purpose, keep valuables hidden, and leave early when the atmosphere changes.',
      htmlTargets: ['#avoid-becoming-a-target'],
    },
    {
      title: 'De-escalation',
      detail:
        'The goal is to leave safely: distance, calm short sentences, open hands, and no insults or challenges.',
      htmlTargets: ['#de-escalation'],
    },
    {
      title: 'Home and shelter exits',
      detail:
        'Two ways out of every room, shoes and keys by the bed, and a rally point outside the building.',
      htmlTargets: ['#home-and-shelter-exits'],
    },
    {
      title: 'Documentation',
      detail:
        'Time, place, people, statements, injuries, witnesses, and photos only if safe; do not chase a second confrontation.',
      htmlTargets: ['#documentation'],
    },
    {
      title: 'When to seek help',
      detail:
        'Use emergency services, shelter staff, and trusted contacts when safe, and check for injuries after the adrenaline crash.',
      htmlTargets: ['#when-to-seek-help'],
    },
  ],

  'offline-communications': [
    {
      title: 'Before networks fail',
      detail:
        'Write the plan: outside contact, meeting points, pickup plan, medical contacts, and a messaging fallback.',
      htmlTargets: ['#before-networks-fail'],
    },
    {
      title: 'Battery discipline',
      detail:
        'Airplane mode, low brightness, scheduled check-in windows, and short text messages over voice calls.',
      htmlTargets: ['#battery-discipline'],
    },
    {
      title: 'Message format',
      detail:
        'Answer who is safe, where you are, where you are going, what you need, and when you will check again.',
      htmlTargets: ['#message-format'],
    },
    {
      title: 'Physical signaling',
      detail:
        'Whistle, flashlight patterns at night, bright fabric and mirrors in daylight, and only when safe and visible.',
      htmlTargets: ['#physical-signaling'],
    },
    {
      title: 'Information hygiene',
      detail:
        'Treat unverified messages as leads; record source and time, and do not forward warnings you cannot verify.',
      htmlTargets: ['#information-hygiene'],
    },
  ],

  'sanitation-principles': [
    {
      title: 'Priorities',
      detail:
        'Clean hands, safe drinking water, separated waste, safe food handling, and pest control in that order.',
      htmlTargets: ['#priorities'],
    },
    {
      title: 'Hand hygiene',
      detail:
        'Soap and water when possible; sanitizer only when hands are not visibly dirty, and always after toilet or waste contact.',
      htmlTargets: ['#hand-hygiene'],
    },
    {
      title: 'Toilet failure',
      detail:
        'Separate liquids and solids, cover solids with dry material, seal full bags, and keep waste zones downwind of food.',
      htmlTargets: ['#toilet-failure'],
    },
    {
      title: 'Cleaning',
      detail:
        'Clean first, disinfect second; use gloves and separate tools for kitchen and cleanup; assume floodwater is contaminated.',
      htmlTargets: ['#cleaning'],
    },
    {
      title: 'Waste zones',
      detail:
        'Clean, dirty, and transition zones; do not let dirty tools, shoes, or hands migrate into clean areas.',
      htmlTargets: ['#waste-zones'],
    },
  ],

  'health-continuity': [
    {
      title: 'Personal medical card',
      detail:
        'A short card per person: conditions, allergies, medications, doses, prescribers, pharmacy, and accessibility needs.',
      htmlTargets: ['#personal-medical-card'],
    },
    {
      title: 'Medication buffer',
      detail:
        'A small rotating buffer of critical medication, and a clinician plan for missed doses.',
      htmlTargets: ['#medication-buffer'],
    },
    {
      title: 'Cold-chain medication',
      detail:
        'A small cooler, gel packs, a thermometer, and a written safe range; do not freeze unless the label allows it.',
      htmlTargets: ['#cold-chain-medication'],
    },
    {
      title: 'Devices and power',
      detail:
        'CPAP, nebulizer, oxygen, mobility, hearing, glucose, and phone medical apps — each needs a real backup plan.',
      htmlTargets: ['#devices-and-power'],
    },
    {
      title: 'Wounds and infection',
      detail:
        'Clean with safe water, cover with clean dressings, and seek help for deep wounds, bites, dirty punctures, or spreading infection.',
      htmlTargets: ['#wounds-and-infection'],
    },
    {
      title: 'Mental load',
      detail:
        'Use routines: hydration, food, medication, rest shifts, check-ins, and written plans protect people when judgment is degraded.',
      htmlTargets: ['#mental-load'],
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
