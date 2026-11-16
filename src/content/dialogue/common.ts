/**
 * Text used in every chapter: names, pickup text, HUD and menu labels,
 * prompts, and Myko's general-purpose remarks. Tone rules: DESIGN.md section 2
 * and docs/style-guide.md section 6.
 *
 * Entries under a RETIRING comment belong to systems the overhauled design
 * removes (health, food, hangover, the dodge, the heat meter). The current
 * code still reads them. Delete each one with the code that reads it.
 */

import type { DialogueFile } from './index';
import { box, linePool, mykoPool, scene } from './build';

// --- Back at the bar (DESIGN.md 7.1). Said at the bar, after the fade. ---

const barSober = mykoPool('myko.bar.sober', [
  'You went very quiet out there. Drink that.',
  "There he is. You'd a face on you like a man reading his own bank statement.",
  "You stopped drinking and started thinking. I've told you about that.",
  "Sober, in the middle of everything. That's not bravery, Andrew. That's neglect.",
  "I couldn't get a word in. I don't know where you went. Welcome back.",
  'You saw it all very clearly, did you? And how was it?',
]);

const barFloor = mykoPool('myko.bar.floor', [
  "You're grand. You fell over with great conviction.",
  "I carried you. I'm saying it now so there's no argument later.",
  'You went past brave and out the far side.',
  'Up you get. Same again, only less of it.',
  "That's the worst I've seen you since the table quiz final.",
  'You went down like the county team. Second half, mind.',
  "I'd have caught you, but I'm here in an advisory capacity.",
]);

/** Andrew, at 0, before the fade. Myko says nothing here. */
const zero = linePool('andrew', 'andrew.zero', ['Ah.', 'Right. I see.', 'What am I doing here.']);

/** Andrew, running low (under 10). */
const sober = linePool('andrew', 'andrew.sober', [
  "Everything is very clear. I don't like it.",
  "I can hear my own thoughts. They're not helping.",
  "I'm nearly sober. Write that down. No, don't.",
]);

const low = mykoPool('myko.low', [
  "You're running dry. Find something with a cap on it.",
  "There's very little left in you. I can nearly see through you.",
  'Drink something, Andrew. You have the look of a man about to make a sensible decision.',
]);

const bitMuch = mykoPool('myko.bitMuch', [
  "You're swaying. It suits you, but they'll hear you coming.",
  "That's a bit much. You hit harder up there. So does everything else.",
  'Mind yourself. From here a thump sends you up, not down.',
]);

const fecked = mykoPool('myko.fecked', [
  "You're one drink from the floor. I'm not saying stop. I'm saying I've seen the floor.",
  "Easy. You're hitting like a horse and standing like a foal.",
  "That's as far up as it goes, Andrew. After this it's me and a cloud of smoke.",
]);

const drinkComment = mykoPool('myko.drink', [
  "That's the stuff. Mind yourself, you've a job on.",
  'Go easy. You get very sure of yourself after three.',
  "You're drinking that like there's a lock-in.",
  'Fair play. Hydration.',
]);

const whiskey = mykoPool('myko.whiskey', [
  "Up a floor. Nothing drains for a bit. Don't get hit, it costs you double.",
  "Whiskey. You'll be very sure of yourself for about eight seconds.",
  "That's the good stuff working. Stand somewhere nobody can reach you.",
]);

const tequila = mykoPool('myko.tequila', [
  "Straight to the top floor. You've a few seconds up there and then the stairs go.",
  "Tequila. I'll be over here. A good way over here.",
  'Do whatever you were going to do, and do it now. It leaves faster than it arrives.',
]);

const hotDrink = mykoPool('myko.hotDrink', [
  'Back to grand. Like none of it happened.',
  "That's you reset. It's the only thing that works on you.",
  'There. A normal man again, for as long as that lasts.',
]);

const meterGrows = mykoPool('myko.meterGrows', [
  "You're holding it better than you did at home. That's practice. I'm not sure it's the good kind.",
  "There's more room in you than there was. Don't fill it all at once.",
  'You can take a bit more now before it shows. I mean that as information, not praise.',
]);

