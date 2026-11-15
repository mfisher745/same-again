# Design: *Same Again* (working title)

Owner: `creative-director`. Every other agent builds against this document and does not change it. Send questions and proposed changes to the creative director.

## 1. Summary

A comedic top-down action-adventure for PC browsers, played with mouse and keyboard. Andrew, a drinker from a small Irish town with a chip on his shoulder, is sure that aliens are real and surer still that proving it will finally show everyone. Over ten chapters he follows the evidence from a bog in County Leitrim across the United States to a base in the Nevada desert. He is right about everything. He proves it to the whole world, and the world does not care. His best mate Myko does. Whether Myko is there at all is never settled.

- Length: 10 chapters of about 6 minutes each, about one hour in total.
- Play per chapter: a mix of investigation, a puzzle, stealth and combat.
- The one thing the player manages throughout is how drunk Andrew is. There is no health. Too sober or too drunk and he is back at the bar (7.1).
- Delivery: a static site on GitHub Pages, installable as a PWA and playable offline.
- Assets: everything is generated in code. There are no downloaded images, fonts or audio.

## 2. Tone

The comedy is dry and deadpan. The jokes come from people reacting calmly to absurd things, and from Andrew treating small things as serious and serious things as small. It is Irish wit of the familiar kind: quick, dry and fond, and aimed at anyone getting above themselves, the speaker included.

Rules for every line of text:

- Understate. A line that announces it is a joke gets cut.
- Andrew is pathetic but lovable. The player laughs at his situation and is on his side. He is never cruel, and he is never the butt of a joke about being Irish.
- No cartoon Irishness. No leprechauns, no "top o' the morning", no "begorrah", no lucky charms, no stage accent spelled out phonetically.
- Americans may say those things *to* Andrew. His tired reaction is the joke.
- It sounds Irish through rhythm and wit more than vocabulary. The shape of the sentence does the work: the understatement, the comeback that arrives a beat late, agreeing in order to refuse ("I will, yeah"), a question answered with a question, great patience with small things.
- A player who has never been to Ireland must be able to follow every line and get every joke. Irish words are seasoning. Use the ones most English speakers half-know already, about one to an exchange, and never hang a joke on a word the player might not have. If a line only works for someone who knows the word, rewrite the line.
- No glossary, and nobody explains a word.
- No real people, real brands, real song lyrics or real company names. The one exception is that a famous fictional character may be named in passing as a comparison, never shown and never quoted.
- Text only. There is no voice acting.

Words and references the writing can draw on:

| How much | Examples |
|---|---|
| Freely | grand, sound, eejit, the craic, fair play, lads, "sure look", "I will, yeah" (meaning no), "c'mere to me", "go 'way", a pint, tea as the answer to everything, a mammy's guilt, the county team's bad year, saying "bye" six times to end a phone call |
| Now and then, where the line makes the meaning obvious | gobshite, yer man, yer one, giving out, slagging, notions, knackered, the dole, the parish lotto, the mart, the chipper, a lock-in, turf, a chicken fillet roll, a spice bag |
| Leave out | banjaxed, scarlet, deadly (it reads as its opposite), the messages, the press, the jacks, a naggin, "now we're sucking diesel", "it's a soft day", the immersion, hang sandwiches, a 99, the Angelus, a removal, the NCT |

Voice samples. These set the register; they are not required lines.

> **Myko:** You've found a scorched circle in a bog. Lads burn things in bogs, Andrew. It's most of what there is to do here.

> **Andrew:** That's a part number.
> **Myko:** It is. Off a tractor.
> **Andrew:** There's no tractor does forty thousand feet.
> **Myko:** You haven't seen the Brennans drive.

> **Bostonian:** My great-great-grandmother was from County Cork! Do you know the Sullivans?
> **Andrew:** I do, yeah.
> **Myko:** *(quietly)* You don't.
> **Andrew:** It's quicker.

> **Myko:** Look at that. A car park you could land a plane in, and it's free. They just let you have it.
> **Andrew:** It's a car park.
> **Myko:** It's Ohio, Andrew.

> *After calling Myko in:*
> **Myko:** No, you'd them well softened up. I could tell by the way they were all still standing.

> *Pickup text:* **American light beer.** Buzz +2. Andrew isn't angry. He's just disappointed.

## 3. Characters

### Andrew (player character)

- 38, from Kilnamoe, County Leitrim (a fictional town). On the dole since he lost his licence. Three-time winner of the Feeney's table quiz, which he mentions.
- He was a doctor, the GP in Kilnamoe, until he was struck off the register. The reason is never stated: not by him, not by Myko, not by the narrator, and not in a joke that gives it away. Nobody asks. People at home still call him Doctor out of habit and still tell him their symptoms, and he says he can't look at it. Several of his special moves come from the old job (7.2).
- Short and slight. He is about half a head shorter than Myko and he is not pudgy. He wears a worn green-grey anorak, jeans and runners, and has a full dark beard and tired eyes.
- He has a chip on his shoulder. He wants to prove himself to the world, and it does not matter how. Aliens are what turned up. If it had been a record-breaking turnip he would have gone after that with the same face.
- He believes in aliens with complete, calm certainty. He is polite, stubborn and hopeless with money, and he is braver than he should be once he has had a few.
- He never says any of this out loud. It shows in what he mentions (the table quiz), in who he brings up without being asked (people from school who "did well"), and in how much he hates asking Myko for help.
- He speaks in short sentences. He never explains himself more than once.

