/**
 * Chapter 7: Gift Shop. docs/chapters/07-gift-shop.md.
 * From here on, about two in three of Myko's tangents are about Ohio.
 */

import type { DialogueFile } from './index';
import { box, caption, mykoPool, scene } from './build';

const ohio = mykoPool('c7.ohio', [
  "The roads are narrow here. I'm not saying anything. I'm only saying they're narrow.",
  "Do you know what you don't see here? A water tower with the name on it. You have to guess where you are.",
  "Nobody's said hello. Forty minutes. In Wendell County we'd have been asked in for dinner.",
  "They charge for the ice here. I checked. A dollar fifty a bag. I had to sit down.",
  "It's very loud, isn't it? All the colours. Ohio never raised its voice at me once.",
  "I rang the Starlite. Just to see were they all right. They are.",
  "The sky's fine. It's a grand sky. It's just not finished the way the other one was.",
  "I'm not comparing. I'm only saying if you had the two of them side by side you wouldn't pick this.",
]);

const other = mykoPool('c7.tangent', [
  "There's a man over there dressed as an alien eating a hot dog. I don't know why that's what's done it, but I believe you a bit more now.",
  "If I was an alien this is exactly where I'd live. You'd never have to iron anything.",
  "I've counted nine shops selling the same alien. He's the most successful person I've ever seen.",
  "Do you think they get sunburnt? The real ones. Grey lads. No, go on, you're working.",
]);

