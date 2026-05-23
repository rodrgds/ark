import type { ContentCategory } from '@/types/content';

type AuthoredGuide = {
  title: string;
  description: string;
  category: ContentCategory;
  html: string;
};

function h(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const AUTHORED_GUIDES: Record<string, AuthoredGuide> = {
  'emergency-cooking': {
    title: 'Emergency Cooking Without Power',
    description: 'Cook safely, conserve fuel, and avoid food poisoning when the grid is down.',
    category: 'Food',
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Emergency Cooking Without Power</title>
</head>
<body>
<h1>Emergency Cooking Without Power</h1>

<section id="cook-safely-without-power">
<h2>Cook safely without power</h2>
<p><strong>Carbon monoxide (CO) is the silent killer.</strong> Never use camping stoves, charcoal grills, hibachis, or gasoline generators indoors or in enclosed spaces such as garages, basements, or tents. CO is odorless, colorless, and deadly.</p>
<p><strong>Approved indoor options:</strong> A fireplace with proper ventilation, a wood stove, or a fondue/canned-heat burner in a very well-ventilated room. Keep a battery-powered CO detector nearby.</p>
<p><strong>Fuel choices:</strong> Butane canisters work well in camp stoves but require ventilation. Propane is common for outdoor grills. White gas and kerosene are efficient but flammable; store away from heat sources. Alcohol (denatured or HEET) is safer indoors in small amounts with cross-ventilation.</p>
<p><strong>Fire safety:</strong> Keep a fire extinguisher or baking soda nearby. Never leave an open flame unattended. Place stoves on stable, non-flammable surfaces away from walls and curtains.</p>
</section>

<section id="use-food-before-it-spoils">
<h2>Use food before it spoils</h2>
<p><strong>Refrigerator:</strong> Keep the door closed. A full fridge stays cold about 4 hours; a half-full one about 2–3 hours. Use a thermometer: discard perishables above 40°F (4°C) for more than 2 hours.</p>
<p><strong>Freezer:</strong> A full freezer holds temperature ~48 hours if unopened; a half-full one ~24 hours. Group frozen items together. If ice crystals remain, the food is usually safe to refreeze or cook.</p>
<p><strong>Pantry triage:</strong> Eat perishables first, then refrigerated, then frozen, then shelf-stable. "When in doubt, throw it out" is the safest rule for meat, dairy, eggs, and prepared foods.</p>
<p><strong>Signs of spoilage:</strong> Unusual odor, color, texture, or swelling in cans. Do not taste questionable food.</p>
</section>

<section id="low-water-cooking">
<h2>Low-water cooking</h2>
<p>Water may be scarce. Conserve it with these methods:</p>
<ul>
<li><strong>One-pot meals:</strong> Combine grains, legumes, and vegetables in a single pot to reduce water and fuel use.</li>
<li><strong>Steaming:</strong> Uses less water than boiling and preserves more nutrients.</li>
<li><strong>Soaking:</strong> Soak dried beans and lentils for several hours before cooking to reduce boiling time.</li>
<li><strong>Pasta water reuse:</strong> If you boil pasta, reuse the starchy water to start soups or cook rice.</li>
<li><strong>Sun cooking:</strong> A solar oven or reflective cooker can pasteurize water and cook grains on sunny days with no fuel.</li>
</ul>
</section>

<section id="no-cook-meals">
<h2>No-cook meals</h2>
<p>When fire is unsafe or fuel is gone, these combinations require no heat:</p>
<ul>
<li>Canned tuna or chicken with crackers</li>
<li>Peanut butter on tortillas or bread</li>
<li>Dried fruits, nuts, and granola</li>
<li>Ready-to-eat canned beans (rinse to reduce sodium)</li>
<li>Protein bars, jerky, and shelf-stable cheese</li>
<li>Overnight oats soaked in safe drinking water</li>
</ul>
<p>Keep a 3-day supply of no-cook options as your last-resort food layer.</p>
</section>
</body>
</html>`,
  },

  'foraging-basics': {
    title: 'Foraging Basics & Poison Avoidance',
    description: 'Principles and risks of gathering wild food in emergencies.',
    category: 'Food',
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foraging Basics & Poison Avoidance</title>
</head>
<body>
<h1>Foraging Basics & Poison Avoidance</h1>

<section id="do-not-guess">
<h2>Do not guess</h2>
<p>Plant and mushroom misidentification can be fatal. <strong>Never consume a wild plant or fungus based on a single photo, app description, or memory.</strong> Local experts, regional field guides, and long-term community knowledge are the only safe sources of identification.</p>
<p>Ark provides general principles only. It cannot positively identify plants or mushrooms for your specific region, season, or growing conditions.</p>
</section>

<section id="universal-edibility-test-is-not-enough">
<h2>Universal edibility test is not enough</h2>
<p>The classic "universal edibility test" (contact, lip, chew, swallow in small increments over 24 hours) does not protect against:</p>
<ul>
<li>Delayed toxins that appear days later</li>
<li>Cumulative poisons that build with repeated meals</li>
<li>Individual allergic reactions</li>
<li>Contaminants absorbed from polluted soil or water</li>
</ul>
<p>It is a last-resort framework for absolute starvation scenarios, not a safety guarantee.</p>
</section>

<section id="high-risk-lookalikes">
<h2>High-risk lookalikes</h2>
<p>Some of the most dangerous groups include:</p>
<ul>
<li><strong>Mushrooms:</strong> Deadly amanitas can resemble edible puffballs or meadow mushrooms when young.</li>
<li><strong>Berries:</strong> Elderberries are safe cooked but toxic raw; they resemble other red/purple berries.</li>
<li><strong>Roots and bulbs:</strong> Water hemlock (deadly) and wild carrot (edible) have similar white flowers and root shapes.</li>
<li><strong>Leaves:</strong> Foxglove leaves look like comfrey or sage; foxglove is deadly.</li>
<li><strong>Polluted areas:</strong> Plants near roads, industrial sites, or pesticide runoff can concentrate heavy metals and chemicals.</li>
</ul>
</section>

<section id="safer-food-priorities">
<h2>Safer food priorities</h2>
<p>In an emergency, use this hierarchy to minimize risk:</p>
<ol>
<li><strong>Stored food</strong> — shelf-stable, known, and safe</li>
<li><strong>Fishing</strong> — fish are usually easier to identify than plants</li>
<li><strong>Known local plants</strong> — ones you have positively identified with local experts before the emergency</li>
<li><strong>Community knowledge</strong> — experienced foragers in your area</li>
<li><strong>Wild plants as a last resort</strong> — only when all other options are exhausted</li>
</ol>
<p>When in doubt, go hungry for one more meal rather than risk poisoning.</p>
</section>
</body>
</html>`,
  },

  'food-procurement-basics': {
    title: 'Fishing, Hunting & Food Procurement Basics',
    description: 'Legal, ethical, and safe approaches to acquiring food in the field.',
    category: 'Food',
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fishing, Hunting & Food Procurement Basics</title>
</head>
<body>
<h1>Fishing, Hunting & Food Procurement Basics</h1>

<section id="before-hunting-or-fishing">
<h2>Before hunting or fishing</h2>
<p>Check local laws, licenses, and seasonal limits. In a declared emergency some rules may be suspended, but until then, poaching carries legal penalties and conservation harm. Know your weapon or tackle thoroughly before you rely on it for food.</p>
<p><strong>Energy cost:</strong> Hunting large game burns thousands of calories. Unless you are experienced and equipped, fishing and trapping are usually more energy-efficient.</p>
</section>

<section id="fishing-first">
<h2>Fishing first</h2>
<p>Fishing is generally safer and more efficient than hunting for unprepared individuals. Effective passive methods include:</p>
<ul>
<li>Bank lines left overnight</li>
<li>Minnow traps made from bottles or wire</li>
<li>Handlines with hooks and bait (worms, insects, scraps)</li>
<li>Spearfishing in very clear, shallow water</li>
</ul>
<p>Harvest only what you can eat or safely preserve. Release spawning fish when possible.</p>
</section>

<section id="animal-handling-risks">
<h2>Animal handling risks</h2>
<p>Wild game carries risks that supermarket meat does not:</p>
<ul>
<li><strong>Parasites:</strong> Trichinosis in wild pigs and bears; tapeworms in ungulates. Freeze or cook thoroughly.</li>
<li><strong>Spoilage:</strong> Warm temperatures spoil meat within hours. Field dress immediately and cool the carcass.</li>
<li><strong>Disease:</strong> Rabies, tularemia, and chronic wasting disease (CWD) exist in some regions. Wear gloves when gutting; avoid nervous tissue if CWD is present locally.</li>
<li><strong>Safe cooking:</strong> Cook all wild game to an internal temperature of 160°F (71°C). Bring stews and braises to a rolling boil.</li>
</ul>
</section>

<section id="when-not-to-hunt">
<h2>When not to hunt</h2>
<p>Avoid hunting when:</p>
<ul>
<li>You lack proper equipment or ammunition</li>
<li>You are injured, ill, or alone without rescue backup</li>
<li>Weapon noise would reveal your position in an unsafe area</li>
<li>You do not know how to field dress, cool, and preserve the meat</li>
<li>Local regulations prohibit it</li>
</ul>
<p>Scavenging already-dead animals is extremely risky due to spoilage and disease. Do not attempt it.</p>
</section>
</body>
</html>`,
  },

  'personal-safety-conflict': {
    title: 'Personal Safety & Conflict Avoidance',
    description: 'Avoid danger, de-escalate conflict, and plan safe exits.',
    category: 'Safety',
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal Safety & Conflict Avoidance</title>
</head>
<body>
<h1>Personal Safety & Conflict Avoidance</h1>

<section id="avoid-becoming-a-target">
<h2>Avoid becoming a target</h2>
<p>Most confrontations can be prevented by reducing your visibility as a victim:</p>
<ul>
<li><strong>Situational awareness:</strong> Keep your head up, scan exits, and notice who is around you. Avoid staring at your phone in public.</li>
<li><strong>Predictability:</strong> Vary your routes and times if traveling in uncertain areas.</li>
<li><strong>Valuables:</strong> Keep expensive gear, jewelry, and electronics concealed.</li>
<li><strong>Groups:</strong> Travel with others when possible; isolation increases risk.</li>
<li><strong>Low profile:</strong> Dress neutrally, avoid loud conversations about supplies or plans, and do not display weapons.</li>
</ul>
</section>

<section id="de-escalation">
<h2>De-escalation</h2>
<p>If a confrontation begins, your goal is to exit safely, not to win. Techniques:</p>
<ul>
<li><strong>Distance:</strong> Increase physical distance immediately. Do not let someone close your exit.</li>
<li><strong>Calm speech:</strong> Speak slowly and softly. Acknowledge the other person's emotion without agreeing to demands that put you at risk.</li>
<li><strong>Open hands:</strong> Keep palms visible and avoid sudden movements.</li>
<li><strong>Exits:</strong> Point yourself toward an exit, not a corner. Look for witnesses or well-lit areas.</li>
<li><strong>Non-provocation:</strong> Do not insult, challenge, or threaten. Humiliation often triggers violence.</li>
</ul>
</section>

<section id="escape-planning">
<h2>Escape planning</h2>
<p>Plan before you need it:</p>
<ul>
<li>Identify at least two exits from every room or building you enter.</li>
<li>Choose a safe room in your home: solid door, lock, phone or radio, and a planned secondary exit.</li>
<li>Set up improvised alarms: cans on a string, door wedges, or battery-powered motion sensors.</li>
<li>Agree on rally points with your group: one nearby, one farther away.</li>
<li>Keep a small "go-bag" near exits with ID, keys, phone, flashlight, and basic first aid.</li>
</ul>
</section>

<section id="after-an-incident">
<h2>After an incident</h2>
<p>Your safety continues after the immediate threat ends:</p>
<ul>
<li><strong>Medical check:</strong> Adrenaline can mask injuries. Inspect yourself and others for wounds, sprains, or shock signs.</li>
<li><strong>Documentation:</strong> Write down what happened, when, where, and descriptions while memory is fresh.</li>
<li><strong>Authorities:</strong> Contact local emergency services if available and safe to do so.</li>
<li><strong>Mental recovery:</strong> Acute stress reactions are normal. Talk to someone you trust, rest, and hydrate. Seek professional support if symptoms persist.</li>
</ul>
</section>
</body>
</html>`,
  },

  'offline-communications': {
    title: 'Offline Communications',
    description: 'Preserve battery, use low-bandwidth channels, and signal when networks fail.',
    category: 'Comms',
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline Communications</title>
</head>
<body>
<h1>Offline Communications</h1>

<section id="first-rule-preserve-battery">
<h2>First rule: preserve battery</h2>
<p>Your phone is your most versatile tool. Extend its life:</p>
<ul>
<li>Switch to airplane mode and only toggle radios on briefly to send or check messages.</li>
<li>Reduce screen brightness to the minimum usable level.</li>
<li>Use OLED black themes where possible (every black pixel saves power on OLED screens).</li>
<li>Disable vibration, Bluetooth, and location services when not needed.</li>
<li>Carry a fully charged power bank and a solar charger if available.</li>
<li>Duty-cycle: turn the phone on for 5 minutes every hour rather than leaving it on continuously.</li>
</ul>
</section>

<section id="sms-radio-and-meeting-points">
<h2>SMS, radio, and meeting points</h2>
<p>When voice calls fail, try these lower-bandwidth channels:</p>
<ul>
<li><strong>SMS text:</strong> Often succeeds when voice networks are overloaded because it needs only a moment of signal.</li>
<li><strong>FRS/GMRS radios:</strong> Inexpensive, no license required in many regions for FRS. Range is short (1–2 km), but useful for group coordination.</li>
<li><strong>Amateur (ham) radio:</strong> Requires a license in normal times, but emergency traffic is usually permitted. Much longer range with repeaters.</li>
<li><strong>Pre-agreed plans:</strong> Designate primary and fallback meeting points with times. If no contact by the set time, proceed to the fallback.</li>
</ul>
</section>

<section id="signal-methods">
<h2>Signal methods</h2>
<p>When electronic communication is impossible, use physical signals:</p>
<ul>
<li><strong>Whistle:</strong> Three blasts is a universal distress call. A loud whistle carries farther than a voice.</li>
<li><strong>Mirror:</strong> A signaling mirror can flash sunlight toward aircraft or search teams many kilometers away.</li>
<li><strong>Flashlight:</strong> Three short flashes = distress (SOS). At night, a flashlight is highly visible.</li>
<li><strong>Ground markers:</strong> Lay out bright fabric or reflective material in open areas. Use large geometric shapes: X = unable to proceed, V = need assistance, arrow = direction of travel.</li>
</ul>
</section>

<section id="information-hygiene">
<h2>Information hygiene</h2>
<p>Rumors spread faster than facts in emergencies. Protect yourself:</p>
<ul>
<li><strong>Verify before acting:</strong> Do not move toward or away from an area based on one unconfirmed message.</li>
<li><strong>Trusted sources:</strong> Prioritize official emergency broadcasts (NOAA, local radio) over social chains.</li>
<li><strong>Record updates:</strong> Keep a written log of what you heard, from whom, and when. This prevents repeated panic over old news.</li>
<li><strong>Avoid amplification:</strong> Do not forward unverified warnings. It clogs channels and causes dangerous stampedes.</li>
</ul>
</section>
</body>
</html>`,
  },
};