### Myko (sidekick and narrator)

- Andrew's best mate since school. Nobody remembers why he's called Myko, and he won't say.
- He is half a head taller than Andrew, thin, with a long coat, untidy brown hair, no hat and a permanent half-smile.
- He is sardonic and condescending to Andrew in almost every line. He is also completely loyal. He pays for the flights, carries the bags and never once suggests going home. Nobody sees him do any of it.
- He drinks, but he prefers to smoke cannabis. He is usually mildly stoned, which is shown by a rolled cigarette, slow blinks, the odd tangent and, about once a minute when he is standing still, a puff of smoke that hangs around his head until he moves. It is never shown as a how-to and it is never a power-up.
- His commentary does most of the narration. A narrator caption appears only for chapter titles, location cards and the blackout when Myko is called in.
- He sometimes offers an idea or a hint. Some of his ideas are good.
- He does not fight unless Andrew asks him to. His position on this: "I'm here in an advisory capacity." When he is asked, he is immediately and effortlessly better at everything than Andrew is, and he never explains how (see 7.5).
- He loves Ohio. Nothing prepares the player for this and he gives no reason. For all of chapter 6 he marvels at it: the width of the roads, the motel ice machine, the size of the sky, the manners. It is sincere, with no sarcasm in it at all, and it is the only thing besides the ending that he is sincere about. Andrew does not see it and Myko pities him for that.
- From chapter 7 onwards, most of his tangents are about Ohio. Roswell, Nevada and an alien base are all compared with it and found wanting.
- At the end he is the only person in the world who is excited by what Andrew found.

**Is Myko there?**

The game never says. It must be possible to play it through believing he is Andrew's oldest friend, and possible to play it through believing Andrew made him up, and neither player should be able to prove the other wrong.

- Nobody except Andrew ever speaks to Myko, answers him, looks at him or mentions him. Other characters talk to Andrew. Where one of them seems to react to something Myko said, Andrew has also said or done something that explains it.
- Everything Myko does happens where nobody can see it, or could have been Andrew. The flights get paid for. The bags arrive. When he is called in, the screen is black and comes back with the work done.
- Nothing shows that he is not there, either. He knows things Andrew does not, and some of his hints are right. He has a shadow, his smoke hangs in the air, and doors do not behave oddly around him. There is no visual tell in either direction.
- The player is never given a count: of glasses, tickets, beds or seats.
- Nobody raises the question, including Andrew and the narrator. No line winks at it. A line that tells the player which answer is right gets cut.
- When Andrew is stone sober (7.1), Myko says nothing. It is the only time in the game he has nothing to say. That is as close as the game comes.

### Supporting cast

| Character | Where | Role |
|---|---|---|
| Dympna Feeney | Kilnamoe | Landlady of Feeney's. Unimpressed by everything. Gives the tutorial as a list of things Andrew owes her. Makes the tea. |
| Mr Halloran | Kilnamoe | "Regional manager" of Meridian Agri-Solutions. Boss of chapter 3. |
| Colleen-Ann | Boston | Bartender who is extremely proud of being Irish and has never been. A useful ally. |
| Agent Pruitt | DC onwards | Senior agent of the Office of Atmospheric Records. Tired, courteous and three years from his pension. Boss of chapters 5 and 8. |
| Gary | Roswell | An alien who has worked in a UFO gift shop for 19 years. He likes it there. |
| The Administrator | Nevada | The alien in charge of the base. Final boss. Would prefer not to be having this conversation. |

## 4. Story

Andrew sees lights over the bog outside Kilnamoe. In the morning there is a scorched ring in the turf and a metal fragment stamped with a part number. Men in suits arrive and say they are from the Department of Agriculture. The fragment traces to the local depot of Meridian Agri-Solutions, a company that sells nothing anyone in town has ever bought. Its shipping records point to Boston.

Myko pays for the flights. In America the trail runs west: a freight contractor in Boston, a federal records office in Washington, a test site in the Ohio cornfields, a gift shop in Roswell and at last a base in the Nevada desert. Along the way the enemies change from local hard men to federal agents to the aliens themselves.

Andrew gathers proof, gets into the base, beats the Administrator and broadcasts everything to every screen on Earth. The broadcast works. Governments confirm it within the hour. It is the third item on the news, after the weather. His video gets 41 views. Back in Feeney's, Dympna says "Aliens, is it? Fair play," and asks if it's the same again.

Myko drops the act about Andrew for the first time in the game. Until now he has only been sincere about Ohio. He is delighted. He has slagged Andrew for twenty years and Andrew was right, and he wants to hear every detail again from the start. Andrew set out to prove himself to the world and the world did not look up. That is the ending: one person cared, and it was the right one. Myko's last tangent is that they should tell them about this in Ohio.

The scene plays the same whichever way the player has read Myko, and it does not choose. Either Andrew has the one friend who matters, or he has nobody, and has made himself a friend who is finally proud of him. Dympna asks is it the same again. She does not say how many.