/** The six figures in the shop. Figures 2, 4 and 6 (Gary) are aliens; this is fixed. */
export const C07: DialogueFile = {
  text: {
    'c7.title': 'Gift Shop',
    'c7.card.strip': 'Roswell, New Mexico',
    'c7.card.shop': 'Little Green Gifts',
    'name.tourist': 'Tourist',
    'name.costumeA': 'Figure by the door',
    'name.costumeB': 'Figure at the snow globes',
    'name.costumeC': 'Figure at the photo booth',
    'name.costumeD': 'Figure in the queue',
    'name.costumeE': 'Figure by the fridge magnets',
    'name.clerk': 'Clerk',
    'name.bartender': 'Bartender',
    'name.zip': 'Zip',
    'name.zap': 'Zap',
    'name.zorp': 'Zorp',

    'c7.objective.strip': 'Find the gift shop.',
    'c7.objective.tells': 'Work out which three are real.',
    'c7.objective.gary': 'Talk to the man at the till.',
    'c7.objective.stock': 'Search the stockroom.',
    'c7.objective.yard': 'Clear the yard.',
    'c7.objective.van': 'Check the van.',
    'c7.objective.board': 'Work out where they come from.',
    'c7.objective.mascots': 'Deal with the mascots.',

    'c7.tells.prompt': 'Accuse three.',
    'c7.tells.accuse': 'That one',
    'c7.tells.confirm': 'Those three',

    'c7.clue.leaflet.title': 'Tourist leaflet',
    'c7.clue.leaflet.body': '“Sightings Around the World.” My bog ring is in it. Page 6. Listed as “unverified, Europe”.',
    'c7.clue.leaflet.margin': 'Europe. They couldn’t even give you Ireland.',
    'c7.clue.payslip.title': 'Gary’s payslip',
    'c7.clue.payslip.body': 'Gary is an alien. He said so. His wages are paid by Meridian Basin Facility, Nevada. Nineteen years’ service.',
    'c7.clue.payslip.margin': 'He gets dental.',
    'c7.clue.permit.title': 'Parking permit',
    'c7.clue.permit.body': 'Staff parking permit from the stockroom noticeboard. “Gate C – Service Entrance.” No address. Sand in the envelope.',
    'c7.clue.permit.margin': 'Keep that. That’s the kind of thing that opens a barrier.',
    'c7.clue.route.title': 'Delivery log',
    'c7.clue.route.body': 'Van log. Roswell to Nevada every Thursday, full. Nevada to Roswell every Friday, empty. Six hundred miles each way.',
    'c7.clue.route.margin': 'Full of what? Snow globes? Going INTO the desert?',
    'c7.deduction.nevada.lead.title': 'Lead: Nevada',
    'c7.deduction.nevada.lead.body': 'Gary is paid from there. The van drives there every Thursday. The permit is for its service gate. Meridian Basin Facility, Nevada. Gate C. That’s where they live.',
    'c7.deduction.nevada.lead.margin': 'You’re going to be right, aren’t you. I can feel it coming.',

    'c7.deduction.nevada.prompt': 'Where do they come from?',
    'c7.deduction.nevada.answer': 'Meridian Basin Facility, Gate C',

    'c7.call.fight.casebook': 'Three mascots and three clerks in the yard behind the gift shop. All aliens. Dealt with. Myko was present.',
    'c7.call.fight.margin': 'Present. I like that. I was present all over them.',
    'c7.call.puzzle.casebook': 'Identified three aliens among six costumes by observation. Myko confirmed.',
    'c7.call.puzzle.margin': 'I asked them. They told me. People forget you can ask.',
  },
  sequences: [
    caption('c7.caption.title', 'Gift Shop'),
    caption('c7.caption.strip', 'Roswell, New Mexico'),
    caption('c7.caption.shop', 'Little Green Gifts'),
    ...ohio.sequences,
    ...other.sequences,

    // --- The bar: open-fronted, on the strip. The drinks are green. ---
    scene(
      'c7.bar.open',
      ['andrew', 'Everyone is dressed as an alien.'],
      ['myko', 'They are.'],
      ['andrew', "I've come four thousand miles to prove there's aliens and the barman has antennae."],
      ['myko', "You're in the one town on earth where you're not interesting. How does it feel?"],
      ['andrew', 'Bad.'],
    ),
    scene(
      'c7.bar.tequila',
      ['npc:name.bartender', 'Welcome, Earthling! First one’s on the house. It’s green!'],
      ['andrew', 'What is it?'],
      ['npc:name.bartender', 'Tequila! We call it a Close Encounter.'],
      ['myko', "You've heard of tequila. That's as far as you've ever got. It puts you straight up on the top floor, and a few seconds later it takes the stairs away."],
    ),
    box('c7.bar.hotDrink', ['npc:name.bartender', 'Coffee or tea? The tea’s green too. That one’s on purpose.']),
    box('c7.bar.return', ['npc:name.bartender', 'Back again, Earthling! Rough landing?']),
    scene(
      'c7.strip.tourist1',
      ['andrew', "Excuse me. I've evidence of an actual landing. In Ireland. I've a fragment."],
      ['npc:name.tourist', 'Oh, neat! We got a fragment too. They’re six ninety-nine at the place with the big head.'],
    ),
    scene(
      'c7.strip.tourist2',
      ['npc:name.tourist', "Love the costume! What are you supposed to be?"],
      ['andrew', "I'm not in a costume."],
      ['npc:name.tourist', "Ha! Staying in character. Love it."],
    ),
    box('c7.strip.leaflet', ['andrew', "That's my ring. My bog. “Unverified, Europe.”"], ['myko', "You're in a leaflet. Page six. Your mother will be thrilled."]),

    // --- Who is an alien ---
    scene(
      'c7.tells.intro',
      ['andrew', "This is the shop. From the receipt. From the field."],
      ['myko', "There's six lads in here dressed as aliens."],
      ['andrew', 'Some of them are.'],
      ['myko', 'Are what?'],
      ['andrew', 'Aliens. Dressed as aliens.'],
      ['myko', "That's either the cleverest thing you've ever said or we should get you a coffee. Go and look at them. Closely."],
    ),
    // Figure A: tourist.
    box('c7.tells.a', ['andrew', "Sunburnt neck. Phone in his hand. He's complaining about the price of water."], ['myko', "That's a man. That's the most man I've ever seen."]),
    // Figure B: alien.
    box('c7.tells.b', ['andrew', "He's reading the small print on a snow globe. All of it. He's on the back now."], ['myko', "And it's forty degrees out and he's not sweating into that suit. Hm."]),
    // Figure C: tourist.
    box('c7.tells.c', ['andrew', "She's taken the head off to fix her hair. Twice."], ['myko', "Then I'd say that's a head she can take off. Next."]),
    // Figure D: alien.
    box('c7.tells.d', ['andrew', "He's queueing. There's nobody else in the queue. He's left a gap in front of him anyway."], ['myko', 'He blinked there. Sideways. Did you see? Like a gate closing.']),
    // Figure E: tourist.
    box('c7.tells.e', ['andrew', "He's asked the price of the same magnet three times and he's still annoyed."], ['myko', "Human. Aliens crossed the stars, Andrew. They can read a sticker."]),
    box('c7.tells.wrong', ['npc:name.tourist', "Dude. I'm from Tucson. Do you work here?"], ['myko', 'Mortified for you. Go again.']),
    scene(
      'c7.tells.right',
      ['andrew', 'Him. Him. And –'],
      ['gary', "Yeah, me. Hi. Gary. Can I help you find anything?"],
    ),

    // --- Gary ---
    scene(
      'c7.gary.intro',
      ['andrew', "You're an alien."],
      ['gary', 'Yep.'],
      ['andrew', "You're – you're just saying it."],
      ['gary', "Nineteen years I've worked this register. You're the first one who looked. Everybody else wants to know if the mugs are dishwasher safe. They're not."],
      ['andrew', "I saw one of your ships. Over a bog. In Ireland. I've been following it for –"],
      ['gary', 'Oh, the Leitrim thing? Sure. I heard about that. Somebody got written up.'],
      ['myko', "Andrew. Sit down a second. You've gone a colour."],
    ),
    scene(
      'c7.gary.nineteen',
      ['andrew', "Why are you here? In a gift shop?"],
      ['gary', "I like it. It's air conditioned. I get a discount. Tuesdays are slow, I do the crossword."],
      ['andrew', "But you're from – out there."],
      ['gary', "Have you been out there? It's mostly admin."],
    ),
    scene(
      'c7.gary.payslip',
      ['andrew', 'Who do you work for? Really?'],
      ['gary', "Says on my payslip. Here. Meridian Basin. It's in Nevada. Don't tell them I showed you. Actually, tell them, I don't think they read anything."],
      ['andrew', "You're taking this very well."],
      ['gary', "You're taking it better. Most people faint. You nearly did."],
    ),

    // --- Last Orders (a move for slot 4) ---
    scene(
      'c7.lastOrders.lesson',
      ['gary', "Hang on. It's six. Folks, we're closing."],
      ['andrew', 'They all just left.'],
      ['gary', "Nineteen years. You say it like it's already happened. They hear it in the knees."],
      ['myko', "That's last orders, Andrew. You've heard it a thousand times and never once from the right side of the bar."],
      ['myko', "It's in your kit, on 4. When you're as far gone as you can go, say it like Gary."],
    ),

    // --- Stockroom ---
    scene(
      'c7.stock.open',
      ['myko', "There's four of them in there counting snow globes. They walk like clockwork. Exactly like clockwork. That's your way in.", 'by phone'],
    ),
    box('c7.stock.overheard.1', ['npc:name.clerk', 'Shelf nine. Forty units. Confirmed. Shelf ten. Forty units. Confirmed.']),
    box('c7.stock.overheard.2', ['npc:name.clerk', "I'm one short on shelf eleven. I'll have to start again. From shelf one."]),
    box('c7.stock.overheard.3', ['npc:name.clerk', 'Did you put in for Thursday? I put in for Thursday. I like the drive.']),
    box('c7.stock.overheard.4', ['npc:name.clerk', 'Gary took a long lunch. I noted it. I noted that I noted it.']),
    scene(
      'c7.stock.clean',
      ['myko', "Clean as a whistle. There's a staff fridge. Andrew. There's a can of stout in the staff fridge.", 'by phone'],
      ['andrew', "It has Gary's name on it."],
      ['gary', 'Go ahead. I was curious. I got it shipped. I don’t get it.', 'from the doorway'],
    ),
    box('c7.stock.caught', ['myko', "They've noticed. They'll line up to shoot, they can't help it. Go through the line, or poke along it.", 'by phone']),
    box('c7.stock.permit', ['andrew', 'Staff parking. Gate C. Service entrance.'], ['myko', "Pocket it. Don't fold it.", 'by phone']),

    // --- Yard ---
    scene(
      'c7.yard.intro',
      ['npc:name.clerk', 'Sir. This area is staff only. Please return to the retail environment.'],
      ['andrew', "I know what you are."],
      ['npc:name.clerk', 'Then you will understand that I have to file this.'],
    ),
    box('c7.yard.end', ['myko', "That's them. They fell very neatly. All facing the same way.", 'by phone']),
    box('c7.van.log', ['andrew', 'Every Thursday. Roswell to Nevada, full. Back empty.'], ['myko', "Six hundred miles with a van of snow globes. There's something I'm not being told.", 'by phone']),

    box('c7.board.wrong.1', ['myko', "No. The leaflet's about you. This is about them."]),
    box('c7.board.wrong.2', ['myko', 'Where does Gary’s money come from, Andrew. Start there.']),
    box('c7.board.wrong.3', ['myko', 'A payslip, a permit and a van. All three have a place on them.']),
    scene(
      'c7.board.right',
      ['andrew', 'Meridian Basin Facility. Nevada. Gate C.'],
      ['myko', "A real one told you to your face and you still made a board. That's why I like you."],
    ),

    // --- Mascots ---
    scene(
      'c7.mascots.intro',
      ['npc:name.zip', 'HEY THERE, EARTHLINGS! I’M ZIP!'],
      ['npc:name.zap', 'I’M ZAP!'],
      ['npc:name.zorp', 'AND I’M ZORP! WELCOME TO ROSWELL!'],
      ['andrew', "They're seven foot tall."],
      ['npc:name.zip', 'You went in the stockroom.', 'quietly'],
      ['myko', "The tourists think it's a show. Let them. The one with the sign stops everything from the front. So fall through them.", 'by phone'],
    ),
    box('c7.mascots.first', ['npc:name.tourist', "Whoa! He really went down! These guys are GOOD."]),
    box('c7.mascots.second', ['myko', "One left, and he's faster for it. They always are.", 'by phone']),
    scene(
      'c7.mascots.end',
      ['npc:name.tourist', 'WOOO! Best show on the strip! Here, buddy. You win the big guy!'],
      ['andrew', "He's given me a dollar. And an alien."],
      ['myko', "First money you've made in four years, and your first alien. It's full of air. Leave that out of the casebook.", 'by phone'],
    ),
    box('c7.weapon.inflatable', ['myko', "Press R. Swing it. It hurts nobody and it moves everybody. It's the most use an alien's been to you yet."]),

    scene(
      'c7.closing',
      ['gary', "Gate C's the quiet one. Go at shift change. And hey, good luck with the whole, you know. Telling everyone."],
      ['andrew', "You don't mind?"],
      ['gary', "Honestly? I don't think it's gonna go how you think. But knock yourself out. Just leave me out of it, I've got a good thing here."],
      ['andrew', 'I will.'],
      ['gary', 'You want a bag for that?'],
      ['myko', "The roads here are narrow, Andrew. I've been meaning to say it to someone."],
    ),

    // --- Hints ---
    box('c7.hint.strip.1', ['myko', "It's the one with the logo from the cornfield. The beautiful cornfield. Before they ruined it."]),
    box('c7.hint.strip.2', ['myko', 'Far end of the strip, past the saucer. Little Green Gifts.']),
    box('c7.hint.tells.1', ['myko', "People sweat, complain and fiddle with their phones. Look for the ones doing none of that."]),
    box('c7.hint.tells.2', ['myko', 'The one reading the snow globe, the one queueing behind nobody, and the lad at the till.']),
    box('c7.hint.gary.1', ['myko', "The lad at the till says he's one. Ask him things. He answers."]),
    box('c7.hint.gary.2', ['myko', 'Talk to Gary until he runs out. He closes the shop at six. Watch how.']),
    box('c7.hint.stock.1', ['myko', 'They never change the route. Count it once and you know it for ever.', 'by phone']),
    box('c7.hint.stock.2', ['myko', 'Wait for the count at shelf nine, cross behind them, noticeboard is on the back wall.', 'by phone']),
    box('c7.hint.yard.1', ['myko', "The big foam ones roll. The small ones stand in a row to shoot. A row, Andrew.", 'by phone']),
    box('c7.hint.yard.2', ['myko', 'Stumble along the line of clerks, or use the umbrella. Step off the roll and hit the mascot while he’s on his back.', 'by phone']),
    box('c7.hint.van.1', ['myko', "It's a van. They keep a log. Everybody who drives for a living keeps a log.", 'by phone']),
    box('c7.hint.van.2', ['myko', 'Driver’s door, clipboard on the seat. E.', 'by phone']),
    box('c7.hint.board.1', ['myko', "Three bits of paper that all name the one place."]),
    box('c7.hint.board.2', ['myko', 'Payslip, permit, delivery log.']),
    box('c7.hint.mascots.1', ['myko', "The one with the sign blocks everything from the front. So don't go from the front. Or go through.", 'by phone']),
    box('c7.hint.mascots.2', ['myko', 'Stumble through the three when they line up. It knocks the sign away. Hit Zip while he’s on his back. Walk the gaps in Zap’s fan.', 'by phone']),

    // --- Myko calls ---
    scene(
      'c7.call.fight',
      ['myko', "Lads. How are ye. Don't mind me."],
      ['andrew', 'You used a snow globe.'],
      ['myko', "It was nearest. You'd them on the run. They were running at you, but still."],
      ['myko', "It's all right. They're from another planet. Nobody'd expect you to manage that on your own. I just did, but nobody'd expect it."],
    ),
    scene(
      'c7.call.puzzle',
      ['myko', 'Him, him, and the lad at the till. There you go.'],
      ['andrew', 'How do you know?'],
      ['myko', "I asked them. They're very honest. It's nearly like Ohio. People forget you can ask."],
      ['myko', "You'd have got there. You'd one of them down as “suspicious” for wearing sandals."],
    ),
  ],
  pools: {
    ...ohio.pool,
    ...other.pool,
  },
};
