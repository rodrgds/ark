import type { ContentCategory } from '@/types/content';

type AuthoredGuide = {
  title: string;
  description: string;
  category: ContentCategory;
  content: string;
  format: 'html' | 'markdown';
};

export const AUTHORED_GUIDES: Record<string, AuthoredGuide> = {
  'emergency-cooking': {
    title: 'Emergency Cooking Without Power',
    description: 'Cook safely, conserve fuel, and avoid food poisoning when the grid is down.',
    category: 'Food',
    format: 'markdown',
    content: `Cook safely, conserve fuel, and avoid food poisoning when the grid is down.

## Cook safely without power
**Carbon monoxide (CO) is the silent killer.** Never use camping stoves, charcoal grills, hibachis, or gasoline generators indoors or in enclosed spaces such as garages, basements, or tents. CO is odorless, colorless, and deadly.

**Approved indoor options:** A fireplace with proper ventilation, a wood stove, or a fondue/canned-heat burner in a very well-ventilated room. Keep a battery-powered CO detector nearby.

**Fuel choices:** Butane canisters work well in camp stoves but require ventilation. Propane is common for outdoor grills. White gas and kerosene are efficient but flammable; store away from heat sources. Alcohol (denatured or HEET) is safer indoors in small amounts with cross-ventilation.

**Fire safety:** Keep a fire extinguisher or baking soda nearby. Never leave an open flame unattended. Place stoves on stable, non-flammable surfaces away from walls and curtains.

## Use food before it spoils
**Refrigerator:** Keep the door closed. A full fridge stays cold about 4 hours; a half-full one about 2–3 hours. Use a thermometer: discard perishables above 40°F (4°C) for more than 2 hours.

**Freezer:** A full freezer holds temperature ~48 hours if unopened; a half-full one ~24 hours. Group frozen items together. If ice crystals remain, the food is usually safe to refreeze or cook.

**Pantry triage:** Eat perishables first, then refrigerated, then frozen, then shelf-stable. "When in doubt, throw it out" is the safest rule for meat, dairy, eggs, and prepared foods.

**Signs of spoilage:** Unusual odor, color, texture, or swelling in cans. Do not taste questionable food.

## Low-water cooking
Water may be scarce. Conserve it with these methods:

- **One-pot meals:** Combine grains, legumes, and vegetables in a single pot to reduce water and fuel use.
- **Steaming:** Uses less water than boiling and preserves more nutrients.
- **Soaking:** Soak dried beans and lentils for several hours before cooking to reduce boiling time.
- **Pasta water reuse:** If you boil pasta, reuse the starchy water to start soups or cook rice.
- **Sun cooking:** A solar oven or reflective cooker can pasteurize water and cook grains on sunny days with no fuel.

## No-cook meals
When fire is unsafe or fuel is gone, these combinations require no heat:

- Canned tuna or chicken with crackers
- Peanut butter on tortillas or bread
- Dried fruits, nuts, and granola
- Ready-to-eat canned beans (rinse to reduce sodium)
- Protein bars, jerky, and shelf-stable cheese
- Overnight oats soaked in safe drinking water

Keep a 3-day supply of no-cook options as your last-resort food layer.
`,
  },

  'foraging-basics': {
    title: 'Foraging Basics & Poison Avoidance',
    description: 'Principles and risks of gathering wild food in emergencies.',
    category: 'Food',
    format: 'markdown',
    content: `Principles and risks of gathering wild food in emergencies.

## Do not guess
Plant and mushroom misidentification can be fatal. **Never consume a wild plant or fungus based on a single photo, app description, or memory.** Local experts, regional field guides, and long-term community knowledge are the only safe sources of identification.

Ark provides general principles only. It cannot positively identify plants or mushrooms for your specific region, season, or growing conditions.

## Universal edibility test is not enough
The classic "universal edibility test" (contact, lip, chew, swallow in small increments over 24 hours) does not protect against:

- Delayed toxins that appear days later
- Cumulative poisons that build with repeated meals
- Individual allergic reactions
- Contaminants absorbed from polluted soil or water

It is a last-resort framework for absolute starvation scenarios, not a safety guarantee.

## High-risk lookalikes
Some of the most dangerous groups include:

- **Mushrooms:** Deadly amanitas can resemble edible puffballs or meadow mushrooms when young.
- **Berries:** Elderberries are safe cooked but toxic raw; they resemble other red/purple berries.
- **Roots and bulbs:** Water hemlock (deadly) and wild carrot (edible) have similar white flowers and root shapes.
- **Leaves:** Foxglove leaves look like comfrey or sage; foxglove is deadly.
- **Polluted areas:** Plants near roads, industrial sites, or pesticide runoff can concentrate heavy metals and chemicals.

## Safer food priorities
In an emergency, use this hierarchy to minimize risk:

1. **Stored food** — shelf-stable, known, and safe
2. **Fishing** — fish are usually easier to identify than plants
3. **Known local plants** — ones you have positively identified with local experts before the emergency
4. **Community knowledge** — experienced foragers in your area
5. **Wild plants as a last resort** — only when all other options are exhausted

When in doubt, go hungry for one more meal rather than risk poisoning.
`,
  },

  'food-procurement-basics': {
    title: 'Fishing, Hunting & Food Procurement Basics',
    description: 'Legal, ethical, and safe approaches to acquiring food in the field.',
    category: 'Food',
    format: 'markdown',
    content: `Legal, ethical, and safe approaches to acquiring food in the field.

## Before hunting or fishing
Check local laws, licenses, and seasonal limits. In a declared emergency some rules may be suspended, but until then, poaching carries legal penalties and conservation harm. Know your weapon or tackle thoroughly before you rely on it for food.

**Energy cost:** Hunting large game burns thousands of calories. Unless you are experienced and equipped, fishing and trapping are usually more energy-efficient.

## Fishing first
Fishing is generally safer and more efficient than hunting for unprepared individuals. Effective passive methods include:

- Bank lines left overnight
- Minnow traps made from bottles or wire
- Handlines with hooks and bait (worms, insects, scraps)
- Spearfishing in very clear, shallow water

Harvest only what you can eat or safely preserve. Release spawning fish when possible.

## Animal handling risks
Wild game carries risks that supermarket meat does not:

- **Parasites:** Trichinosis in wild pigs and bears; tapeworms in ungulates. Freeze or cook thoroughly.
- **Spoilage:** Warm temperatures spoil meat within hours. Field dress immediately and cool the carcass.
- **Disease:** Rabies, tularemia, and chronic wasting disease (CWD) exist in some regions. Wear gloves when gutting; avoid nervous tissue if CWD is present locally.
- **Safe cooking:** Cook all wild game to an internal temperature of 160°F (71°C). Bring stews and braises to a rolling boil.

## When not to hunt
Avoid hunting when:

- You lack proper equipment or ammunition
- You are injured, ill, or alone without rescue backup
- Weapon noise would reveal your position in an unsafe area
- You do not know how to field dress, cool, and preserve the meat
- Local regulations prohibit it

Scavenging already-dead animals is extremely risky due to spoilage and disease. Do not attempt it.
`,
  },

  'personal-safety-conflict': {
    title: 'Personal Safety & Conflict Avoidance',
    description: 'Avoid danger, de-escalate conflict, and plan safe exits.',
    category: 'Safety',
    format: 'markdown',
    content: `Avoid danger, de-escalate conflict, and plan safe exits.

## Avoid becoming a target
Most confrontations can be prevented by reducing your visibility as a victim:

- **Situational awareness:** Keep your head up, scan exits, and notice who is around you. Avoid staring at your phone in public.
- **Predictability:** Vary your routes and times if traveling in uncertain areas.
- **Valuables:** Keep expensive gear, jewelry, and electronics concealed.
- **Groups:** Travel with others when possible; isolation increases risk.
- **Low profile:** Dress neutrally, avoid loud conversations about supplies or plans, and do not display weapons.

## De-escalation
If a confrontation begins, your goal is to exit safely, not to win. Techniques:

- **Distance:** Increase physical distance immediately. Do not let someone close your exit.
- **Calm speech:** Speak slowly and softly. Acknowledge the other person's emotion without agreeing to demands that put you at risk.
- **Open hands:** Keep palms visible and avoid sudden movements.
- **Exits:** Point yourself toward an exit, not a corner. Look for witnesses or well-lit areas.
- **Non-provocation:** Do not insult, challenge, or threaten. Humiliation often triggers violence.

## Escape planning
Plan before you need it:

- Identify at least two exits from every room or building you enter.
- Choose a safe room in your home: solid door, lock, phone or radio, and a planned secondary exit.
- Set up improvised alarms: cans on a string, door wedges, or battery-powered motion sensors.
- Agree on rally points with your group: one nearby, one farther away.
- Keep a small "go-bag" near exits with ID, keys, phone, flashlight, and basic first aid.

## After an incident
Your safety continues after the immediate threat ends:

- **Medical check:** Adrenaline can mask injuries. Inspect yourself and others for wounds, sprains, or shock signs.
- **Documentation:** Write down what happened, when, where, and descriptions while memory is fresh.
- **Authorities:** Contact local emergency services if available and safe to do so.
- **Mental recovery:** Acute stress reactions are normal. Talk to someone you trust, rest, and hydrate. Seek professional support if symptoms persist.
`,
  },

  'offline-communications': {
    title: 'Offline Communications',
    description: 'Preserve battery, use low-bandwidth channels, and signal when networks fail.',
    category: 'Comms',
    format: 'markdown',
    content: `Preserve battery, use low-bandwidth channels, and signal when networks fail.

## First rule: preserve battery
Your phone is your most versatile tool. Extend its life:

- Switch to airplane mode and only toggle radios on briefly to send or check messages.
- Reduce screen brightness to the minimum usable level.
- Use OLED black themes where possible (every black pixel saves power on OLED screens).
- Disable vibration, Bluetooth, and location services when not needed.
- Carry a fully charged power bank and a solar charger if available.
- Duty-cycle: turn the phone on for 5 minutes every hour rather than leaving it on continuously.

## SMS, radio, and meeting points
When voice calls fail, try these lower-bandwidth channels:

- **SMS text:** Often succeeds when voice networks are overloaded because it needs only a moment of signal.
- **FRS/GMRS radios:** Inexpensive, no license required in many regions for FRS. Range is short (1–2 km), but useful for group coordination.
- **Amateur (ham) radio:** Requires a license in normal times, but emergency traffic is usually permitted. Much longer range with repeaters.
- **Pre-agreed plans:** Designate primary and fallback meeting points with times. If no contact by the set time, proceed to the fallback.

## Signal methods
When electronic communication is impossible, use physical signals:

- **Whistle:** Three blasts is a universal distress call. A loud whistle carries farther than a voice.
- **Mirror:** A signaling mirror can flash sunlight toward aircraft or search teams many kilometers away.
- **Flashlight:** Three short flashes = distress (SOS). At night, a flashlight is highly visible.
- **Ground markers:** Lay out bright fabric or reflective material in open areas. Use large geometric shapes: X = unable to proceed, V = need assistance, arrow = direction of travel.

## Information hygiene
Rumors spread faster than facts in emergencies. Protect yourself:

- **Verify before acting:** Do not move toward or away from an area based on one unconfirmed message.
- **Trusted sources:** Prioritize official emergency broadcasts (NOAA, local radio) over social chains.
- **Record updates:** Keep a written log of what you heard, from whom, and when. This prevents repeated panic over old news.
- **Avoid amplification:** Do not forward unverified warnings. It clogs channels and causes dangerous stampedes.
`,
  },

  'sanitation-principles': {
    title: 'Emergency Sanitation Principles',
    description: 'Prevent disease when water and sewer systems are offline.',
    category: 'Water',
    format: 'markdown',
    content: `Prevent disease when water and sewer systems are offline.

## The Two-Bucket System
When water-flush toilets are not working, separate liquid and solid waste.

1. **Pee Bucket:** Liquids only. Dilute with water and pour into a safe disposal area.
2. **Poo Bucket:** Solids only. Cover with dry material (sawdust, peat moss, or dry soil) after each use to control odors and flies.

## Handwashing
Handwashing is your best defense against disease. Use a "tippy tap" or a squeeze bottle to conserve water. Always use soap.

## Waste Disposal
Bury solid waste at least 6 inches deep, at least 100 feet from any water source. If burial is not possible, seal in heavy-duty bags and store away from living areas.
`,
  },
};