## 5. Chapters

Each chapter starts in a bar, with Buzz at the bottom of Grand. A bar is wherever there is drink, somewhere to sit and a way to get a hot drink; it does not have to be a pub. Andrew comes back to it every time he ends up sober or on the floor (7.1).

Each chapter has an investigation beat, a puzzle or deduction, a stealth section and a combat section, in whatever order suits it. Each ends with a boss or set piece and a short scene with Myko. Some bosses leave a melee weapon behind (7.2).

The number after a special move is the drunk level whose slot it goes in.

| # | Title | Location | The bar | What happens | New this chapter | Finale | Weapon won |
|---|---|---|---|---|---|---|---|
| 1 | A Quiet Pint | Feeney's pub and Main Street, Kilnamoe, at night | Feeney's | Tutorial. The meter, punching, drinking and throwing a bottle. A row outside the chipper. The lights over the bog. | The Buzz meter, the kit, **The Shoulder** (1), **Stout Slam** (2) | Big Tom Brennan, who wants the tenner back | Big Tom's hurley |
| 2 | The Bog | The bog and Brennan's farm, before dawn | A lean-to at the edge of the bog with a crate, two chairs, a flask and an honesty box | First investigation: scorched turf, the fragment, tyre tracks. First stealth, past the "Department" men. | Casebook, stealth, **Reflex Test** (1), **The Stumble** (3) | Escape from a very committed ram | None |
| 3 | Regional Office | Meridian depot on the edge of town | The depot's staff social club: a locked room with a dartboard and a fridge | Break in, find the shipping manifest, solve the loading-bay crate puzzle. | First deduction board, **Same Again** (2), **One for the Road** (4) | Mr Halloran and his forklift | Halloran's clipboard |
| 4 | Southie | Boston: an "Irish" bar and the docks | Colleen-Ann's bar | Americans explain Ireland to Andrew. Find the freight contractor. | American beers, **Bedside Manner** (2) | Bar brawl, then the dock foreman | The foreman's souvenir shillelagh |
| 5 | The Paper Trail | Washington DC: a federal records office | The bar of the hotel across the street, at ten in the morning | The stealth chapter. A redacted-file puzzle. Agents appear in numbers. | Agents, **Act Natural** (1), **Lock-in** (3) | Agent Pruitt, round one, in the archive stacks | Pruitt's umbrella |
| 6 | Flyover Country | Ohio: a bus station, a motel, cornfields | The motel lounge | Crop circles as a maze puzzle. Surveillance drones. Myko is having the best week of his life and says so throughout. | Drones, **Second Opinion** (3) | The combine harvester | None |
| 7 | Gift Shop | Roswell, New Mexico | A themed bar on the strip. The drinks are green. | Everyone is dressed as an alien. Some of them are aliens. Work out which. | Aliens in disguise, tequila, **Last Orders** (4) | Three "mascots" who are not mascots | An inflatable alien |
| 8 | The Long Road | Nevada desert, the perimeter | A roadhouse at the last junction before the fence | Sensors, patrol trucks and heat. Out in the sun the meter drains twice as fast and drink goes half as far again. | Heat and sensor stealth, **Barred** (4) | Agent Pruitt, round two. He lets Andrew through and retires. | None |
| 9 | Level Minus Four | Inside the base | The staff social area. It is very like the one in the Meridian depot. | Alien technology, gravity-switch puzzles and the last five pieces of proof. | Alien enemies, **The Borrowed Glove** (3) | The containment hall lockdown | A security wand |
| 10 | Disclosure | Base control room, then Feeney's | The drinks cabinet in the Administrator's outer office | The final fight, the broadcast, the world's reaction and home. | Everything | The Administrator, then the epilogue | None |

Locations are small. Each chapter uses two to four connected screens, counting the bar, and no chapter needs more than about 120 by 80 tiles in total. The bar is on the first screen, so the walk back from it is short.

## 6. Controls

| Input | Action |
|---|---|
| WASD | Move. There is no dodge. |
| Mouse | Aim |
| Left click | Melee attack with the weapon in the melee slot |
| Right click (hold, then release) | Aim a bottle, with its path shown, then throw it |
| R | Cycle to the next melee weapon |
| Q | Use the picked item: a beer or the hot drink. Does nothing if the picked item is not a drink. |
| G | Drink what is in the spirit slot (whiskey or tequila), at once |
| Mouse wheel | Move the pick to the next kind of beer he has. The hot drink is picked in the kit. |
| 1, 2, 3, 4 | Special moves, one for each drunk level |
| Shift | Sneak (hold) |
| E | Interact, talk, examine |
| H | Ask Myko for a hint |
| M (hold for 1 second) | Call Myko in (three uses per game) |
| Tab | Casebook and kit (7.7). Toggle or hold, chosen in Settings. The game is paused while it is open. |
| Esc | Pause |

## 7. Systems

### 7.1 Buzz

There is no health. The one thing the player manages is how drunk Andrew is. Drinking raises the Buzz meter, time lowers it, and being hit pushes it the wrong way. At either end Andrew is back at the bar.

