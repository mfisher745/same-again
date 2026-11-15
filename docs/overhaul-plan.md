# Overhaul build plan

Owner: `creative-director`. How the code catches up with the overhauled DESIGN.md. Delete this file when phase 5 merges.

## Where things stand

- Design, the ten chapter specs and all dialogue are done, on branch `agent/creative-director/overhaul`.
- Code, tuning and tests still implement the old game: health, food, hangover, a dodge, three drink slots, one special on F, checkpoints.
- Only chapter 1 is built. The plan rebuilds the systems and chapter 1 together, as a new vertical slice. Chapters 2 to 10 follow the slice as before (DESIGN.md section 11).

## Rules for this work

- **One integration branch.** Every agent branches from `agent/creative-director/overhaul` and merges back into it, not into `main`. `main` keeps the playable old build until the slice is approved, then takes the whole thing in one merge.
- **The integration branch must always pass** lint, typecheck, unit tests and build. A phase that removes a system removes its tests and its `RETIRING` text in the same merge.
- **Contracts first.** Nobody outside systems-dev starts until phase 1 has merged, because everything else compiles against `src/core/types.ts`.
- Usual rules hold: stay in owned directories, numbers only in `tuning.ts`, text only in `src/content/dialogue/`, model as listed in CLAUDE.md, two failures go to the creative director.

## Phases

| # | Phase | Agent | Depends on | Done when |
|---|---|---|---|---|
| 1 | Contracts and tuning | systems-dev, then creative-director | — | New types compile; `tuning.ts` holds the numbers below; old systems still run |
| 2 | Core systems | systems-dev | 1 | Meter, hits, return to bar, kit, drinks, moves, weapons and the throw work in unit tests with no rendering |
| 3 | Art, UI and audio | creative-director (art), level-builder (UI, audio) | 1; runs beside 2 | New sprites and icons exist; HUD, Tab screen, settings and the two return scenes work in the dev harness |
| 4 | Chapter 1 rebuild | level-builder | 2, 3 | Chapter 1 plays start to finish to the new spec |
| 5 | Tests and removal | qa, systems-dev, triage | 4 | No code, type, tuning field or text remains for a removed system; e2e playthrough of chapter 1 passes |
| 6 | Review and merge | creative-director, owner | 5 | Owner has played chapter 1 on a preview and approved; one merge to `main` |

### Phase 1: contracts and tuning

**systems-dev** (`src/core/types.ts`, `src/core/events.ts`, `src/core/input.ts`, `src/core/save.ts`):

- `BuzzState` becomes `sober | buzzed | grand | bitMuch | fecked`, with a numeric level 0 to 4. Level bounds come from a per-chapter table, not constants.
- Remove from the contracts: `Health`, `FoodId`, `FoodDef`, `HangoverState`, `HeatSnapshot`, checkpoints, the `dodge` and `special` ability slots, the three `DrinkSlots`.
- Add: `Kit` (drink counts with a carry limit, one hot drink, bottle count, owned weapons, learned moves, the six slot assignments), `MoveDef` (level, cooldown, effect), `WeaponDef` (reach, speed, damage, knockback, quirk), `HitWeight` (`ordinary | heavy | worst`) on every enemy and boss attack in place of damage to Andrew, `BarDef` on `ChapterDef` (screen, arrival spot, hot-drink prop), a `sun` flag on map regions.
- Events: `buzz:levelChanged`, `player:hit` (with direction of the meter change), `bar:returned` (reason `sober` or `floor`), `move:used`, `move:learned`, `weapon:gained`, `kit:changed`, `spirit:started` and `spirit:ended`. Remove death, hangover, heat and checkpoint events.
- Input: remove `dodge`, `special`, `cycleSpecial`, `selectDrink1..3`. Add `special1..4`, `cycleWeapon`, `cycleDrink` (wheel), `openTab` with hold or toggle, and aim-hold and release for the throw.
- Save: version bump. Stores chapter, finished section IDs, kit, Myko calls, casebook, opened shortcuts and settings. An old save is discarded with the existing new-game path; no migration.

**creative-director** (`src/content/tuning.ts`), once the types exist: fill in the numbers in "Tuning" below.

### Phase 2: core systems

**systems-dev** (`src/systems/`). Suggested order; each item is its own commit with unit tests.

