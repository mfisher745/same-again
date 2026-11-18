# Chapter 8: The Long Road

Region: `nevada`. Afternoon into night. Introduces heat, sensor stealth and Barred. No weapon.

## Heat

- There is no heat meter and no water. Heat acts on the Buzz meter.
- While Andrew is out in the sun the meter drains twice as fast, and drink goes half as far again: a beer adds one and a half times its number, and a whiskey or tequila lasts one and a half times as long.
- In shade both are normal. Shade is rock outcrops, the roadhouse awning and the shadow of a parked truck. The HUD shows a small sun beside the meter while the heat applies.
- After sunset (beat 6 onward) there is no heat.

## The bar

The last roadhouse before the fence (`c8.road`). It also sells fuel. The attendant behind the bar has seen everything and has no curiosity left. Coffee from a pot; he thinks he has a tea bag somewhere. Andrew spends his Roswell dollar here on one beer.

## Screens

| ID | Name | Size | Notes |
|---|---|---|---|
| `c8.road` | Highway and roadhouse | 60 × 20 | One road, the roadhouse with an awning, a plain grey government car, a sign with the distance to everything, a dry wash leading north. |
| `c8.perimeter` | The perimeter | 100 × 40 | Scrub, rock outcrops for shade, ground sensors, thermal masts, three junction boxes, a patrol track, the fence with a service gate. |
| `c8.gate` | Gate C | 40 × 20 | A barrier, a guard hut, floodlights, the service road into the hill. |

## Beats

1. **The roadhouse** (`c8.explore.bar`, then `c8.explore.road`). The hot drink, the kit and one beer for a dollar. Key clue: `c8.clue.schedule` (a patrol truck fuel log with times). Colour clue: `c8.clue.car`, Pruitt's car, with a retirement brochure for a lake house on the seat.
2. **The sun.** Stepping out from the awning, Myko explains the heat: it burns off twice as fast and drink goes half as far again, so it is easy to overshoot.
3. **Barred.** A lone `agent` is at the end of the wash, checking a sensor. Myko asks how many pubs Andrew has been put out of, and observes that he knows the grip. Barred is added to the kit as a move for slot 4: Andrew picks up one enemy and throws him out. It needs Fecked, which the sun makes easy to reach. The lesson is information; the lone agent is the first chance.
4. **The perimeter by day** (`c8.stealth.perimeter`, stealth). Three hazards:
   - Ground sensors detect normal movement. Sneaking (Shift) is safe.
   - Thermal masts see Andrew when he is at Bit much or above and out of the shade. Drink runs warm. Staying at Grand in this heat takes attention, which is the point.
   - Two patrol trucks drive the track, each with a spotter and a view cone. Rock outcrops block them.
   Clean-run reward: the service gate in the fence, which opens from the fence side onto the road beside the roadhouse.
5. **Junction puzzle** (`c8.puzzle.junctions`, puzzle). Three junction boxes each toggle two of five sensor lines. Find the combination that turns off the three lines between Andrew and the fence. Each line is a row of real ground sensors in the world, and turning a line off disables them. A diagram on each box shows which lines it toggles. Solvable in three toggles, one per box, in any order (pressing a box twice undoes it). The boxes: near toggles lines 1 and 2, middle 3 and 5, far 4 and 5; all lines start on; the goal is 2, 3 and 4 off. The fence fight does not start until the puzzle is solved.
6. **The fence** (`c8.fight.fence`, fight). The sun goes down as Andrew reaches it. Four `agent`s and one patrol truck that parks and adds its headlights (inside the cone, agents' darts are faster). Key clue from a dropped clipboard: `c8.clue.shift` (shift change at Gate C, ten minutes with one man on).
7. **Deduction board** (`c8.deduction.gate`, deduction). Link `c8.clue.schedule`, `c8.clue.shift` and `c7.clue.permit` to name the plan: Gate C at the shift change.
8. **Agent Pruitt, round two** (`c8.boss.pruitt2`, boss).

## Boss: Agent Pruitt, round two

He is the one man on. He has a thermos and a folding chair and he gets up slowly. He speaks to Andrew alone.

- **Phase 1.** Taser darts in pairs (ordinary each), a flashbang with a ground marker (whites out the screen for 1 second if Andrew is inside it) and the barrier arm, which he drops on a marked line (heavy).
- **Phase 2 (60% health).** He radios a patrol truck that makes one pass through the arena every 12 seconds along a lit path (worst hit).
- **End (40% health).** He stops and checks his watch. It is midnight and he has been retired for eleven seconds. He raises the barrier, gives Andrew his lanyard and says he was never sure what was in there either. He sits back down.

He is not beaten. He lets Andrew through. A Myko call ends the fight the same way, sooner: after the blackout Pruitt is looking at his watch.

Arena: 30 × 14 at the gate.

## Back to the bar

This is the longest walk in the game, which is why the clean-run reward is the service gate. Without it, the way back is the wash and the corridor the junction puzzle opened.

## Sections for call-in

`c8.puzzle.junctions`, `c8.fight.fence`, `c8.deduction.gate`, `c8.boss.pruitt2`.

## Closing scene

Walking up the service road in the dark. Andrew is about to be right. He says nothing about it. Myko says the stars are good but the sky is not as wide as he had been led to believe by Ohio.

## Dialogue needed

The roadhouse (open, the dollar, hot drink, first return), attendant (4), clues (4 entries with margin notes), the sun (lesson and 4 pool lines), Barred (2), perimeter stealth (open, 3 hazard lines, clean, caught), junction puzzle, fence fight, board remarks (3), Pruitt (intro, phase change, midnight and lanyard), closing scene, Ohio tangents (8), fight call, puzzle call and Pruitt call lines.