| Level | State | Buzz in chapter 1 | Buzz by chapter 10 | Melee damage | Special slots | What it is like |
|---|---|---|---|---|---|---|
| | Sober | 0 | 0 | | | Back to the bar. |
| 1 | Buzzed | 1 to 34 | 1 to 51 | ×1 | 1 | Steady. Below 10 the colours start to flatten, and Andrew remarks on how clear everything is and how little he likes it. |
| 2 | Grand | 35 to 65 | 52 to 98 | ×1.5 | 1, 2 | Steady. |
| 3 | Bit much | 66 to 90 | 99 to 123 | ×2 | 1, 2, 3 | Aim sways (the throw preview shows it), movement drifts, footsteps are louder in stealth and the screen wobbles slightly. |
| 4 | Fecked | 91 to 99 | 124 to 132 | ×3 | 1, 2, 3, 4 | All of that, worse. Even sneaking can be heard at short range. |
| | On the floor | 100 | 133 | | | Back to the bar. |

- **The meter grows.** Andrew gets used to it. Over the game the meter gets about a third longer, from 100 to about 133. All of the growth goes to Buzzed and Grand, in roughly equal shares; Bit much and Fecked stay as wide as they started. It grows a little at the start of each chapter after the first (the steps are in `tuning.ts`), and the bar on the HUD gets longer with it. The player gains room in the safe middle and keeps the same thin margin at the top.
- Anything below that is given as a place on the meter (the start, coffee, whiskey, tequila) moves with the levels. Drain, hits and the strength of a beer are fixed numbers of points and do not grow.
- **Start.** Every chapter, and every return to the bar, starts at the bottom of Grand: 35 in chapter 1.
- **Drain.** Buzz falls at one constant rate, about 1 point every 3 seconds, from the moment the chapter starts. There is no pause after a drink. In chapter 1 it goes from the start to 0 in under two minutes if Andrew drinks nothing.
- **Being hit.** Enemies do not damage Andrew. A hit moves the meter away from the middle: at levels 1 and 2 it lowers Buzz, and at levels 3 and 4 it raises it. An ordinary hit moves it about 5, a heavy one about 10 and a boss's worst about 15. Andrew still flinches and is knocked back.
- **The trade.** Grand is the safe middle. Above it Andrew hits harder and has stronger moves, but his aim goes and every hit shoves him towards the floor. Below it nothing is wrong with him except that he is running out. The player chooses how much to risk.

**Back to the bar**

- **Sober.** At 0 the music stops and the colours go flat. Andrew stands still and looks at where he is and what he is doing. Myko says nothing. The screen fades and they are at the bar.
- **On the floor.** At the top of the meter Andrew falls over. Myko runs over, which he does nowhere else, and blows out a cloud of smoke that fills the screen. The screen goes to black and they are at the bar.
- Either way Buzz is at the bottom of Grand, a hot drink is on offer again, and Andrew is topped up to at least two beers and his one bottle (see "The bar's top-up" below). Myko has a line about it, drawn from a pool: one pool for sober, one for the floor.
- **Progress is kept.** Clues, solved puzzles, stealth sections already passed, opened doors and beaten encounters all stay as they were. Guards from a section Andrew has passed are gone. A fight or boss he was in the middle of starts again from its beginning. The punishment is the walk back.
- This replaces death and checkpoints. Nothing else sends Andrew back.

**The kit**

Drinks are not drunk when they are picked up. They go into Andrew's kit (7.7). He drinks the picked beer or hot drink with Q and the spirit in the spirit slot with G. The kit carries over from chapter to chapter; Buzz does not.

Andrew carries six drinks at most, in any mix. The hot drink and his bottle do not count towards the six. When he is full, a drink stays where it is on the ground. Six is a starting number, to be settled by playing chapter 1.

| Drink | Found | Effect |
|---|---|---|
| Pint of stout | Ireland, the Boston bar | Buzz +15 |
| Can of lager | Ireland | Buzz +10 |
| American light beer | USA, very common | Buzz +2. Worth more as a bottle. |
| Craft IPA | USA cities | Buzz +20. Myko has an opinion about each one. |
| Whiskey | Everywhere, rare | Buzz jumps to the top of the next level up. From Bit much or Fecked that is the top of Fecked, one short of the floor. For the next 8 seconds the meter does not drain, and every hit lowers Buzz, whatever his level, by twice the usual amount. |
| Tequila | Chapter 7 onwards, rarer than whiskey | Buzz goes to the middle of Fecked from anywhere. For the next 8 seconds it behaves as whiskey does: no drain, and every hit lowers Buzz by twice the usual amount. Then it wears off all at once and Buzz drops by 30. |
| Coffee | The bar only | Sets Buzz to the bottom of Grand at once, from above or below. |
| Tea | The bar only | Brings Buzz to the bottom of Grand over about 10 seconds, then holds it there with no drain for 20 more. |