1. `buzz.ts`: constant drain, level table by chapter, sun modifier, spirit window (no drain, hits lower and count double), tea's slow reset and hold.
2. `player.ts`, `combat.ts`, `enemies.ts`, `boss.ts`, `projectiles.ts`: a hit on Andrew moves the meter by its weight, down at levels 1 and 2, up at 3 and 4. No health anywhere. Flinch and knockback stay.
3. `run.ts`, `session.ts`, `sections.ts`: return to the bar at 0 and at the top. Keep finished sections, reset the one under way, top up bottles, re-offer the hot drink. Remove checkpoints and death. `run.ts` is 1,559 lines; split the return flow into its own file.
4. `inventory.ts` becomes the kit: carry limit, hot drink, bottles from beer, assignment rules (a slot only takes a move of its level), using a drink from the Tab screen.
5. `abilities.ts`: four level-gated slots with cooldowns that keep running while a slot is dark; the thirteen moves; remove the dodge, the sliotar shot and the fire breath.
6. Melee weapons: definitions, cycling, level multiplier.
7. Throw: hold to aim, release to throw, a preview path the view can draw, sway from Bit much up. The bottle goes where the preview points at release.
8. `stealth.ts`: footstep noise by level; clean-run rewards of four kinds (clue, drink, shortcut, drink from home).
9. `myko.ts`: silent at 0; the hurried walk and smoke for the floor; pools `myko.bar.sober`, `myko.bar.floor`, `myko.low`, `myko.bitMuch`, `myko.fecked`, `myko.whiskey`, `myko.tequila`, `myko.hotDrink`, `myko.meterGrows`. Calls are unchanged.
10. Breakables and enemy drops: drink or nothing.

#### Phase 2a decisions (creative director)

New modules sit beside the old ones: `meter`, `hits`, `barReturn`, `mykoLines`, `kit`, `moves`, `weapons`, `throwAim`, `drops`, `rewards`. Agent choices accepted, with these rulings:

- A second spirit ends the first window first, so tequila's drop still lands. A hot drink ends a spirit window with no drop. A spirit ends tea.
- Hits and beers still move the meter during tea.
- Whiskey from Sober goes to the top of Buzzed. A jump never lowers the meter.
- Free hot drink refused while one is carried; the offer stays.
- A learned move goes into its slot if that slot is empty (`autoAssign: true` everywhere). The Tab screen changes it after.
- Moves with no target, no prop or after being seen refuse and spend no cooldown. The HUD shows `ui.move.*`.
- A drink reward with a full kit is left on the ground, still counted as granted.
- Myko remarks share a 12 s gap, dropped not queued; level lines only on the way up.
- New first-guess tuning (review after play): Myko gap 12 s, combo window 450 ms, throw range 220 / damage 10 / knockback 30 / noise 90, footsteps 56/98/112 by level, sneak 0 until Fecked then 28.

Wiring pass (2b) must remove duplicates: `meleeMultiplier` is in both `hits.ts` and `weapons.ts`; `topUpBottles` in both `barReturn.ts` and `kit.ts`. Keep the `weapons.ts` and `kit.ts` versions.

### Phase 3: art, UI and audio

**creative-director** (`src/art/`):

- Icons: coffee, tea, lager, tequila, bottle, thirteen moves, seven weapons, a sun mark. Rename the `rollie` frame keys to `leaf`.
- Andrew: a swing for each weapon. Myko: a hurried walk. Effects: a smoke cloud that grows to fill the screen, the throw-preview dot.
- Props: the hot-drink urn, flask, kettle, coffee pot and tea trolley; the hurley, clipboard and the rest as world objects.
- Flattened-colour treatment for Buzz under 10 and at 0.

**level-builder** (`src/ui/`, `src/audio/`):

- HUD: no health; the meter bottom centre with level marks, growing with the chapter; drink slot, four special slots with cooldown and dark state, weapon, bottle count, sun mark, Myko calls.
- Tab screen: casebook and kit as two parts of one scene; inventory, six slots, assign, drink from inventory. Paused while open. Hold or toggle from Settings.
- Return scenes: the sober fade (music stops, colours flat, Myko silent) and the floor (fall, Myko, smoke to black).
- Hot-drink choice at the bar; throw preview drawing; prompts for the new keys.
- Audio: music cut at 0; effects for a move going off, a slot coming back, a weapon swap, the hot drink, a spirit starting and wearing off.
- Dev harness: add buttons for both returns, each level, each move and each weapon, so none of this needs a full playthrough to see.

### Phase 4: chapter 1 rebuild

**level-builder** (`src/chapters/01/`), from `docs/chapters/01-a-quiet-pint.md`:

- Feeney's as the bar: arrival stool, urn, the hot-drink and kit steps in Dympna's list.
- The stuck yard gate and The Shoulder; the bins, the first throw and the first whiskey; the first-hit line; Stout Slam before the pair of lads; lads drop stout.
- Big Tom with hit weights; the tenner ending; the hurley handover.
- Remove the checkpoint, the crisps and the spice bag as a pickup.
- Sequences to wire that the old script does not play: `c1.pub.hotDrink`, `c1.pub.kit`, `c1.bar.return`, `c1.bar.hotDrink`, `c1.shoulder.lesson`, `c1.shoulder.done`, `c1.throw.lesson`, `c1.hit.lesson`, `c1.slam.lesson`, `c1.slam.needDrink`, `c1.weapon.hurley`, and the five new objectives with their hints.

