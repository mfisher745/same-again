/**
 * Chapter 1: A Quiet Pint. docs/chapters/01-a-quiet-pint.md.
 * Tone: DESIGN.md section 2. Andrew is short with words; Myko does the talking.
 */

import type { DialogueFile } from './index';
import { box, caption, scene } from './build';

export const C01: DialogueFile = {
  text: {
    'c1.title': 'A Quiet Pint',
    'c1.card.pub': "Feeney's, Kilnamoe. A Tuesday.",
    'c1.card.street': 'Main Street. All of it.',
    'c1.card.road': 'The bog road',

    'name.dympna': 'Dympna',
    'name.bigTom': 'Big Tom',
    'name.lad': 'A lad',
    'name.ladInQueue': 'Lad in the queue',

    // Objectives
    'c1.objective.bar': 'Go up to the bar.',
    'c1.objective.dympna': 'Talk to Dympna.',
    'c1.objective.pint': 'Drink the pint.',
    'c1.objective.machine': 'Get the euro back off the fruit machine.',
    'c1.objective.leave': 'Leave by the back.',
    'c1.objective.kegs': 'Shift the kegs.',
    'c1.objective.chipper': 'Get something to eat.',
    'c1.objective.row': 'Sort out the queue.',
    'c1.objective.bigTom': 'Deal with Big Tom.',
    'c1.objective.road': 'Walk out the bog road.',
    'c1.objective.hotDrink': 'Take the tea or the coffee.',
    'c1.objective.kit': 'Look at what you are carrying.',
    'c1.objective.gate': 'Open the yard gate.',
    'c1.objective.bins': 'Get the bottle behind the bins.',
    'c1.objective.hurley': 'Mind the hurley.',

    // Casebook entries for Myko calls (the casebook itself arrives in chapter 2;
    // these are filed retrospectively on its first page).
    'c1.call.fight.casebook': 'Tuesday. Bit of bother on Main Street. Handled it. Myko was there.',
    'c1.call.fight.margin': 'I handled it. You held my lighter.',
    'c1.call.puzzle.casebook': 'Tuesday. Kegs in the way out the back of Feeney’s. Got them moved.',
    'c1.call.puzzle.margin': 'Two kegs, Andrew. Two.',
  },
  sequences: [
    caption('c1.caption.title', 'A Quiet Pint'),
    caption('c1.caption.pub', "Feeney's, Kilnamoe. A Tuesday."),
    caption('c1.caption.street', 'Main Street. All of it.'),
    caption('c1.caption.road', 'The bog road'),

    // --- Feeney's: Dympna's list ---
    scene(
      'c1.pub.open',
      ['myko', "There he is. Three-time champion of the Feeney's table quiz, drinking alone on a Tuesday."],
      ['andrew', "I'm not alone. You're there."],
      ['myko', "I'm over here. It's a different thing."],
      ['dympna', 'Andrew. Come up here to me. I’ve a list.'],
    ),
    scene(
      'c1.pub.stool',
      ['dympna', 'Item one. The stool.'],
      ['andrew', 'What about the stool?'],
      ['dympna', 'It had four legs when you sat on it Friday.'],
    ),
    scene(
      'c1.pub.thursday',
      ['dympna', 'Item two. Last Thursday.'],
      ['andrew', 'I paid for last Thursday.'],
      ['dympna', 'You paid for a Thursday. I’ve no way of knowing which.'],
    ),
    scene(
      'c1.pub.pint',
      ['dympna', 'Item three is whatever you’re having now. Go on.'],
      ['myko', 'She’s put it on the slate, Andrew. The slate has an extension built on it at this stage.'],
    ),
    box('c1.pub.buzz', ['myko', "That's you grand. Stay around there. Let it run dry and you'll wake up back on that stool. Go over the top and it's the same stool."]),
    scene(
      'c1.pub.hotDrink',
      ['dympna', 'Item four. Tea or coffee. Take it with you.'],
      ['andrew', 'Is that on the slate?'],
      ['dympna', "It is not. It's the one thing in here that isn't. Don't make me regret it."],
      ['myko', "Mind that. Wherever you've got yourself to, too far up or too far down, it puts you back where you are now."],
    ),
    box('c1.pub.kit', ['myko', "Tab. Have a look at what you're carrying. It won't take long."]),
    // Back at the bar (the first time, then the offer each visit).
    scene('c1.bar.return', ['dympna', 'You’re back.'], ['andrew', 'I am.'], ['dympna', "The kettle's on. Don't tell me about it."]),
    box('c1.bar.hotDrink', ['dympna', 'Tea or coffee. Same as before. Still not on the slate.']),
    scene(
      'c1.pub.listEnd',
      ['dympna', 'That’s the list. I’ll read it again tomorrow.'],
      ['andrew', 'I’ll be in.'],
      ['dympna', 'I know you will. The knee is at me again, Doctor.'],
      ['andrew', "I can't look at it, Dympna."],
      ['dympna', 'I know you can’t. You can’t charge for it, anyhow. I was only telling you.'],
    ),

    // Optional examines
    box('c1.pub.trophies', ['andrew', 'Table quiz. Three years.'], ['myko', 'Non-consecutive. Tell them it was non-consecutive.']),
    box('c1.pub.dartboard', ['andrew', 'There’s no darts.'], ['myko', 'There was. Then there was the incident. Now there’s a board.']),
    box('c1.pub.photo', ['andrew', 'County team, ’94.'], ['myko', 'Look how happy they are. They’d no idea.']),
    box('c1.pub.telly', ['andrew', 'Is that the news?'], ['myko', "It's the weather. It's been the weather for an hour. I think that's all there is."]),

    // --- The fruit machine ---
    scene(
      'c1.machine.intro',
      ['andrew', 'That machine has my euro.'],
      ['myko', 'From when?'],
      ['andrew', 'March.'],
      ['myko', 'Then have a word with it. Three words. In a row.'],
    ),
    scene(
      'c1.machine.payout',
      ['andrew', 'There.'],
      ['dympna', 'I’ll take that off the slate.'],
      ['myko', "Eleven months to get a euro back, and it's gone before it's warm. That's a system working."],
    ),

    // --- Closing time and the keg yard ---
    scene(
      'c1.lockin.door',
      ['dympna', 'I’m locking the front. There’s a few staying on.'],
      ['andrew', 'I could stay on.'],
      ['dympna', 'You could not. Out the back. Mind the kegs.'],
    ),
    box('c1.yard.kegs', ['myko', 'Full ones. Put your shoulder to them, they slide. Not that one first. Well, whatever you think yourself.']),
    box('c1.yard.done', ['myko', "Look at that. A man who can leave a pub. They said it couldn't be done."]),

    // --- The Shoulder (slot 1) ---
    scene(
      'c1.shoulder.lesson',
      ['andrew', "The gate's stuck."],
      ['myko', "You've just moved two kegs with your shoulder. A gate is only a keg that's been nailed to something."],
      ['myko', 'Press 1. And remember it. It works on people, and people go back further.'],
    ),
    box('c1.shoulder.done', ['myko', "There. Don't apologise to it."]),

    // --- Main Street ---
    scene(
      'c1.throw.lesson',
      ['andrew', "There's a bottle behind those bins. A full one."],
      ['myko', "And the bins are in your way. You've empties in your pocket from inside. Hold right click, line it up, let go."],
      ['andrew', 'At the bins?'],
      ['myko', "At the bins. They've had worse. Most things out here will break if you ask them properly."],
    ),
    box(
      'c1.street.whiskey',
      ['andrew', 'Whiskey.'],
      ['myko', "Somebody hid that, and they'll be thinking about it all night. Mind it. That's not a pint. It sends you up a full floor, and then every thump costs you double."],
    ),
    box('c1.street.empties', ['myko', "You're keeping the bottle."], ['andrew', 'Might need it.'], ['myko', "For throwing. Every one you drink is one you can throw. It's the nearest thing you have to a system."]),

    // --- The row outside the chipper ---
    scene(
      'c1.chipper.intro',
      ['npc:name.ladInQueue', 'That’s the last spice bag. Sorry now.'],
      ['andrew', 'I was ahead of you.'],
      ['npc:name.ladInQueue', 'You were looking at the sky.'],
      ['andrew', 'I was ahead of you and looking at the sky.'],
      ['myko', 'Lads. It’s chips.', 'to nobody'],
      ['npc:name.ladInQueue', 'Are you going to stand there all night, anorak?'],
      ['andrew', 'I might.'],
      ['myko', "I'm here in an advisory capacity. I advise you to hit him."],
    ),
    box('c1.hit.lesson', ['myko', "He's knocked a bit of the drink out of you. That's what a thump does when you're grand or under. Higher up, it sends you spinning the other way."]),
    // --- Stout Slam (slot 2), before the pair arrive ---
    scene(
      'c1.slam.lesson',
      ['myko', "When they're both on top of you, put your foot down. The way you put the pint down at the quiz when it went to a tiebreak."],
      ['andrew', 'That was an accident.'],
      ['myko', 'Three people fell over. Press 2. You need to be grand for it, and you are.'],
    ),
    box('c1.slam.needDrink', ['myko', "You've let yourself go dry. Drink something first. It only works when you're grand."]),
    box('c1.chipper.wave2', ['myko', "He has friends. Two of them. That's more than I'd have guessed."]),
    scene(
      'c1.chipper.end',
      ['npc:name.ladInQueue', 'Take it. Take the spice bag. God.'],
      ['andrew', 'I was ahead of you.'],
      ['myko', "You've made your point. Eat your dinner."],
    ),

    // --- The Myko call prompt ---
    scene(
      'c1.call.prompt',
      ['myko', "C'mere to me. If you're ever properly stuck, in a fight, or looking at something you can't work out, you can ask me."],
      ['andrew', "I won't be."],
      ['myko', "Three times. That's all I'm good for, I've a bad shoulder. After that you're on your own."],
      ['andrew', "I won't need it."],
      ['myko', 'I know. Three, anyway.'],
    ),

    // --- Big Tom Brennan ---
    scene(
      'c1.bigTom.intro',
      ['npc:name.bigTom', 'Andrew.'],
      ['andrew', 'Tom.'],
      ['npc:name.bigTom', 'The tenner.'],
      ['andrew', "I don't have it on me."],
      ['npc:name.bigTom', "You'd it on you in June when I gave it to you."],
      ['myko', "He's not angry, look. He's just very thorough. Mind the right hand, and don't stand in front of him when he runs."],
    ),
    scene(
      'c1.bigTom.phase2',
      ['npc:name.bigTom', 'Hang on.'],
      ['myko', "He's taking the jacket off. He's folding it. Andrew, he's put it on the wall. That's a man settling in."],
    ),
    box('c1.bigTom.dazed', ['myko', "He's hit the tractor. The tractor's fine. Now, go on, while he's thinking about it."]),
    scene(
      'c1.bigTom.end',
      ['npc:name.bigTom', "I'll sit down a minute."],
      ['npc:name.bigTom', 'The tenner, though. In fairness.'],
      ['andrew', "I don't have it, Tom."],
      ['myko', 'Try the inside pocket.'],
      ['andrew', "... That's not mine."],
      ['myko', "It's in your coat."],
      ['npc:name.bigTom', 'Sound, Andrew.'],
      ['myko', "That's you owing me now. I'm much worse."],
    ),
    // --- The hurley: the first weapon ---
    scene(
      'c1.weapon.hurley',
      ['npc:name.bigTom', 'Mind that for me.'],
      ['andrew', 'Your hurley?'],
      ['npc:name.bigTom', "I'm not carrying it home like this. I'll want it back, Andrew. Same as the tenner."],
      ['myko', "He's lent you a stick. Press R when you want it. That's the most anyone in this town has ever trusted you with."],
    ),

    // --- The lights ---
    scene(
      'c1.lights.before',
      ['andrew', 'I was looking at something. Before the chipper.'],
      ['myko', 'The sky. So I heard.'],
      ['andrew', 'Out over the bog. Come on.'],
    ),
    scene(
      'c1.lights.seen',
      ['andrew', 'There.'],
      ['andrew', 'Myko. There. Three of them.'],
      ['myko', "Hang on, this lighter's had it."],
      ['andrew', "They're going down behind the hill."],
      ['myko', 'Got it. What am I looking at?'],
      ['andrew', "They're gone."],
    ),
    scene(
      'c1.closing',
      ['myko', 'Helicopter.'],
      ['andrew', 'No sound.'],
      ['myko', 'Plane.'],
      ['andrew', 'It stopped. Planes don’t stop.'],
      ['myko', 'A lad with a torch.'],
      ['andrew', 'Three lads with three torches, forty feet up.'],
      ['myko', 'The Brennans have ladders. Was it the drink?'],
      ['andrew', 'I know what the drink looks like.'],
      ['myko', "You do, in fairness. Nobody knows it better."],
      ['andrew', 'It landed out there. I’m going out in the morning.'],
      ['myko', "Grand. I'll come and look at your field. I've nothing else on."],
    ),

    // --- Hints (nudge, then the answer; both wrapped in an insult) ---
    box('c1.hint.bar.1', ['myko', "The bar is the long wooden thing with the woman behind it. You've been before."]),
    box('c1.hint.bar.2', ['myko', 'W, A, S and D, Andrew. Walk to the end of the bar. One foot, then the other one.']),
    box('c1.hint.dympna.1', ['myko', "She's looking straight at you. That's as close as Dympna gets to an invitation."]),
    box('c1.hint.dympna.2', ['myko', 'Stand in front of her and press E. Bring your excuses.']),
    box('c1.hint.pint.1', ['myko', "There's a pint in front of you and you're asking me for advice. Things are worse than I thought."]),
    box('c1.hint.pint.2', ['myko', "Q. Press Q. I can't believe that's a thing I had to say to you of all people."]),
    box('c1.hint.machine.1', ['myko', "It's a machine. It doesn't respond to reason. Neither do you, so ye should get on."]),
    box('c1.hint.machine.2', ['myko', 'Left click, three times, quick. The third one is the one that counts.']),
    box('c1.hint.leave.1', ['myko', 'The front is locked and there’s a door behind the bar end. I won’t draw you a map.']),
    box('c1.hint.leave.2', ['myko', 'Back door, bottom corner, where the light is on the floor. Walk through it.']),
    box('c1.hint.kegs.1', ['myko', "There's two kegs and a gate. Think about which keg is in the other keg's way."]),
    box('c1.hint.kegs.2', ['myko', 'Near one up, then left, out of the road. Far one left, then up against the wall. Then the gate.']),
    box('c1.hint.chipper.1', ['myko', "Follow the smell. It's the only thing open and it's lit up like a ferry."]),
    box('c1.hint.chipper.2', ['myko', 'Right, down the street, past the bookies. Join the queue. Try to concentrate on the queue.']),
    box('c1.hint.row.1', ['myko', "They swing slow. You'll see it coming a week ahead. Don't be there when it lands."]),
    box('c1.hint.row.2', ['myko', 'Step back when he winds up, then three in a row. And have a drink, you hit harder when you’re grand.']),
    box('c1.hint.bigTom.1', ['myko', "He runs in a straight line and he doesn't steer. There's a tractor there. I'm only saying."]),
    box('c1.hint.bigTom.2', ['myko', 'Stand in front of the tractor or the gate, let him run, step aside. Hit him while he’s seeing stars.']),
    box('c1.hint.hotDrink.1', ['myko', "She's offering you something for free. Take it before she hears herself."]),
    box('c1.hint.hotDrink.2', ['myko', 'The urn at the end of the bar. E. Pick one.']),
    box('c1.hint.kit.1', ['myko', "You've pockets. Look in them."]),
    box('c1.hint.kit.2', ['myko', 'Tab. The drink goes in the drink slot. That is the whole lesson.']),
    box('c1.hint.gate.1', ['myko', "It's stuck, not locked. There's a difference, and the difference is your shoulder."]),
    box('c1.hint.gate.2', ['myko', 'Face the gate and press 1.']),
    box('c1.hint.bins.1', ['myko', "You can't reach it. You can reach it with something you can throw."]),
    box('c1.hint.bins.2', ['myko', 'Hold right click, aim at the bins, let go. Then pick up what was behind them.']),
    box('c1.hint.hurley.1', ['myko', "He's left you something against the tractor. He asked nicely."]),
    box('c1.hint.hurley.2', ['myko', 'E at the hurley. R swaps between it and your fists.']),
    box('c1.hint.road.1', ['myko', "You were the one who wanted to look at the sky. It's out the road. Away from the chips."]),
    box('c1.hint.road.2', ['myko', 'Keep going right, past the tractor, out of the town. All four hundred yards of it.']),

    // --- Myko calls ---
    scene(
      'c1.call.fight',
      ['myko', 'There you go.'],
      ['andrew', 'I had them.'],
      ['myko', "You did. You'd them well softened up. I could tell by the way they were all still standing."],
      ['myko', "And it's a Tuesday, Andrew. You've used one on a Tuesday. In Kilnamoe."],
    ),
    scene(
      'c1.call.puzzle',
      ['myko', 'There.'],
      ['andrew', 'I was about to do that.'],
      ['myko', "I know you were. I could see you working up to it. Another hour and you'd have had the first one."],
      ['myko', "Kegs, Andrew. I want you to remember, wherever this goes, that you called me in for kegs."],
    ),
  ],
};