- **Not before the first pint.** In chapter 1 the Buzz meter is hidden until Dympna pours the first pint. Until then Andrew does not drink: Q, G and the wheel refuse, with one short line on the HUD (`ui.use.notYet`). He still picks things up and keeps them.
- **Three kinds of drink, three slots.** Beer goes in the drink slot (Q). Whiskey and tequila go in the spirit slot (G). Coffee and tea go in the hot drink slot (pick it, then Q). Nothing goes in a slot of another kind.
- **The bar's top-up.** At every chapter start and every return to the bar, Andrew is topped up to at least two beers of the region (`carry.minBeersOnLeavingBar`, 2) and to one bottle (`carry.minBottlesOnLeavingBar`, 1, which never exceeds the bottle limit). If he has more beer he keeps it. Nothing is taken away.
- **Beer** is anything in the first four rows. More kinds can be added by region, each with its own strength. Every beer does the same thing apart from the number.
- **The hot drink.** Each visit to the bar, at the start of a chapter and after every return, Andrew is offered one free coffee or tea and takes it with him. He carries one at a time. Coffee and tea are not found anywhere else: not in breakables, not on enemies, not as a reward.
- **Bottles.** A beer has to be drunk before it can be thrown. Every beer Andrew drinks leaves him one bottle, whatever the beer was. He carries one bottle at most (`carry.bottleLimit`, 1): a beer drunk while he is holding one leaves nothing, and a bottle on the ground stays there until he has thrown his. Bottles are the only thing he throws, and every thrown bottle looks the same. He leaves the bar with one. Whiskey and tequila do not leave a bottle.
- **Breakables.** Most loose objects in the world can be broken with a melee hit or a thrown bottle: crates, barrels, bins, boxes, flowerpots, vending machines and their like. If Andrew can walk up to it and it is not part of a puzzle or the plot, he should be able to break it. A broken object holds a drink or nothing: usually the beer of the region, now and then a whiskey. Never food, never a hot drink. There should be too much beer rather than too little, most of all early: a breakable holds a beer half the time, and more often than that in chapters 1 to 4 (three times in four in chapter 1, falling to the usual half by chapter 5). Chapters are dressed with plenty of things to break. After playtest 5 the areas of chapters 1 and 2 carry about 40% fewer breakables that can hold beer; the drop chances are unchanged. The numbers are in `tuning.ts`.
- **Enemies** drop drink the same way when they go down: usually the regional beer (two times in five, more in chapters 1 to 4), rarely a whiskey, and from chapter 7 very rarely a tequila.
- There is no food, no hangover and no second meter.
- **Heat (chapter 8).** While Andrew is out in the sun the meter drains twice as fast, and drink goes half as far again: a beer adds one and a half times its number, and a whiskey or tequila lasts one and a half times as long. In the shade both are normal.

### 7.2 Combat and abilities

Combat is fast and readable, with a handful of enemies on screen at a time. Enemies telegraph every attack. Andrew has no dodge and no block. He gets out of the way by walking.

**Melee**

Left click attacks with the weapon in the melee slot. R cycles through the weapons Andrew owns. Damage is the weapon's own, multiplied by the drunk level (7.1). Bosses leave weapons behind; Andrew keeps every one.

| Weapon | From | What it is like |
|---|---|---|
| Fists | The start | Fast and short. Three hits; the third is a haymaker with knockback. |
| Big Tom's hurley | Chapter 1 | Longer reach and more damage. Slower. |
| Halloran's clipboard | Chapter 3 | The fastest. Very little damage, but each hit interrupts whatever the enemy was about to do. |
| Souvenir shillelagh | Chapter 4 | Heavy and slow, with a lot of knockback. Andrew does not like being seen with it. |
| Pruitt's umbrella | Chapter 5 | The longest reach. A straight poke that goes through two enemies. |
| Inflatable alien | Chapter 7 | The widest swing. Hits everything in front of him, does next to no damage and knocks all of it back a long way. |
| Security wand | Chapter 9 | Fast and strong. Every third hit stuns. |

**Thrown bottles**

Holding right click aims a bottle and releasing it throws the one he has (7.1). While the button is held, a dotted arc shows the bottle's path from Andrew to where it will land. The preview is steady at Buzzed and Grand. It starts to sway at Bit much and sways more the drunker Andrew is, most at Fecked. The bottle goes where the preview points at the moment of release, so the sway is something the player times and never a hidden chance of missing. It is the only ranged attack in the game. It does a fixed amount of damage that the drunk level does not change, and it makes a noise where it lands, which distracts guards.

**Special moves**

- Andrew has four special slots, on keys 1 to 4. Each slot belongs to a drunk level. A slot works while Andrew is at its level or higher, so at Grand slots 1 and 2 work, and at Fecked all four do.
- Each level has several moves. The player puts one move in each slot from the kit screen (7.7), and a slot only takes moves of its own level.
- Moves cost no Buzz. Each has a cooldown, and the stronger the move the longer the cooldown: about 5 seconds at level 1, 12 at level 2, 25 at level 3 and 60 at level 4.
- If Buzz drops below a slot's level the slot goes dark. Its cooldown keeps running.
- Level 4 moves are close to a one-shot. They are also the ones Andrew can only use while one drink or two hits from the floor.
- Moves are learned one or two a chapter (section 5).

