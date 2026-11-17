# Chapter 4: Southie

Region: `cities`. Afternoon in the bar, night at the docks. Introduces American beers and Bedside Manner. The souvenir shillelagh is the weapon.

## The bar

Paddy O'Shamrock's (`c4.bar`), an "Irish" bar. Colleen-Ann is behind it. The arrival spot is the stool nearest the door. The hot drink is tea, and she asks whether he wants it hot or iced.

## Screens

| ID | Name | Size | Notes |
|---|---|---|---|
| `c4.bar` | Paddy O'Shamrock's | 40 × 22 | Green everything, a plastic shillelagh over the till, a sign with a countdown to March, a fridge of light beer by the door. Colleen-Ann behind the bar. |
| `c4.docks` | Pier Nine | 70 × 34 | Container stacks in rows, floodlight pools, a rail-mounted crane, the foreman's control box. A side gate near the bar end, shut. |

The airport is a title card ("Boston. Arrivals.") and nothing else.

## Beats

1. **The bar** (`c4.explore.bar`). Americans explain Ireland to Andrew. Four patrons each have a short conversation, and Andrew agrees with all of it because it is quicker. Colleen-Ann is proud, wrong and useful: she knows every docker by name. She talks to Andrew and only to Andrew. Key clues: `c4.clue.roster` (a Pier Nine shift roster pinned by the dartboard), `c4.clue.patch` (the Pier Nine patch on a regular's jacket, which has the same mark as the fragment). Colour: `c4.clue.stout`, the stout she pours, which Andrew watches settle with visible grief; a craft IPA and Myko's opinion of it. Pickup: American light beer from the fridge, the first one, with the pickup text from DESIGN.md section 2.
2. **Bedside Manner.** A patron asks Andrew to say something Irish. He says "no", twice. A second patron stands up. Myko tells Andrew to use the voice he had for giving people their results. Bedside Manner is added to the kit as a move for slot 2: everyone near Andrew stops and listens for 3 seconds. Andrew tells the man to sit down, and that it is probably nothing. He sits down. Then the first one asks what is probably nothing.
3. **The brawl** (`c4.fight.brawl`, fight). Six `brawler`s in three waves of two. Colleen-Ann throws Andrew a stout between waves and keeps a tally of breakages.
4. **The docks** (`c4.stealth.docks`, stealth). Four `docker`s on patrol and two fixed floodlights that sweep. Container rows give cover. Clean-run reward: a whiskey in a lunchbox on a bollard.
5. **Container puzzle** (`c4.puzzle.containers`, puzzle). Container MAS-4471 is on the top tier, out of reach. Three levers each slide one container along its rail by one slot. Line the three up as steps: one arrangement opens the hatch, and nothing else needs activating. Myko says so on arrival, and says when a box lands in its place. His hints are clues, never the lever counts. Solvable in six pulls.
6. **Inside the container** (`c4.explore.container`). It is empty apart from key clue `c4.clue.seizure`: a federal notice taped to the wall. Contents removed by the Office of Atmospheric Records, Washington DC. Colour clue: `c4.clue.foam`, packing foam with the outline of something round.
7. **Deduction board** (`c4.deduction.dc`, deduction). Link `c4.clue.seizure`, `c4.clue.roster` (a "federal pickup" marked every second Tuesday) and `c3.clue.manifest` to name the lead: the Office of Atmospheric Records.
8. **The foreman** (`c4.boss.foreman`, boss).

## Boss: the dock foreman

He does not care what is in the containers. He cares that Andrew is not in the union. He is fourth-generation and carries a souvenir shillelagh on his belt.

- **Phase 1.** He works the crane from the control box. A container swings across the arena on a marked path (shadow telegraph 1.2 seconds, a heavy hit). Two `docker`s keep Andrew busy. Stout Slam or The Shoulder beside the control box knocks him off it.
- **Phase 2.** On foot with the shillelagh: a long sweep, an overhead with a ground marker (both heavy), and a jab that knocks Andrew back towards the crane's path. The crane keeps making one slow pass on its own.
- **End.** His shift ends. He says so, clocks out and leaves. The shillelagh stays on the control box. It says KISS ME on it. Andrew does not want it and takes it.

Arena: 28 × 16, open, with the crane rail along the top.

## Back to the bar

The bar's back door opens onto the pier's side gate. The gate opens once the docks stealth section is passed, clean or not, and stays open.

## Sections for call-in

`c4.fight.brawl`, `c4.puzzle.containers`, `c4.deduction.dc`, `c4.boss.foreman`.

## Closing scene

A bus shelter at dawn. Andrew has now been told he is Irish by eleven people. Myko says the bus to Washington is booked, and he has a souvenir lighter.

## Dialogue needed

The bar (open, tea, hot drink, first return), light beer pickup, four patron conversations, Colleen-Ann (clues, brawl tally, end), the stout, IPA opinion, Bedside Manner (2), brawl (between waves, end), docks stealth, container puzzle, clues (5 entries with margin notes), board remarks (3), foreman (intro, phase change, end), the shillelagh, closing scene, fight call and puzzle call lines.