### Phase 5: tests and removal

- **qa** (`tests/`): rewrite `buzz`, `inventory`, `abilities`, `combat`, `run`, `save` and `chapter1` tests to the new rules; add tests for return-to-bar, the kit, each move, the throw preview, the Myko rule (no line by anyone but Andrew follows a Myko line and addresses him; no non-Andrew line names him) and the vocabulary list (no "leave out" word in any text). Rewrite the Playwright chapter 1 playthrough and run it; it has not been run since before the first playtest.
- **systems-dev**: delete what is left of the removed systems and the deprecated `fightClearMs`.
- **creative-director**: delete every `RETIRING` entry in `src/content/dialogue/`.
- **triage**: audit that every text ID the code asks for exists and every ID in the dialogue files is used or listed as awaiting chapters 2 to 10.

### Phase 6: review and merge

- Creative director reviews the integration branch against DESIGN.md and the chapter 1 spec.
- Owner plays chapter 1 from a local preview build of the branch.
- Balance pass on the numbers below from that play.
- One merge to `main`. That deploys.

## Tuning: starting numbers

For `src/content/tuning.ts` in phase 1. All are first guesses to be changed after play.

| What | Value |
|---|---|
| Drain | 1 point per 3 s; ×2 in the sun |
| Start, coffee, tea target | Bottom of Grand |
| Hit weights | Ordinary 5, heavy 10, worst 15 |
| Melee multiplier by level | ×1, ×1.5, ×2, ×3 |
| Stout, lager, light beer, IPA | +15, +10, +2, +20; ×1.5 in the sun |
| Whiskey | To the top of the next level; 8 s with no drain and hits lowering, doubled |
| Tequila | To the middle of Fecked; 8 s as whiskey; then −30 |
| Tea | 10 s to reach the target, then held 20 s |
| Carry limit | 6 drinks; 1 hot drink; bottles unlimited; at least 2 on leaving the bar |
| Low-Buzz warning | Under 10 |
| Move cooldowns by level | 5 s, 12 s, 25 s, 60 s |
| Drops | Breakable: 35% regional beer, 4% whiskey, else nothing. Enemy: 30% beer, 3% whiskey, 1% tequila from chapter 7 |
| Sway | None at levels 1 and 2; moderate at 3; strong at 4 |

Meter length by chapter. Bit much is always 25 wide and Fecked 9, with the floor one above.

| Chapter | Buzzed | Grand | Bit much | Fecked | Floor |
|---|---|---|---|---|---|
| 1 | 1–34 | 35–65 | 66–90 | 91–99 | 100 |
| 2 | 1–36 | 37–69 | 70–94 | 95–103 | 104 |
| 3 | 1–38 | 39–73 | 74–98 | 99–107 | 108 |
| 4 | 1–40 | 41–77 | 78–102 | 103–111 | 112 |
| 5 | 1–42 | 43–81 | 82–106 | 107–115 | 116 |
| 6 | 1–44 | 45–85 | 86–110 | 111–119 | 120 |
| 7 | 1–46 | 47–89 | 90–114 | 115–123 | 124 |
| 8 | 1–48 | 49–93 | 94–118 | 119–127 | 128 |
| 9 | 1–50 | 51–97 | 98–122 | 123–131 | 132 |
| 10 | 1–51 | 52–98 | 99–123 | 124–132 | 133 |

Weapons, relative to fists (damage, reach, time per swing): hurley 1.6, 1.5, 1.4; clipboard 0.5, 1.0, 0.5; shillelagh 2.2, 1.3, 1.8; umbrella 1.2, 2.0, 1.2; inflatable alien 0.2, 1.6, 1.3; security wand 1.8, 1.2, 0.8.

## Risks

- **`types.ts` is the bottleneck.** If phase 1 slips, three agents wait. Keep it to contracts; no behaviour.
- **`run.ts` and `HudScene.ts` are large** (1,559 and 711 lines) and most of the change lands in them. Split before changing.
- **The thirst may be too much.** At 1 point per 3 s a six-minute chapter drains 120 points. If chapter 1 feels like a chore, slow the drain before touching anything else.
- **Fecked may be too good or too deadly.** ×3 damage with the floor one ordinary hit away at 95 and above. Watch how often players choose to go there.
- **The walk back** is the only punishment. If it is tedious in chapter 1, it will be worse in chapter 8.
- **Text and numbers disagree until phase 1 lands.** Pickup lines already state the new values.

## Decisions for the owner

1. Is chapter 1 as a new vertical slice the right first target, with chapters 2 to 10 after it? The alternative is to build chapter 2 alongside, to test stealth and Bit much early.
2. Preview before merge: play locally, or publish the branch to a second Pages path? The second needs a workflow change by the planner.
3. Old saves are discarded. Nothing has shipped past chapter 1, so this plan does not migrate them.