| Level | Move | From | What it does |
|---|---|---|---|
| 1 | The Shoulder | Chapter 1 | A short charge, shoulder first. Knocks one enemy back. |
| 1 | Reflex Test | Chapter 2 | A sharp tap below the kneecap. One enemy is staggered and cannot attack for 2 seconds. |
| 1 | Act Natural | Chapter 5 | Standing still beside a prop (a queue, a noticeboard, a vending machine), Andrew cannot be seen by guards until he moves. Does nothing once a guard has seen him. |
| 2 | Stout Slam | Chapter 1 | Knocks down everyone close to Andrew. |
| 2 | Same Again | Chapter 3 | His next three melee hits each land twice. |
| 2 | Bedside Manner | Chapter 4 | Andrew says something calm. Everyone near him stops to listen for 3 seconds. |
| 3 | The Stumble | Chapter 2 | A lurch in a straight line that hits everything in the way. It looks like an accident. It does not make him invulnerable. |
| 3 | Lock-in | Chapter 5 | Nobody leaves. Enemies near Andrew are held where they stand for 4 seconds and take double melee damage. |
| 3 | Second Opinion | Chapter 6 | Andrew tells one enemy exactly what is about to give way. The next hit on that enemy does four times the damage. |
| 3 | The Borrowed Glove | Chapter 9 | Alien gadget. Stuns everyone in a wide cone for 4 seconds. Outside the slot, it also operates gravity switches with E. |
| 4 | One for the Road | Chapter 3 | One punch. It finishes any ordinary enemy and takes a third off a boss. |
| 4 | Last Orders | Chapter 7 | Andrew calls it. Every ordinary enemy on screen is left with a sliver of health and stunned for 3 seconds. Bosses lose a fifth. |
| 4 | Barred | Chapter 8 | Andrew picks up one enemy and throws him out. An ordinary enemy is gone; anyone he lands on is badly hurt. A boss cannot be lifted and takes the damage instead. |

When Andrew ends up sober or on the floor he goes back to the bar (7.1). There is no other way to fail.

### 7.3 Stealth

- Guards have visible vision cones and react to noise.
- Sneaking (hold Shift) is quiet and slow. At Bit much footsteps are louder, and at Fecked even sneaking can be heard at short range.
- A guard who sees Andrew fills a detection marker over about one second. If it fills, the stealth section becomes a fight: an alarm sounds and reinforcements arrive.
- **Getting caught is never a restart.** A clean run is rewarded, not required. Each stealth section has one reward, chosen in its chapter spec from these:
  - an extra clue, one the casebook does not need but Myko has a note on;
  - a rare drink: a whiskey, or later a tequila;
  - a way back: a door or gate that opens from the far side and shortens the walk from the bar for the rest of the chapter;
  - a drink from home: in America, a stout that somebody brought over.

### 7.4 Investigation and puzzles

- **The glint.** A clue that has not been examined, and the thing the current objective points at, gives a small soft glint every few seconds while Andrew is within about four tiles of it. From further away there is nothing to see. It is two or three pixels of light for under half a second: enough to catch the eye, never a marker or an arrow. A chapter spec may mark a clue as hard to see (the three ring clues in chapter 2 are), and those glint a little more often and from six tiles. Radius and timing are in `tuning.ts`.
- Examining things with E adds clues to the **casebook**, written in Andrew's words with Myko's notes in the margin. The notes are in a different pen. The handwriting is not very different. The casebook is on the Tab screen beside the kit (7.7).
- **The casebook notice.** The first time any clue goes into the casebook, in any chapter, a prompt stays up saying that it went in and that Tab opens it (`ui.casebook.first`). Every clue after that gets a brief flash of a word or two (`ui.casebook.noted`).
- Most chapters end their investigation with a **deduction board**: the player links three clues to name the next lead. A wrong answer costs nothing except a remark from Myko.
- Each chapter has one physical puzzle (crates, redacted files, the crop-circle maze, telling aliens from people, gravity switches). Each must be solvable in under two minutes.
- Chapter 9 requires five pieces of proof. They are the items shown in the final broadcast.

### 7.5 Myko

- He walks behind Andrew outside combat and stealth. During those he waits at the entrance and talks by phone, unless he is called in.
- He cannot be hurt and never needs protecting. Enemies do not look at him.
- H asks for a hint about the current objective. The first hint is a nudge, the second is the answer, and both arrive wrapped in an insult. The first hint is followed by one more line that names where the objective is: the screen and the part of it (`<chapter>.hint.<objective>.where`). Every objective has one.
- He comments without being asked on clues, drinks, returns to the bar and long periods of the player doing nothing. Nobody but Andrew hears any of it (section 3).
- Commentary must never block play. Lines appear in a box at the bottom of the screen and play continues, except in scripted scenes.
- Nothing is said twice. A scripted scene, a lesson or a remark tied to a place plays once per save and never again, even after a return to the bar or a reload. Only three kinds of line may repeat: hints the player asks for, lines drawn from a pool (back at the bar, idle, tangents), and the line for an object the player deliberately examines again. A remark that has been waiting behind other lines is dropped if Andrew has left the screen or the moment it was about.
- In chapter 6 his unprompted commentary is mostly admiration for Ohio. From chapter 7 on, about two in three of his tangents are about Ohio.

**Calling Myko in**