const idle = mykoPool('myko.idle', [
  "No rush. I've a smoke on.",
  'Is this the plan, or are we between plans?',
  "You're thinking. I can hear it from here.",
  "I'll just stand here, so. Advising.",
  "If you're waiting on the aliens to come to you, fair enough. It's worked before.",
  "I could have stayed at home for this. I'd the fire lit and everything.",
]);

const callRefusedNone = mykoPool('myko.callRefused.noCallsLeft', [
  "You've had your three. I'm back to advising.",
  "No. I've my own things to be doing. I'm watching, for one.",
]);

const callRefusedNotNow = mykoPool('myko.callRefused.notCallable', [
  "There's nothing here needs me. There's barely anything here needs you.",
  'Call me for what, Andrew? Walking?',
]);

// --- RETIRING: pools the current code plays for removed systems. ---

const death = mykoPool('myko.death', [
  "You're grand. You fell over with great conviction.",
  "I'd have helped, but I'm here in an advisory capacity.",
  'Take your time. They seem happy to wait.',
  "That's the worst I've seen you since the table quiz final.",
  "In fairness, he didn't look like he could do that.",
  'Up you get. Same again, only different.',
  'I rang nobody. I assumed you had a plan.',
  'You went down like the county team. Second half, mind.',
]);

const hangover = mykoPool('myko.hangover', [
  'Morning. You look like you were buried and they changed their minds.',
  "It's bright, yeah. It's called day. Tea will sort you.",
  "You'd a great night. You told a bus driver about the fragment.",
]);

const banjaxed = mykoPool('myko.banjaxed', [
  "And he's down. Take a minute. Take two.",
  'That was eight great seconds, in fairness.',
  "You've gone past brave and out the far side.",
]);

const heat = mykoPool('myko.heat', [
  'You need water. Actual water. I know, I was surprised too.',
  "You're the colour of a boiled ham. Find shade.",
  'Stand under that rock a minute. The aliens will keep.',
  'It was never this warm in Ohio. It was perfect in Ohio.',
  "You're cooking. Drink the water, not the other thing.",
]);

const heatDrink = mykoPool('myko.heat.wrongDrink', [
  "That's not water. That's the opposite of water.",
  "It won't cool you down. It'll just make you confident about being warm.",
  "I'm not carrying you. I'll advise you along the ground.",
]);

