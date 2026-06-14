import type { ContentCategory } from '@/types/content';

type AuthoredGuide = {
  title: string;
  description: string;
  category: ContentCategory;
  content: string;
  format: 'html' | 'markdown';
};

export const AUTHORED_GUIDES: Record<string, AuthoredGuide> = {
  'household-readiness': {
    title: 'Household Readiness & Go-Bag',
    description:
      'A practical baseline for normal people: water, food, documents, power, medicine, and exits.',
    category: 'Preparedness',
    format: 'markdown',
    content: `A practical baseline for normal people: water, food, documents, power, medicine, and exits.

## The 72-hour baseline
Start with three days of self-reliance for each person. This is not a bunker plan; it is the minimum buffer for outages, storms, transport failures, floods, fires, and short evacuations.

Prioritize:

1. Drinking water
2. Medication and first aid
3. Phone power and light
4. Shelf-stable food
5. Documents and cash
6. Warmth, rain protection, and clean clothing
7. Communication plan

Do not build a kit full of gadgets before solving water, medication, documents, and power.

## Home kit
Keep these in one known place:

- Water for drinking and basic hygiene
- Food that needs little or no cooking
- Manual can opener
- Flashlights or headlamps, not candles as the main light source
- Power banks and charging cables
- Basic first aid supplies and personal medication
- Copies of ID, insurance, prescriptions, contacts, and key documents
- Cash in small notes
- Hygiene supplies, toilet paper, bags, soap, and disinfecting wipes
- N95 or similar masks for smoke, dust, and cleanup
- Pet, baby, accessibility, or elder-care supplies if relevant

Review it twice a year. Replace expired food, medication, batteries, and water.

## Go-bag
A go-bag is for leaving fast. Keep it lighter than you think:

- Water bottle and purification backup
- One day of no-cook food
- Phone cable, small power bank, and wall plug
- Headlamp
- Copies of critical documents
- Medication list and at least a short medication buffer if possible
- Basic first aid
- Warm layer, rain layer, socks
- Whistle and small notebook

A bag that is too heavy to grab and carry is not useful.

## Household roles
Before an emergency, decide who does what:

- Who checks people and pets
- Who shuts off stove, water, electricity, or gas if needed
- Who grabs documents and medication
- Who contacts the outside fallback person
- Where everyone meets if separated

Write the plan down. During stress, memory gets worse.

## Maintenance rhythm
Once per month: charge power banks and test flashlights.

Twice per year: rotate food and water, review documents, update contacts, check medication expiry, and confirm meeting points.

After every real incident: write what failed and fix only the highest-impact gap first.
`,
  },

  'emergency-water': {
    title: 'Emergency Water: Store, Find, Treat',
    description: 'Water priorities for outages, boil advisories, damaged pipes, and evacuation.',
    category: 'Water',
    format: 'markdown',
    content: `Water priorities for outages, boil advisories, damaged pipes, and evacuation.

## Priorities
In most short emergencies, stored water beats improvised water. Your order of preference is:

1. Sealed bottled water
2. Water stored before the event in clean containers
3. Water from a safe household source before pipes are contaminated
4. Treated clear water
5. Treated cloudy water
6. Untreated natural water only as a last resort

Floodwater is never safe drinking water. Do not treat water contaminated by fuel, sewage, industrial chemicals, pesticides, or saltwater with normal household methods and assume it is safe.

## Storage
Store water in clean, food-grade containers. Keep it sealed, cool, dark, and away from fuel, solvents, pesticides, and strong-smelling chemicals.

A practical minimum is enough drinking water for three days. Add more for heat, illness, pets, infants, cooking, and hygiene.

Label containers with the fill date. Rotate if the container is not commercially sealed.

## Finding water at home
Before pipes are damaged or contaminated, safe sources may include:

- Water heater tank, if safe to access
- Melted ice cubes
- Toilet tank water only if the tank is clean and has no chemical cleaners
- Canned food liquid
- Rainwater collected in clean containers, after treatment

Do not use water from radiators, boilers, swimming pools, floodwater, or chemical-contaminated sources for drinking.

## Treatment methods
Treatment depends on the risk:

- Boiling is the most reliable household method for biological contamination.
- Filtering can remove sediment and improve taste, but many filters do not remove viruses or chemicals.
- Disinfection tablets or unscented household bleach can help when used exactly as directed.
- Solar disinfection is a last-resort method for clear water and strong sunlight, not a first choice.

If water is cloudy, let it settle and filter through clean cloth before boiling or disinfecting. Sediment protects microbes from disinfectant.

## Rationing
Do not stop drinking water to preserve supplies. Dehydration breaks judgment quickly.

Reduce water use by:

- Eating no-cook food
- Using disposable plates if available
- Cleaning hands with soap and minimal water or sanitizer when hands are not visibly dirty
- Saving gray water for flushing, never for drinking

Use Ark's notes to track water inventory by container, date, and estimated days remaining.
`,
  },

  'shelter-evacuation': {
    title: 'Shelter, Evacuation & Exposure',
    description:
      'Decide whether to stay, leave, or shelter in place, then control heat, cold, and smoke exposure.',
    category: 'Survival',
    format: 'markdown',
    content: `Decide whether to stay, leave, or shelter in place, then control heat, cold, and smoke exposure.

## Stay or leave
Do not treat evacuation as failure. Leaving early is often safer than improvising later.

Leave early when:

- Authorities tell you to evacuate
- Fire, flood, chemical release, violence, or structural damage is nearby
- Medical equipment, medication, heat, cold, or oxygen needs cannot be maintained
- Roads may close soon
- You have children, elderly people, pets, or mobility constraints that make late evacuation harder

Shelter in place when leaving would put you directly into the hazard and the building is still safe.

## Shelter in place
Choose an interior room if wind, debris, or civil danger is outside. Choose higher ground for flooding unless the building itself is unsafe. Choose a cleaner-air room for smoke or chemical risk.

Set up:

- Water, food, medication, first aid
- Charged phone and power bank
- Flashlight
- Radio or saved information source
- Shoes and gloves
- Waste bags and hygiene supplies
- Door or window control based on the hazard

Do not tape yourself into a room without understanding the hazard. Fire smoke, heat, carbon monoxide, and chemical fumes require different responses.

## Evacuation route
Plan two routes: the obvious route and the route that avoids the obvious bottleneck.

Before leaving:

- Tell one trusted person where you are going
- Take documents, medication, phone power, water, cash, and keys
- Dress for walking, not just driving
- Avoid flooded roads, smoke plumes, unstable buildings, and downed power lines

If driving, leave earlier than feels necessary. Late evacuation turns roads into traps.

## Cold exposure
Cold injuries happen faster with wind, wet clothing, exhaustion, and alcohol.

Priorities:

1. Stay dry
2. Block wind
3. Insulate from the ground
4. Keep head, hands, and feet warm
5. Eat and drink enough

Warm people slowly. Do not rub frostbitten skin. Do not place a severely hypothermic person in a hot shower.

## Heat and smoke
Heat illness and smoke exposure are common in outages, fires, and summer disasters.

For heat: rest, shade, airflow, wet cloths, light clothing, and regular drinking. Heat stroke is an emergency: confusion, collapse, very high body temperature, or stopped sweating require urgent cooling and help.

For smoke: close windows and doors, use the cleanest room, reduce exertion, and use a well-fitting respirator if you must move through smoke. Cloth masks do not protect well against fine smoke particles.
`,
  },

  'emergency-power': {
    title: 'Emergency Power & Battery Discipline',
    description:
      'Keep phones, lights, radios, medical devices, and critical information alive during outages.',
    category: 'Preparedness',
    format: 'markdown',
    content: `Keep phones, lights, radios, medical devices, and critical information alive during outages.

## Power priorities
Rank devices before the outage:

1. Medical devices
2. Phone or radio communication
3. Light
4. Navigation and stored documents
5. Small comfort devices

Do not spend battery on entertainment until medical, communication, and lighting needs are stable.

## Phone discipline
Your phone is a radio, map, document wallet, flashlight, camera, notebook, and AI reference. Treat it like critical equipment.

Use:

- Airplane mode most of the time
- Low brightness
- Battery saver
- OLED dark mode
- Downloaded maps and references before the outage
- Short scheduled check-ins instead of constant signal searching

Searching for weak cellular signal can drain a battery fast.

## Power banks
Keep at least one charged power bank. Larger households should label banks by role: medical, phones, lights, spare.

Every month:

- Recharge power banks
- Test cables
- Check USB-C, Lightning, and adapter needs
- Confirm medical-device connectors

A full power bank with the wrong cable is dead weight.

## Generators and combustion
Generators, grills, camping stoves, and charcoal produce carbon monoxide.

Never run them indoors, in garages, on balconies, under windows, or near doors. Keep them outside and far from openings. Use a battery-powered carbon monoxide detector.

If someone has headache, dizziness, weakness, confusion, vomiting, or chest pain near combustion equipment, move to fresh air immediately and seek emergency help.

## Solar and vehicle charging
Solar chargers are useful but slow and weather-dependent. Use them to top up power banks, not as your only plan.

Vehicle charging can help, but avoid carbon monoxide risk from idling near enclosed spaces. Watch fuel level and local safety conditions.
`,
  },

  'emergency-cooking': {
    title: 'Emergency Cooking Without Power',
    description: 'Cook safely, conserve fuel, and avoid food poisoning when the grid is down.',
    category: 'Food',
    format: 'markdown',
    content: `Cook safely, conserve fuel, and avoid food poisoning when the grid is down.

## Safety first
Carbon monoxide is the main cooking danger during outages. Never use camping stoves, charcoal grills, hibachis, gasoline generators, or propane grills indoors, in garages, under balconies, or beside open windows.

If you cannot ventilate safely, switch to no-cook meals.

Keep a fire extinguisher nearby. Keep flames away from curtains, walls, plastic, bedding, and children. Never leave a flame unattended.

## Food order
Use food in this order:

1. Food that is already open or perishable
2. Refrigerator food while still cold
3. Freezer food while still frozen or partly frozen
4. Shelf-stable food
5. Emergency no-cook reserve

Do not taste questionable food to test it. Smell, taste, and appearance are not reliable safety checks.

## Low-fuel cooking
Fuel is usually scarcer than ingredients. Save it by:

- Cooking one-pot meals
- Soaking beans, lentils, oats, and grains before heating
- Cutting food smaller
- Keeping lids on pots
- Using retained heat: bring to boil, cover, insulate, and wait
- Making hot drinks and soup in the same heating cycle

Avoid recipes that need long simmering unless you have a safe, abundant fuel source.

## Low-water cooking
When water is limited:

- Use canned food liquid in soups or rice
- Steam instead of boil when possible
- Reuse pasta or potato water in soups
- Choose couscous, oats, tortillas, crackers, and canned food over long-boil grains
- Wipe dishes before washing

Never conserve water by undercooking risky food.

## No-cook meals
Keep some meals that need no electricity, flame, or clean dishes:

- Nut butter with crackers or tortillas
- Canned tuna, chicken, beans, or lentils
- Dried fruit and nuts
- Protein bars
- Shelf-stable milk or meal drinks
- Ready-to-eat soups or meals that are safe cold

Keep a manual can opener with the food, not somewhere else.
`,
  },

  'foraging-basics': {
    title: 'Foraging Risk & Poison Avoidance',
    description:
      'A conservative guide to why wild-food identification is usually the wrong emergency plan.',
    category: 'Food',
    format: 'markdown',
    content: `A conservative guide to why wild-food identification is usually the wrong emergency plan.

## Do not guess
Plant and mushroom misidentification can be fatal. Never eat a wild plant or fungus based on a single photo, app result, vague memory, or AI answer.

Ark can store references. It cannot prove a plant is safe in your specific region, season, growth stage, or contamination context.

## Why apps are not enough
Wild-food safety depends on details that are easy to miss:

- Exact species, not just common name
- Season and growth stage
- Plant part: leaf, root, seed, berry, flower, bark
- Preparation method
- Lookalikes in the same area
- Soil, road, pesticide, sewage, or industrial contamination
- Individual allergy or medication interactions

A confident-looking answer is not the same as field identification.

## Better emergency food order
Use this order instead:

1. Stored food
2. Community food distribution or shops if available
3. Known local food sources you already use
4. Fishing only if legal, safe, and already familiar
5. Wild plants only with local expert confirmation
6. Unknown wild plants only in absolute starvation conditions

Going hungry for one more meal is safer than poisoning your group.

## High-risk groups
Avoid these unless you already have strong local expertise:

- Mushrooms
- Umbrella-shaped white-flower plants
- Unknown berries
- Bulbs and roots
- Wild greens near roads or polluted water
- Plants with milky sap, bitter almond smell, or unknown seeds

Do not give unknown wild food to children, pregnant people, sick people, or pets.
`,
  },

  'personal-safety-conflict': {
    title: 'Personal Safety & Conflict Avoidance',
    description: 'Avoid danger, de-escalate conflict, and plan safe exits.',
    category: 'Safety',
    format: 'markdown',
    content: `Avoid danger, de-escalate conflict, and plan safe exits.

## Avoid becoming a target
Most safety work happens before confrontation.

Reduce risk by:

- Moving with purpose
- Keeping valuables and supplies out of sight
- Avoiding arguments around queues, fuel, water, transport, and damaged property
- Staying near light, witnesses, and exits when possible
- Leaving early when the atmosphere changes
- Keeping your phone available but not visibly distracting

Do not advertise supplies, routes, money, generator fuel, medication, or tools.

## De-escalation
If a confrontation starts, the goal is to leave safely, not to win.

Use:

- Distance
- Calm, short sentences
- Open hands
- Non-threatening posture
- Exit-focused movement
- No insults, sarcasm, or challenges

You can acknowledge emotion without agreeing to unsafe demands: "I hear you. I am leaving now."

## Home and shelter exits
Know two ways out of any home, shelter, room, or building. Avoid letting furniture, boxes, or locked gates block them.

At night, keep shoes, light, phone, keys, and glasses in the same place.

If staying with others, agree on a rally point outside the building and another farther away.

## Documentation
After an incident, write down:

- Time and place
- Who was involved
- What was said and done
- Injuries or damage
- Witnesses
- Photos if safe

Do not risk a second confrontation to collect evidence.

## When to seek help
Use emergency services, building security, shelter staff, local authorities, medical help, or trusted community contacts when available and safe.

After acute stress, check for injuries, drink water, rest, and avoid major decisions until the adrenaline crash passes.
`,
  },

  'offline-communications': {
    title: 'Offline Communications',
    description: 'Preserve battery, use low-bandwidth channels, and signal when networks fail.',
    category: 'Comms',
    format: 'markdown',
    content: `Preserve battery, use low-bandwidth channels, and signal when networks fail.

## Before networks fail
Write down the plan while everything works:

- Main contact person outside the affected area
- Local meeting point
- Distant fallback meeting point
- School, work, elder-care, and pet pickup plan
- Medical and pharmacy contacts
- Radio channel or messaging fallback if your group uses one

Store it in Ark and on paper.

## Battery discipline
Do not leave the phone hunting for signal.

Use airplane mode, low brightness, battery saver, and short check-in windows. Example: turn radios on for five minutes each hour, send/receive, then turn them off again.

Text messages often work when calls fail. Keep messages short and factual.

## Message format
Useful emergency messages answer:

- Who is safe or injured
- Where you are
- Where you are going
- What you need
- When you will check again

Example: "All safe. At north school entrance. Going to aunt's house by 18:00 if roads open. Need insulin pickup. Next check 19:00."

## Physical signaling
Carry a whistle. Three blasts is a distress signal.

At night, use repeated flashlight signals. In daylight, use bright fabric, mirrors, or large ground markers only when safe and visible.

Make signals simple. A confused signal wastes time.

## Information hygiene
Rumors become dangerous during emergencies. Treat unverified messages as leads, not facts.

Record source and time: who said it, when, and how they know. Do not forward warnings unless they are official, firsthand, or clearly labeled as unverified.
`,
  },

  'sanitation-principles': {
    title: 'Emergency Sanitation Principles',
    description: 'Prevent disease when water and sewer systems are offline.',
    category: 'Water',
    format: 'markdown',
    content: `Prevent disease when water and sewer systems are offline.

## Priorities
Sanitation is not comfort; it prevents disease.

Focus on:

1. Clean hands
2. Safe drinking water
3. Separating waste from living areas and water
4. Safe food handling
5. Controlling flies, rodents, and contaminated surfaces

## Hand hygiene
Use soap and safe water whenever possible. If water is scarce, use a small bottle, tippy tap, or controlled pour.

Hand sanitizer helps when hands are not visibly dirty, but it does not replace washing after toilet use, cleanup, diapers, raw food, or contact with waste.

## Toilet failure
If toilets cannot flush, separate liquid and solid waste when possible.

- Liquids: collect separately and dispose where they will not enter drinking water, living areas, or food areas.
- Solids: use a lined bucket, cover after each use with dry material, seal full bags, and store away from people and animals until proper disposal is possible.

Keep toilet areas downwind and away from food preparation.

## Cleaning
Clean first, disinfect second. Dirt and organic material weaken disinfectants.

Use gloves if available. Keep cleanup tools separate from kitchen tools. Wash hands after removing gloves.

For floodwater, sewage, vomit, blood, or animal waste, assume contamination and protect skin, eyes, and wounds.

## Waste zones
Create three zones:

- Clean zone: sleeping, eating, medical supplies, drinking water
- Dirty zone: toilet, trash, contaminated clothes, cleanup tools
- Transition zone: handwashing, shoe removal, disinfecting supplies

Do not let dirty tools migrate into clean areas.
`,
  },

  'health-continuity': {
    title: 'Medication & Health Continuity',
    description:
      'Keep critical care, medication, devices, and medical information usable during disruption.',
    category: 'Health',
    format: 'markdown',
    content: `Keep critical care, medication, devices, and medical information usable during disruption.

## Personal medical card
Create a short medical card for each person:

- Name and date of birth
- Emergency contacts
- Conditions
- Allergies
- Medication names, doses, and timing
- Prescribing clinician or clinic
- Pharmacy
- Insurance or health-system number if relevant
- Assistive devices and accessibility needs

Store it in Ark and on paper.

## Medication buffer
When possible, keep a small buffer of critical medication. Rotate it so the oldest is used first.

Ask a pharmacist or clinician how to handle missed doses before an emergency. Do not improvise dose changes for blood pressure, seizure, insulin, anticoagulant, psychiatric, heart, or steroid medication unless you have medical guidance.

## Cold-chain medication
Some medication needs refrigeration. Plan for:

- A small cooler
- Gel packs or frozen water bottles
- A thermometer
- Written safe temperature range
- Backup pickup location if evacuation is likely

Do not freeze medication unless the label says it can be frozen.

## Devices and power
List devices that need electricity: CPAP, nebulizer, oxygen concentrator, mobility equipment, hearing aids, glucose monitor, phone-based medical apps.

Match each device to a backup: battery, inverter, generator, clinic, shelter, neighbor, or evacuation destination.

## Wounds and infection
Clean wounds with safe water. Cover with clean dressings. Seek help for deep wounds, animal bites, dirty punctures, burns, spreading redness, pus, fever, numbness, or loss of function.

Do not close a dirty deep wound yourself.

## Mental load
Emergencies worsen sleep, pain, anxiety, addiction risk, conflict, and decision fatigue. Use routines: hydration, food, medication, rest shifts, check-ins, and written plans.

A calm checklist is not overkill. It protects people when judgment is degraded.
`,
  },
};