- Holding M asks Myko to finish the current fight or puzzle. Andrew has **three calls for the whole game**. They do not refill, and the number left is stored in the save.
- It works on any combat encounter, any boss or finale set piece, any physical puzzle and any deduction board. It does not work on stealth sections that have not turned into a fight, and it does not work on the Administrator. Andrew does that one himself.
- Myko always succeeds, at once and without effort, and the player never sees how. The screen cuts to black. Three narrator cards say, flatly, how little time it took and how little trouble it was. Each of the three calls has its own cards, chosen by whether it is the first, second or third call of the save and whether it is a fight or a puzzle, so the player never sees the same cutscene twice. The game comes back with every enemy on the ground, or the puzzle solved, and Myko standing where he was, still smoking. How he can do any of this is never explained, and nobody asks.
- Afterwards he gives Andrew a good-natured hard time about it. The slagging is warm, and it is the fondest he sounds before the ending. Each chapter has its own lines for a fight call and a puzzle call. A second call inside one chapter gets a different scene, the same one in every chapter and for both kinds of call (`myko.call.again`), in which Myko gives Andrew a much harder time for needing him twice in the same place. If all three calls are spent inside one chapter, the third gets its own scene (`myko.call.allThree`), also shared by every chapter. It is the hardest Myko is on Andrew anywhere in the game: hard, never cruel, and he is still coming with him at the end of it.
- A call costs Andrew nothing except his pride. The encounter counts as complete and gives its normal rewards. It is recorded in the casebook in Andrew's words, briefly and inaccurately ("Myko helped a bit"), with Myko's correction in the margin.
- The call is spent the moment it is used and the game saves immediately, so reloading does not give it back.
- If the player finishes the game with all three calls unused, Myko remarks on it in the epilogue. He is nearly impressed.

### 7.6 Saving

Progress saves automatically to the browser's local storage whenever something is finished: a clue found, a puzzle solved, a stealth section passed, an encounter or boss beaten, a move or weapon gained, a Myko call used. The kit is saved with it. Loading a save puts Andrew in the chapter's bar with Buzz at the bottom of Grand and everything finished still finished, exactly as a return to the bar does. The title screen offers Continue, New Game and Chapter Select for finished chapters.

### 7.7 The Tab screen

Tab opens one screen with two parts, the casebook and the kit. The game is paused while it is open. A setting chooses whether Tab toggles the screen (the default) or shows it only while held.

**Kit**

The kit has two halves, **Items** and **Moves**. In each, the things Andrew has sit beside the slot that takes them, and every slot carries a label saying what it takes and which key works it.

| Half | Row | What is listed | Its slot | Key |
|---|---|---|---|---|
| Items | Beer | Each kind with its count, and how many of the six places are used | Drink slot | Q; the wheel changes it |
| Items | Spirits | Whiskey and tequila with their counts | Spirit slot | G |
| Items | Hot drink | The coffee or tea, if he has one | Hot drink slot | Pick it, then Q |
| Items | Weapons | The weapons he owns | Melee slot | Left click; R swaps |
| Items | Bottles | The one bottle, or none. Nothing to pick. | None | Right click |
| Moves | Level 1 to 4, one row each | The moves he has learned at that level | Special slot 1 to 4 | 1 to 4 |

- **Picking.** There are no buttons. Clicking a thing picks it, and one thing is picked at a time. The pick is shown in the kit and on the HUD, and it is saved.
- **Picking fills the slot.** A picked beer is the drink slot. Clicking a spirit puts it in the spirit slot, a weapon in the melee slot, and a move in the special slot of its level. Every thing fits exactly one slot, so the player never chooses a slot.
- **Q uses the pick.** On a beer or the hot drink, Q drinks it, in the kit or out of it; it takes effect at once and the meter shows it. On a weapon or a move, Q does nothing and Andrew says so, briefly. When the picked beer runs out, or the hot drink has been drunk, the pick moves to the next beer he has.
- **G drinks the spirit.** Whatever is in the spirit slot is drunk at once, with no aiming and no pause, in the kit or out of it. The effect is as in 7.1. When that spirit runs out the slot takes the other kind if he has one.

## 8. Art direction

16-bit console style, drawn in code to canvas textures at load time.

- Internal resolution 480 × 270, scaled by whole numbers to fit the window, with no smoothing. A fullscreen option in Settings (and Alt+Enter) lets it fill the screen; the installed PWA opens fullscreen.
- Tiles are 16 × 16.
- Andrew is 16 × 28. Myko is 16 × 32. Andrew is about half a head shorter, and the difference must be obvious when they stand together.
- Four-direction walk cycles of four frames. Attack, hurt, drink and fall-over animations for Andrew, and a swing for each melee weapon. Myko has a hurried walk, used only when Andrew is on the floor, and a smoke cloud that grows to fill the screen.
- Every thrown bottle is the same sprite, whatever was in it.
- One master palette of 48 colours, with a sub-palette per region:

| Region | Mood | Dominant colours |
|---|---|---|
| Kilnamoe | Wet, dim, warm indoors | Slate, moss, turf brown, amber pub light |
| Boston, DC | Hard edges, overlit | Brick red, navy, fluorescent white |
| Ohio | Wide and flat | Corn yellow, dusty blue, motel pink |
| Roswell | Tacky | Lime, magenta, sun-bleached tan |
| Nevada, the base | Heat outside, cold inside | Sand, rust, then teal and violet |