export const COMMON: DialogueFile = {
  text: {
    // Title and menus
    'ui.title': 'Same Again',
    'ui.menu.continue': 'Continue',
    'ui.menu.newGame': 'New Game',
    'ui.menu.chapterSelect': 'Chapter Select',
    'ui.menu.settings': 'Settings',
    'ui.menu.back': 'Back',
    'ui.menu.newGameConfirm': 'Start again? The current save will be replaced.',
    'ui.menu.yes': 'Yes',
    'ui.menu.no': 'No',
    'ui.pause.title': 'Paused',
    'ui.pause.resume': 'Resume',
    'ui.pause.quit': 'Quit to title',
    'ui.settings.music': 'Music',
    'ui.settings.effects': 'Effects',
    'ui.settings.fullscreen': 'Fullscreen',
    'ui.settings.on': 'On',
    'ui.settings.off': 'Off',
    'ui.settings.fullscreenHint': 'F11 or Alt+Enter also works',
    'ui.settings.tab': 'Tab screen',
    'ui.settings.tab.toggle': 'Press to open, press to close',
    'ui.settings.tab.hold': 'Open while held',
    'ui.chapter.label': 'Chapter {n}',
    'ui.chapter.locked': 'Not yet',
    'ui.saved': 'Saved',

    // HUD
    'ui.hud.bottles': 'Bottles',
    'ui.hud.noDrink': 'Nothing',
    'ui.hud.noMove': 'Nothing',
    'ui.hud.special.needLevel': 'Not yet',
    'ui.hud.special.recharging': 'Hang on',
    'ui.hud.sun': 'Sun',
    'ui.key.1': '1',
    'ui.key.2': '2',
    'ui.key.3': '3',
    'ui.key.4': '4',
    'ui.key.q': 'Q',
    'ui.key.g': 'G',
    'ui.key.r': 'R',
    'ui.key.m': 'M',
    'ui.key.tab': 'Tab',
    'ui.buzz.sober': 'Sober',
    'ui.buzz.buzzed': 'Buzzed',
    'ui.buzz.grand': 'Grand',
    'ui.buzz.bitMuch': 'Bit much',
    'ui.buzz.fecked': 'Fecked',

    // Prompts
    'ui.prompt.interact': 'E',
    'ui.prompt.advance': 'E / click',
    'ui.prompt.move': 'WASD to move',
    'ui.prompt.talk': 'E to talk',
    'ui.prompt.examine': 'E to examine',
    'ui.prompt.drink': 'Q to drink',
    'ui.prompt.punch': 'Left click to punch. Three in a row.',
    'ui.prompt.push': 'Walk into it to push',
    'ui.prompt.throw': 'Hold right click to aim a bottle. Let go to throw.',
    'ui.prompt.sneak': 'Hold Shift to sneak',
    'ui.prompt.slot': '{key} to use it',
    'ui.prompt.weapon': 'R to change weapon',
    'ui.prompt.actNatural': 'Stand still beside it',
    'ui.prompt.hint': 'H to ask Myko',
    'ui.prompt.callMyko': 'Hold M to call Myko in. Three for the whole game.',
    'ui.prompt.kit': 'Tab for the kit',
    'ui.prompt.selectDrink': 'Mouse wheel to change the drink',
    'ui.prompt.spirit': '{key} to knock it back',
    'ui.prompt.hotDrink': 'E for a hot drink',
    'ui.prompt.sit': 'E to sit',

    // The Tab screen: casebook and kit (DESIGN.md 7.7)
    'ui.tab.casebook': 'Casebook',
    'ui.tab.kit': 'Kit',
    'ui.kit.title': 'Kit',
    'ui.kit.drinks': 'Drinks',
    'ui.kit.places': '{n} of {max}',
    'ui.kit.hotDrink': 'Hot drink',
    'ui.kit.bottles': 'Bottles',
    'ui.kit.weapons': 'Weapons',
    'ui.kit.moves': 'Moves',
    'ui.kit.slots': 'Slots',
    'ui.kit.slot.drink': 'Drink',
    'ui.kit.slot.melee': 'Melee',
    'ui.kit.slot.special': 'Special {n}',
    'ui.kit.slot.level': '{state} and up',
    'ui.kit.slot.empty': 'Empty',
    // Playtest 4 kit: two halves. Items sit beside the slot that takes them; moves sit beside the special slots.
    'ui.kit.section.items': 'Items',
    'ui.kit.section.moves': 'Moves',
    'ui.kit.howTo': 'Click a thing to pick it. {key} uses it.',
    'ui.kit.selected': 'Picked',
    'ui.kit.beer': 'Beer',
    'ui.kit.spirits': 'Spirits',
    'ui.kit.spirits.none': 'None. Probably as well.',
    'ui.kit.slot.spirit': 'Spirit',
    'ui.kit.slot.hot': 'Hot drink',
    'ui.kit.slot.drink.takes': 'Beer only. {key} drinks it.',
    'ui.kit.slot.spirit.takes': 'A spirit. {key} sinks it.',
    'ui.kit.slot.hot.takes': 'Tea or coffee. Pick, {key}.',
    'ui.kit.slot.melee.takes': 'A weapon. {key} swaps.',
    'ui.kit.slot.special.takes': 'A {state} move. Key {n}.',
    'ui.kit.none': 'Nothing. Give it time.',
    'ui.kit.hotDrink.none': 'None. There is one at the bar.',
    'ui.kit.wrongLevel': 'That one goes in slot {n}.',
    'ui.bar.choose': 'Which?',
    'ui.bar.coffee': 'Coffee',
    'ui.bar.tea': 'Tea',

    // Casebook and deduction board
    'ui.casebook.title': 'Casebook',
    'ui.casebook.clues': 'Clues',
    'ui.casebook.leads': 'Leads',
    'ui.casebook.proof': 'Proof',
    'ui.casebook.empty': 'Nothing yet. Give it time.',
    'ui.casebook.callTitle': 'A bit of help',
    // Playtest 5. `first` lingers as a prompt the first time any clue is written down; `noted` flashes for every clue after.
    'ui.casebook.first': 'That went in the casebook. Tab opens it.',
    'ui.casebook.noted': 'Written down.',
    'ui.deduction.title': 'What does it add up to?',
    'ui.deduction.instruction': 'Link three.',
    'ui.deduction.confirm': 'That’s it',
    'ui.deduction.clear': 'Start over',
    'ui.puzzle.reset': 'Reset',

    // Speakers
    'speaker.andrew': 'Andrew',
    'speaker.myko': 'Myko',
    'speaker.dympna': 'Dympna',
    'speaker.halloran': 'Mr Halloran',
    'speaker.colleenAnn': 'Colleen-Ann',
    'speaker.pruitt': 'Agent Pruitt',
    'speaker.gary': 'Gary',
    'speaker.administrator': 'The Administrator',

    // Drinks. Pickup text: the name, the effect, then one dry sentence.
    'drink.stout.name': 'Pint of stout',
    'drink.stout.pickup': 'Pint of stout. Buzz +15. It was just sitting there, which is not like a pint.',
    'drink.lager.name': 'Can of lager',
    'drink.lager.pickup': 'Can of lager. Buzz +10. Warm. It was always going to be warm.',
    'drink.lightBeer.name': 'American light beer',
    'drink.lightBeer.short': 'Light beer',
    'drink.lightBeer.pickup': 'American light beer. Buzz +2. Andrew isn’t angry. He’s just disappointed.',
    'drink.craftIpa.name': 'Craft IPA',
    'drink.craftIpa.pickup': 'Craft IPA. Buzz +20. The can has a paragraph on it.',
    'drink.whiskey.name': 'Whiskey',
    'drink.whiskey.pickup': 'Whiskey. Top of the next level. 8 seconds: no drain, hits cost double. For the cold. It is not cold.',
    'drink.tequila.name': 'Tequila',
    'drink.tequila.pickup': 'Tequila. Straight to Fecked. Whiskey’s 8 seconds, then Buzz drops 30. Andrew has heard of it.',
    'drink.coffee.name': 'Coffee',
    'drink.coffee.pickup': 'Coffee. Bottom of Grand, at once. He does not like it. So it must be working.',
    'drink.tea.name': 'Tea',
    'drink.tea.pickup': 'Tea. Bottom of Grand, slowly, and it holds. Andrew feels better and resents it.',
    'drink.bottle.name': 'Bottle',
    'drink.bottle.desc': 'Empty. Hold right click to aim, let go to throw. One only. Two would be a habit.',

    // Pickups
    'pickup.refused.kitFull': 'The anorak holds {max} beers. He has counted the pockets.',
    // Playtest 6: spirits have their own limit, apart from the beers.
    'pickup.refused.spiritsFull': 'He has {max} spirits on him already. The inside pocket is for emergencies.',
    'pickup.refused.hotDrinkHeld': 'He has one already. It is still warm.',
    'pickup.bottles': 'Bottles +{n}.',

    // Refusals from the slots and the throw (systems return a reason code; the HUD shows these)
    'ui.move.empty': 'Nothing in that slot. Tab for the kit.',
    // Q with a weapon or a move picked; Q or G with nothing to drink (playtest 4)
    'ui.use.notADrink': 'He considers drinking it. No.',
    'ui.use.nothing': 'Nothing picked. Tab for the kit.',
    // Chapter 1, before Dympna's first pint (the meter is still hidden): Q, G and the wheel refuse. Playtest 5.
    'ui.use.notYet': 'Not yet. Dympna pours the first one. Talk to her: E at the bar.',
    'ui.spirit.none': 'No spirits. He pats the pocket anyway.',
    'ui.move.dark': 'He’d want a few more in him for that one.',
    'ui.move.cooldown': 'Not yet.',
    'ui.move.noTarget': 'Nobody near enough.',
    'ui.move.noProp': 'Nothing to stand beside.',
    'ui.move.seen': 'Too late for that. They’ve seen him.',
    'ui.throw.noBottle': 'No bottle. He’d have to drink something first.',

    // Special moves, by level (DESIGN.md 7.2). Old ability IDs are kept where the move survives.
    'ability.punchCombo.name': 'Punch',
    'ability.bottleThrow.name': 'Bottle Throw',
    'ability.shoulder.name': 'The Shoulder',
    'ability.shoulder.desc': 'A short charge, shoulder first. Knocks one of them back.',
    'ability.reflexTest.name': 'Reflex Test',
    'ability.reflexTest.desc': 'A tap below the kneecap. He folds, and cannot swing for 2 seconds.',
    'ability.actNatural.name': 'Act Natural',
    'ability.actNatural.desc': 'Stand still beside something dull. Guards look past Andrew until he moves.',
    'ability.stoutSlam.name': 'Stout Slam',
    'ability.stoutSlam.desc': 'Put it down hard. Everyone close to Andrew goes over.',
    'ability.sameAgain.name': 'Same Again',
    'ability.sameAgain.desc': 'The next three hits each land twice.',
    'ability.bedsideManner.name': 'Bedside Manner',
    'ability.bedsideManner.desc': 'Say something calm. Everyone near stops to listen for 3 seconds.',
    'ability.stumble.name': 'The Stumble',
    'ability.stumble.desc': 'A lurch in a straight line. Hits everything in the way. It looks like an accident.',
    'ability.lockIn.name': 'Lock-in',
    'ability.lockIn.desc': 'Nobody leaves. Those near Andrew are held for 4 seconds and take double.',
    'ability.secondOpinion.name': 'Second Opinion',
    'ability.secondOpinion.desc': 'Tell one of them what is about to give way. The next hit on him counts four times.',
    'ability.borrowedGlove.name': 'The Borrowed Glove',
    'ability.borrowedGlove.short': 'Borrowed Glove',
    'ability.borrowedGlove.desc': 'Stuns everyone in front of Andrew for 4 seconds. It is not his.',
    'ability.oneForTheRoad.name': 'One for the Road',
    'ability.oneForTheRoad.short': 'For the Road',
    'ability.oneForTheRoad.desc': 'One punch. It finishes anyone ordinary and takes a third off anyone who is not.',
    'ability.lastOrders.name': 'Last Orders',
    'ability.lastOrders.desc': 'Call it. Everyone ordinary on screen is left barely standing, stunned for 3 seconds.',
    'ability.barred.name': 'Barred',
    'ability.barred.desc': 'Collar and belt. One of them leaves, and lands on the others.',
    'ability.unlocked': 'New: {name}',
    'ability.learned': 'New move: {name}. Slot {n}.',

    // Melee weapons (DESIGN.md 7.2)
    // `.short` is the Tab kit list and slot name, 15 characters at most. Only names over 15 have one;
    // the list falls back to `.name`. The full name stays in the description heading.
    'weapon.fists.name': 'Fists',
    'weapon.fists.desc': 'Fast and short. Three in a row, and the third one counts.',
    'weapon.hurley.name': 'Big Tom’s hurley',
    'weapon.hurley.short': 'Tom’s hurley',
    'weapon.hurley.desc': 'A long ash stick. More reach, more damage, slower. He will want it back.',
    'weapon.clipboard.name': 'Halloran’s clipboard',
    'weapon.clipboard.short': 'Clipboard',
    'weapon.clipboard.desc': 'The fastest thing he owns. Does little, but nobody swings while being hit with it.',
    'weapon.shillelagh.name': 'Souvenir shillelagh',
    'weapon.shillelagh.short': 'Shillelagh',
    'weapon.shillelagh.desc': 'Heavy, slow, sends them far. It says KISS ME. Andrew keeps that side turned in.',
    'weapon.umbrella.name': 'Pruitt’s umbrella',
    'weapon.umbrella.short': 'Umbrella',
    'weapon.umbrella.desc': 'The longest reach. A poke that goes through two of them. Government issue.',
    'weapon.inflatableAlien.name': 'Inflatable alien',
    'weapon.inflatableAlien.short': 'Blow-up alien',
    'weapon.inflatableAlien.desc': 'The widest swing. It hurts nobody and moves everybody.',
    'weapon.securityWand.name': 'Security wand',
    'weapon.securityWand.desc': 'Fast and strong. Every third hit stuns. It beeps when it is pleased.',
    'weapon.gained': 'New weapon: {name}',

    // Enemies
    'enemy.lad.name': 'A lad',
    'enemy.cousin.name': 'A Brennan cousin',
    'enemy.suit.name': 'Department man',
    'enemy.worker.name': 'Depot worker',
    'enemy.brawler.name': 'A regular',
    'enemy.docker.name': 'Docker',
    'enemy.agent.name': 'Agent',
    'enemy.drone.name': 'Drone',
    'enemy.mascot.name': 'Mascot',
    'enemy.clerk.name': 'Clerk',
    'enemy.security.name': 'Security',

    // Bosses and set pieces
    'boss.c1.boss.bigtom.name': 'Big Tom Brennan',
    'boss.c2.setpiece.ram.name': 'The ram',
    'boss.c3.boss.halloran.name': 'Mr Halloran',
    'boss.c4.boss.foreman.name': 'The foreman',
    'boss.c5.boss.pruitt1.name': 'Agent Pruitt',
    'boss.c6.setpiece.combine.name': 'The combine',
    'boss.c7.boss.mascots.name': 'Zip, Zap and Zorp',
    'boss.c8.boss.pruitt2.name': 'Agent Pruitt',
    'boss.c9.setpiece.lockdown.name': 'Lockdown',
    'boss.c10.boss.administrator.name': 'The Administrator',

    // --- RETIRING: read by the current code, not part of the overhauled design. ---
    'ui.hud.empties': 'Bottles',
    'ui.hud.noSpecial': 'Nothing',
    'ui.hud.heat': 'Heat',
    'ui.hud.special.needBuzz': 'More drink',
    'ui.key.f': 'F',
    'ui.key.space': 'Space',
    'ui.buzz.locked': 'Bit much',
    'ui.buzz.banjaxed': 'Fecked',
    'ui.prompt.stumble': 'Space to stumble',
    'ui.prompt.special': 'F to use. R to change.',
    'ui.prompt.charge': 'Hold right click, then let go',
    'ui.prompt.deflect': 'Swing as it arrives',
    'drink.poitin.name': 'Poitín',
    'drink.poitin.pickup': 'Poitín. Buzz +60. No label. The bottle has had a previous career.',
    'drink.bourbon.name': 'Bourbon',
    'drink.bourbon.pickup': 'Bourbon. Buzz +30, and a short burst of speed. Sweet. Andrew says nothing, loudly.',
    'drink.water.name': 'Water',
    'drink.water.pickup': 'Water. Resets heat. Andrew reads the label twice to be sure.',
    'food.crisps.name': 'Crisps',
    'food.crisps.pickup': 'Crisps. Heals 10. Cheese and onion. There was no other kind.',
    'food.chickenFilletRoll.name': 'Chicken fillet roll',
    'food.chickenFilletRoll.pickup': 'Chicken fillet roll. Heals 40, cures a hangover. Andrew goes quiet for a moment, out of respect.',
    'food.breakfastRoll.name': 'Breakfast roll',
    'food.breakfastRoll.pickup': 'Breakfast roll. Heals 40, cures a hangover. Everything in it is a different temperature.',
    'food.spiceBag.name': 'Spice bag',
    'food.spiceBag.pickup': 'Spice bag. Heals fully. Still warm. Some things are meant.',
    'food.tea.name': 'Tea',
    'food.tea.pickup': 'Tea. Buzz −25, cures a hangover, steadies the hand. Andrew feels better and resents it.',
    'pickup.refused.noFreeSlot': 'Andrew has no pocket left for a third kind of anything.',
    'pickup.refused.slotFull': 'He has enough of those. He checks. He has enough.',
    'pickup.refused.emptiesFull': 'The anorak is clinking as it is.',
    'pickup.refused.noEffect': 'He doesn’t need it. He leaves it where he can find it.',
    'pickup.empties': 'Bottles +{n}.',
    'ability.hurley.name': 'Hurley',
    'ability.sliotarStrike.name': 'Sliotar Strike',
    'ability.poitinBreath.name': 'Poitín Breath',
  },
  sequences: [
    ...barSober.sequences,
    ...barFloor.sequences,
    ...zero.sequences,
    ...sober.sequences,
    ...low.sequences,
    ...bitMuch.sequences,
    ...fecked.sequences,
    ...drinkComment.sequences,
    ...whiskey.sequences,
    ...tequila.sequences,
    ...hotDrink.sequences,
    ...meterGrows.sequences,
    ...idle.sequences,
    ...callRefusedNone.sequences,
    ...callRefusedNotNow.sequences,
    ...death.sequences,
    ...hangover.sequences,
    ...banjaxed.sequences,
    ...heat.sequences,
    ...heatDrink.sequences,
    box('myko.callRefused.administrator', ['myko', "No. This one's yours. I'll be here.", 'by phone']),
    box(
      'myko.callRefused.administrator.callsLeft',
      ['myko', "No. This one's yours.", 'by phone'],
      ['myko', "I'll hang on to the others for you. You won't need them."],
    ),
    box('myko.cleanRun', ['myko', 'Nobody saw you. I barely saw you, and I was looking.']),
    box('myko.caught', ['myko', "They've seen you. Go on, so. Plan B was always the plan."]),
    // A second call in the one chapter: the same scene in every chapter.
    scene(
      'myko.call.again',
      ['myko', 'Again.'],
      ['andrew', 'It was a different thing.'],
      ['myko', "It was the same thing, Andrew. It was a thing you couldn't do. Same place, same day, same face on you."],
      ['myko', "You get three of me. For the whole lot. There's a world out there you want to show something to, and you can't get out of the one postcode without ringing me."],
      ['andrew', 'I had it mostly done.'],
      ['myko', "You'd it mostly started. Will I just stay standing beside you? Save you holding the button."],
      ['myko', "Three-time winner of the Feeney's table quiz. I'd love to have seen the other tables."],
    ),
    // The third call when all three went in the one chapter. The hardest he is on Andrew. Hard, not cruel.
    scene(
      'myko.call.allThree',
      ['myko', 'That was the three.'],
      ['andrew', 'I know.'],
      ['myko', "All three, Andrew. In the one place. There's a long road ahead of us, by your own account, and you've nothing left for it now but yourself."],
      ['myko', "I've watched you lose to a fruit machine, a stile and a seagull. I thought I'd seen the full range. I had not."],
      ['andrew', 'They were hard ones.'],
      ['myko', "They were not. I've had more trouble opening crisps."],
      ['myko', "So I'm back to advising, and here's the advice. Whatever's next, you're all that's coming. I'd pity it, only it'll be grand. It's you I'd pity."],
      ['myko', "Go on. I'll be right behind you. A good bit behind you."],
    ),
  ],
  pools: {
    ...barSober.pool,
    ...barFloor.pool,
    ...zero.pool,
    ...sober.pool,
    ...low.pool,
    ...bitMuch.pool,
    ...fecked.pool,
    ...drinkComment.pool,
    ...whiskey.pool,
    ...tequila.pool,
    ...hotDrink.pool,
    ...meterGrows.pool,
    ...idle.pool,
    ...callRefusedNone.pool,
    ...callRefusedNotNow.pool,
    ...death.pool,
    ...hangover.pool,
    ...banjaxed.pool,
    ...heat.pool,
    ...heatDrink.pool,
  },
};
