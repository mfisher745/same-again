# Chapter 6: Flyover Country

Region: `ohio`. Clear, bright, enormous sky. Introduces drones and Second Opinion. Light beer comes into its own as ammunition. Myko is having the best week of his life.

## The Ohio rule

For this whole chapter Myko's unprompted commentary is admiration: the width of the roads, the ice machine, free refills, the sky, the manners, a water tower. It is sincere. He does not explain it and Andrew does not ask more than once. His insults continue as normal but each is followed by something nice about Ohio. Every screen needs at least four things Myko can admire, placed where the player will walk past them.

The people of Ohio are friendly to Andrew. They do not answer Myko, and he does not seem to mind.

## The bar

The lounge of the Starlite Motel (`c6.motel`). The woman at the front desk refills the coffee without being asked; that is the hot drink, and there is a box of tea nobody has opened. Myko spends his time here at the ice machine in the corridor.

## Screens

| ID | Name | Size | Notes |
|---|---|---|---|
| `c6.motel` | The Starlite Motel | 30 × 17 | Pink. The lounge, an ice machine, a pool with no water, a reception with a guest ledger. |
| `c6.town` | Bus station and Main Street | 50 × 20 | Very wide road, a diner, Dale's Sporting Goods, a water tower, a free car park the size of Kilnamoe. |
| `c6.fields` | Cornfields | 80 × 40 | Tall corn in rows, a farm track with a cooler of light beer on every other fence post, the crop formation in the middle, an irrigation ditch along one edge. |

## Beats

1. **The Starlite** (`c6.explore.bar`, then `c6.explore.motel`). The hot drink and the kit. Key clue: `c6.clue.ledger` (twelve rooms block-booked by Meridian, paid by a gift shop in New Mexico). Pickup: a postcard with an aerial photo of the crop formation, `c6.clue.postcard`. Colour: `c6.clue.coffee`, the refills.
2. **The town** (`c6.explore.town`). Key clue: `c6.clue.noticeboard` (a notice that field 9 is closed for "soil work", with a Meridian logo). Colour: a man who says hello for no reason, which unsettles Andrew and delights Myko.
3. **Second Opinion.** In Dale's Sporting Goods, Andrew looks at Dale for two seconds and tells him what is wrong with his shoulder. Dale asks if he is a doctor. Andrew says no. Myko points out what Andrew has just done. Second Opinion is added to the kit as a move for slot 3: mark one enemy, and the next hit on him does four times the damage. Dale has a hurley in a bin of assorted bats and calls it a paddle; Andrew already has one.
4. **The fields** (`c6.stealth.fields`, stealth). Five `drone`s sweep spotlight cones over the corn. Standing still in tall corn hides Andrew the way Act Natural does, without needing the move. Moving through corn makes it rustle, which is noise. Clean-run reward: a jar from a farm stand with an honesty box, which is whiskey in all but name.
5. **Bottles.** A drone spots Andrew on the farm track regardless (scripted). It stays out of reach and drops low to fire. Myko points at the coolers: the light beer does little for the meter and every one leaves a bottle. Taught on this one drone.
6. **Drones** (`c6.fight.drones`, fight). Six `drone`s in two waves and two `agent`s on foot. Bottles are the main way to reach the drones; melee works in the moment they drop to fire.
7. **Crop-circle maze** (`c6.puzzle.maze`, puzzle). From the ground the formation is a maze of flattened paths. Three marker stones must be stepped on in the right order, and the order is the pattern on the postcard. Tab shows the postcard. Stepping on the wrong stone resets the three.
8. **The centre** (`c6.explore.centre`). The ground opens on a hatch with nothing under it but a receipt: key clue `c6.clue.receipt`, forty snow globes, Little Green Gifts, Roswell.
9. **Deduction board** (`c6.deduction.roswell`, deduction). Link `c6.clue.ledger`, `c6.clue.receipt` and `c6.clue.postcard` (the formation is the gift shop's logo) to name the lead: Little Green Gifts, Roswell.
10. **The combine** (`c6.setpiece.combine`, setpiece).

## Set piece: the combine harvester

Unmanned, Meridian-green and coming through the corn.

- It crosses the arena in straight passes, cutting corn (and cover) as it goes. A dust plume shows the next lane 1.5 seconds ahead. Being in its lane is a worst hit and throws Andrew clear.
- It throws bales in an arc onto shadow markers (ordinary hits).
- Three sensor lights on its cab are the targets. Each takes melee hits when it passes, or bottles at any time. Two drones escort it.
- With all three out it drives in a slow, dignified curve into the irrigation ditch.

Arena: 36 × 20 of standing corn that is mostly stubble by the end.

## Back to the bar

The motel is at the town end of the farm track. Passed drones are gone. The maze stays solved.

## Sections for call-in

`c6.puzzle.maze`, `c6.fight.drones`, `c6.deduction.roswell`, `c6.setpiece.combine` (after the blackout it is stopped, and Myko is apologising to it).

## Closing scene

The bus station. Andrew wants to go. Myko needs a minute. He has a fridge magnet and holds it for the whole bus journey. From the next chapter on, about two in three of his tangents are about Ohio.

## Dialogue needed

The lounge (open, coffee, hot drink, first return), Ohio admiration lines (at least 20, tagged by trigger object), town clues, the hello man, Dale and Second Opinion (3), the motel desk, clues (5 entries with margin notes), field stealth, bottles lesson (2), drone fight, maze (prompt, wrong, right), board remarks (3), combine (start, each light, end), closing scene, fight call, puzzle call and combine call lines.
