# Chapter 1: A Quiet Pint

Region: `kilnamoe`. Night, raining lightly. Teaches movement, interacting, the Buzz meter, drinking, the hot drink, the kit, the punch combo, throwing a bottle, breakables, the first two special moves and what a hit does. This is the vertical slice, so it has to be fun on its own.

## The bar

Feeney's itself (`c1.pub`). Andrew's stool at the end of the bar is the arrival spot. Dympna offers the hot drink from the urn beside it. When he comes back she does not look up.

## Screens

| ID | Name | Size | Notes |
|---|---|---|---|
| `c1.pub` | Feeney's | 30 × 17 | Bar along the top wall, four tables, a fruit machine, a dartboard, the quiz trophy shelf, the toilets, a back door to the keg yard. Amber light, the only warm screen in the chapter. |
| `c1.yard` | Keg yard | 20 × 17 | Small, walled, kegs and crates. Gate to Main Street. |
| `c1.street` | Main Street | 70 × 17 | Scrolls left to right: Feeney's front, the bookies, the chipper (lit, with a queue), the church gate, a parked tractor, then the road out of town. |
| `c1.road` | Bog road | 30 × 17 | Dark. A stone wall, a gate, the bog beyond. |

## Beats

1. **Title card**, then `c1.pub`. Andrew is at the bar. The meter is hidden until the pint in beat 2. Myko sits at the corner table, apart from everyone, and stays there until Andrew leaves.
2. **Dympna's list** (`c1.explore.pub`). Dympna gives the tutorial as a list of what Andrew owes her. Each item is an input prompt:
   - Walk to the end of the bar (WASD). He owes her for the stool.
   - Talk to her (E). He owes her for last Thursday.
   - Drink the pint she puts down (Q). It goes on the slate. The Buzz meter appears, just into Grand. Myko says what happens at each end of it.
   - Take the hot drink (E at the urn, then choose). It is the one thing that is not on the slate.
   - Open the kit (Tab). One stout in the drink slot, two bottles, fists in the melee slot, nothing in the special slots yet.
   - Optional examines: the quiz trophy shelf (Andrew mentions it), the dartboard, the photo of the 1994 county team, the telly.
3. **The fruit machine.** It took Andrew's euro. Left click three times teaches the punch combo; the haymaker makes it pay out one coin, which Dympna takes off the slate. Myko comments from his table.
4. **Closing time.** Dympna has locked the front door for a lock-in that Andrew is not part of. The way out is the back.
5. **Keg puzzle** (`c1.puzzle.kegs`, puzzle). Two full kegs block the yard gate. Kegs are pushed by walking into them and slide one tile at a time. Six-by-five play area, two kegs, one fixed crate; solvable in four pushes. This teaches pushing for the crate puzzle in chapter 3. Myko follows from here.
6. **The Shoulder.** The yard gate is stuck. Myko points out that what moved a keg will move a gate, and a person. Key 1 charges it open. The move goes into slot 1.
7. **Main Street** (`c1.explore.street`). A whiskey is in plain sight behind the bookies' bins, and the bins are in the way. Right click throws a bottle and breaks them: the first throw, the first breakable and the first whiskey. Myko says what whiskey does before Andrew can drink it. Other bins and crates along the street hold a stout or nothing.
8. **The row outside the chipper** (`c1.fight.chipper`, fight). The last spice bag has gone to the person ahead of Andrew. Words are had. Three `lad`s: one first, then two together.
   - The first hit Andrew takes brings Myko's line on what a hit does to the meter.
   - Before the pair arrive, Stout Slam is taught (key 2). It needs Grand; if Andrew has dropped below it, Myko tells him to drink first.
   - The lads drop stout. The spice bag is the prize and is story only.
9. **The Myko call.** A prompt introduces it (hold M) here, as information only. Myko says he is there in an advisory capacity.
10. **Big Tom Brennan** (`c1.boss.bigtom`, boss) by the tractor.
11. **The hurley.** Tom leaves his hurley against the tractor and asks Andrew to mind it. E takes it; R cycles between it and fists.
12. **The lights** (`c1.explore.road`). Andrew walks out the bog road. Lights move over the bog, silently, and go down behind the hill. Myko was looking at his lighter. Chapter ends.

## Boss: Big Tom Brennan

He wants the tenner back. He is twice Andrew's width and not angry, just thorough.

- **Phase 1.** Wind-up haymaker (telegraph 800 ms, a heavy hit, big knockback) and a straight bull charge across the street (heavy). If the charge hits the tractor or the church gate he is dazed for 2 seconds and takes double damage.
- **Phase 2 (half health).** He takes off his jacket and folds it on the wall. Attacks are 25% faster and he adds a two-swing combination.
- **End.** He sits down on the kerb and asks again, politely. Andrew does not have a tenner. Myko tells him to try his inside pocket. There is a tenner in it, and Andrew says it is not his. Tom takes it from Andrew and thanks Andrew. Myko says Andrew owes him now. Tom does not look at Myko at any point.

Arena: 30 × 12 section of the street, tractor at one end, gate at the other. Two stout bottles on the wall of the church as pickups.

## Back to the bar

From the chipper or Big Tom the walk is the street, the yard (the kegs stay where the player left them, the gate stays open) and the back door. It is short on purpose: this is where the player learns what the two ends of the meter do.

## Sections for call-in

`c1.puzzle.kegs`, `c1.fight.chipper`, `c1.boss.bigtom`. Using a call in the tutorial chapter is allowed and Myko's line should make clear what he thinks of that.

## Clues

None. The casebook arrives in chapter 2.

## Closing scene

On the bog road, after the lights. Andrew is certain. Myko asks whether it might have been a helicopter, a plane, a lad with a torch or the drink. Andrew says it was none of those. Myko agrees to come and look in the morning, because he has nothing else on.

## Dialogue needed

Dympna's list (6 steps and 4 examines), the meter, the hot drink, the kit, fruit machine (2), lock-in, keg yard (2), The Shoulder (2), bottle and whiskey (3), chipper row (intro, first hit, Stout Slam, mid, end), M prompt, Big Tom (intro, phase change, dazed, end), the hurley, first return to the bar, the lights and closing scene, fight call and puzzle call lines.