- The aliens are small, grey and neatly dressed. They look like people who work in an office, because they do.
- Andrew's sprite is short and slight, not round. Myko's is tall and thin, bare-headed, with brown hair.
- HUD: there is no health bar. The Buzz meter is the largest thing on it, bottom centre, with the four levels marked along it, the state name beside it and a notch at the bottom of Grand. The bar itself gets longer as the meter grows (7.1), about a third longer by chapter 10. Every slot shows its icon and the key or mouse button that uses it: the drink slot with Q and a count, the four special slots with 1 to 4, the melee weapon with the left mouse button, the bottle count with the right mouse button, and Myko calls left (three small cannabis-leaf icons, M). A special slot is dark while Andrew is below its level and shows its cooldown as it refills. Things Andrew can pick up or examine are drawn as themselves with a small glint, never as abstract markers. Dialogue box with a 32 × 32 portrait.
- A pixel bitmap font, generated in code.

## 9. Audio

All sound is synthesised with Web Audio. Music and effects have separate volume sliders.

- **Themes.** One theme per region, built from several sections so it does not wear out: a main section, a variation with a second whistle or recorder line in harmony, a sparser section with a plucked guitar-like accompaniment, and now and then a livelier section in the same key. Sections are chosen in a shuffled order so no loop is heard twice running. The Kilnamoe theme is melancholy, with a tin-whistle-like lead in a minor key, and stays away from jig clichés.
- **Boss music.** When a boss or set piece starts, the regional theme speeds up, gains percussion and a driving bass, and gets more intense again at each phase change. It drops back when the fight ends.
- **Effects.** About 30 (hits, bottle smash, drink, footsteps, alarm, things breaking).
- **Sober.** When Buzz reaches 0 the music stops dead. Nothing replaces it until the bar.
- **Text sound.** A soft, short click per character, like a telegram being printed. It is quiet, slightly lower for Myko, and never tonal enough to be a tune.

## 10. Technical design

- Phaser 3, TypeScript in strict mode, Vite, pnpm, Vitest and Playwright.
- No backend, no network calls at runtime, no analytics.
- PWA: a web manifest, generated icons and a service worker that caches the build for offline play.
- Deployed by GitHub Actions to GitHub Pages on every push to `main`.

### Directory ownership

| Path | Owner | Contents |
|---|---|---|
| `DESIGN.md`, `docs/` | creative-director | This document, chapter specs, style guide |
| `src/content/dialogue/` | creative-director | All dialogue, casebook and pickup text, one file per chapter |
| `src/art/` | creative-director | Palette, sprite and tile generators, font |
| `src/content/tuning.ts` | creative-director | Every balance number in the game |
| `src/core/` | systems-dev | Shared types, events, save, input, scene flow |
| `src/systems/` | systems-dev | Combat, abilities, Buzz, stealth and AI, casebook, dialogue runner, Myko |
| `src/chapters/` | level-builder | One folder per chapter: maps, triggers, scripting, boss wiring |
| `src/ui/` | level-builder | HUD, menus, dialogue box, casebook and deduction screens |
| `src/audio/` | level-builder | Synth music and effects |
| Config, `public/`, `.github/` | planner | Vite, lint, PWA, workflow |
| `tests/` | qa | Unit tests and Playwright playthroughs |

### Rules that keep parallel work compatible

- `src/core/types.ts` is written first and defines the contracts: `ChapterDef`, `EnemyDef`, `AbilityDef`, `DrinkDef`, `DialogueLine`, `Clue`, `SaveState` (including Myko calls left) and the event names. Every fight and puzzle exposes one `completeNow()` entry point, which the Myko call and the QA playthrough both use. Only systems-dev changes it, with the creative director's approval.
- Chapters are data plus small scripts. A chapter never reaches into a system's internals; it uses the public API in `src/systems/index.ts`.
- No balance number is written anywhere except `tuning.ts`.
- No text shown to the player is written anywhere except `src/content/dialogue/`.
- Every chapter exposes a debug entry (`?chapter=N`) and a scripted way to complete it, so QA can run the whole game automatically.

## 11. Build order

1. **Foundation.** The creative director writes chapter specs, the palette and the style guide. The planner scaffolds the project and the deploy pipeline. Systems-dev writes `types.ts`.
2. **Core systems and art, in parallel.** Systems-dev builds the systems. The creative director writes the art generators and all dialogue. The level-builder builds the UI and audio.
3. **Vertical slice.** Chapter 1 is built, reviewed and tuned until it is fun. Nothing else starts on chapters until it passes.
4. **Chapters 2 to 10, in parallel** in separate worktrees, each reviewed by the creative director before merge.
5. **Integration.** Full automated playthrough, balance pass, return-to-bar and save checks across chapter boundaries, PWA install test.
6. **Release** to GitHub Pages.

## 12. Done means

- All ten chapters can be completed from a fresh save, and the automated playthrough proves it.
- The game holds 60 frames per second in Chrome and Edge on an ordinary laptop.
- It installs as a PWA and runs with the network off.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass in CI.
- The creative director has read every line of dialogue in the built game and approved it.
