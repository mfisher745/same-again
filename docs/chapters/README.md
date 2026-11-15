# Chapter specs

Owner: `creative-director`. One file per chapter. The level-builder builds from these; systems-dev reads them to know what the systems must support. Dialogue is not in these files. It is written separately in `src/content/dialogue/` and referred to here by beat.

These specs follow the overhauled DESIGN.md: no health, one Buzz meter with four levels, a bar at the start of every chapter, special moves by level, melee weapons from bosses, and Myko left open.

## How to read a spec

- **Screens** are given in tiles (16 × 16). One camera view is 30 × 17. Bigger screens scroll.
- **Beats** happen in the listed order unless marked optional.
- **Sections** are the units the systems care about. Every section has an ID and a kind:

| Kind | Myko call-in | Notes |
|---|---|---|
| `fight` | Yes | Ends when every enemy is down. |
| `boss` | Yes, except `c10.boss.administrator` | Has phases. |
| `setpiece` | Yes | A scripted finale that is not a straight fight. |
| `puzzle` | Yes | The chapter's physical puzzle. Solvable in under two minutes. |
| `deduction` | Yes | Link three clues to name the next lead. |
| `stealth` | No, unless it has turned into a fight | Getting caught converts it to a `fight` with the same ID plus `.alarm`. |
| `explore` | No | Investigation and walking about. The bar is an `explore` section. |

- Every `fight`, `boss`, `setpiece`, `puzzle` and `deduction` must implement `completeNow()`.
- There are no checkpoints and no health. The only way to fail is to end up sober or on the floor, and both send Andrew back to the bar (below).
- Numbers in these files (enemy counts, timings, sizes of puzzles) are starting values. The authoritative copy goes in `src/content/tuning.ts` under the section ID, and code reads it from there.
- Clues have IDs like `c2.clue.fragment`. Clues marked *key* are needed for the deduction board; the rest are colour.
- "A hit" in a spec means a hit on the meter (DESIGN.md 7.1): *ordinary* is about 5, *heavy* about 10, *worst* about 15. Below Bit much it lowers Buzz; at Bit much and above it raises it.

## The bar

Every chapter starts at its bar, with Buzz at the bottom of Grand. The bar is on the chapter's first screen. Each spec has a section saying what and where it is. Every bar has:

- a marked spot where Andrew and Myko arrive, at the start and after every return;
- a hot drink on offer with E: one coffee or one tea, free, each visit;
- at least two bottles in Andrew's count when he leaves;
- nothing hostile within sight of it.

Dialogue for a bar: `c<N>.bar.open` plays on the first visit (chapter 1 uses `c1.pub.open`), `c<N>.bar.hotDrink` is the offer line, and `c<N>.bar.return` plays the first time Andrew comes back. After any return Myko also has a line from `myko.bar.sober` or `myko.bar.floor`.

## What a return to the bar keeps

| Kept | Reset |
|---|---|
| Clues, proofs, solved puzzles and solved boards | Buzz, to the bottom of Grand |
| Stealth sections already passed; their guards are gone | The hot drink is on offer again |
| Beaten fights, bosses and set pieces | Bottles are topped up to two |
| Opened doors, gates and shortcuts | A fight, boss or set piece that was under way starts again from its beginning |
| Learned moves, weapons, the kit, Myko calls | A stealth section that was under way puts its guards back on their routes |

An unsolved puzzle keeps the state Andrew left it in. The punishment is the walk back, so a spec should keep that walk under a minute once its shortcuts are open.

## Myko in a scene

Nobody except Andrew speaks to Myko, answers him, looks at him or mentions him (DESIGN.md section 3). When building a scene:

- Other characters face Andrew and talk to Andrew.
- In a room with other people, put Myko apart from them: a corner table, a doorway, outside on the phone.
- Enemies never target him or path around him as an obstacle they have noticed.
- Never show a count: of glasses, tickets, beds or seats.
- Do not add a tell in either direction. He has a shadow and his smoke hangs in the air.

## Enemy roster

| ID | First seen | Behaviour | Hits |
|---|---|---|---|
| `lad` | 1 | Walks up, winds up a slow swing. Backs off after hitting. | Ordinary |
| `cousin` | 2 | A `lad` who also does a short shoulder charge. | Ordinary; the charge is heavy |
| `suit` | 2 | "Department" man. Patrols with a torch in stealth. In a fight, uses a baton with a two-hit pattern. | Ordinary, twice |
| `worker` | 3 | Keeps his distance and throws boxes in an arc. Weak up close. | Ordinary |
| `brawler` | 4 | Fast jab, then a grab that holds Andrew still for a second. | Ordinary; the grab does not hit but the next man's swing will |
| `docker` | 4 | Long reach with a cargo hook. Slow recovery. | Heavy |
| `agent` | 5 | Taser dart at range (a straight, slow projectile), cuffs up close that hold for a second. Works in pairs and tries to flank. | Ordinary |
| `drone` | 6 | Flies out of melee reach and drops low to fire a slow bolt. Spotlight cone in stealth. Bottles reach it at any height. | Ordinary |
| `mascot` | 7 | An alien in a foam costume. Looks like a tourist until it attacks. Tumbling body slam. | Heavy |
| `clerk` | 7 | Alien office worker with a small ray pistol. Fires three-shot bursts, then reloads politely. | Ordinary, three times |
| `security` | 9 | Alien guard with a frontal energy shield. Must be flanked, held, gone through or thrown out. | Heavy |

Every enemy can drop a drink when it goes down: usually the beer of the region, rarely a whiskey, and from chapter 7 very rarely a tequila. Bosses and set pieces are described in their chapter.

## Moves, weapons and rewards by chapter

The number after a move is the level whose slot it goes in. A move that is the second or third for its level is added to the kit, and the lesson tells the player to assign it from the Tab screen.

| # | Moves learned | Weapon won | Clean stealth run gives |
|---|---|---|---|
| 1 | The Shoulder (1), Stout Slam (2) | Big Tom's hurley | No stealth |
| 2 | Reflex Test (1), The Stumble (3) | None | An extra clue: the visitor pass |
| 3 | Same Again (2), One for the Road (4) | Halloran's clipboard | An extra clue: the watchman's logbook |
| 4 | Bedside Manner (2) | Souvenir shillelagh | A whiskey, in a lunchbox |
| 5 | Act Natural (1), Lock-in (3) | Pruitt's umbrella | An extra clue: the stapler memo |
| 6 | Second Opinion (3) | None | A whiskey in all but name, from a farm stand |
| 7 | Last Orders (4) | Inflatable alien | A stout from home, in the staff fridge |
| 8 | Barred (4) | None | A way back: the service gate |
| 9 | The Borrowed Glove (3) | Security wand | A tequila, left over from a leaving do |
| 10 | None | None | No stealth |

## Carry-over rules

- Moves, weapons, the kit (drinks, the hot drink, bottles), the casebook and Myko calls carry from chapter to chapter.
- Buzz does not carry. Every chapter starts at the bottom of Grand.
- The meter is longer at the start of each chapter after the first (DESIGN.md 7.1). The steps are in `tuning.ts`.
- A Myko call saves on the spot. What it finished stays finished after a return to the bar.
- Chapter Select starts a chapter with the moves and weapons it expects, three of the region's beer, two bottles and the save's current Myko calls.

## Index

| # | File | Sections Myko can finish |
|---|---|---|
| 1 | [01-a-quiet-pint.md](01-a-quiet-pint.md) | kegs puzzle, chipper fight, Big Tom |
| 2 | [02-the-bog.md](02-the-bog.md) | sheep puzzle, yard fight, the ram |
| 3 | [03-regional-office.md](03-regional-office.md) | crate puzzle, bay fight, deduction, Halloran |
| 4 | [04-southie.md](04-southie.md) | brawl, container puzzle, deduction, foreman |
| 5 | [05-the-paper-trail.md](05-the-paper-trail.md) | redaction puzzle, cubicle fight, deduction, Pruitt 1 |
| 6 | [06-flyover-country.md](06-flyover-country.md) | maze puzzle, drone fight, deduction, combine |
| 7 | [07-gift-shop.md](07-gift-shop.md) | who-is-an-alien puzzle, stockroom fight, deduction, mascots |
| 8 | [08-the-long-road.md](08-the-long-road.md) | junction puzzle, fence fight, deduction, Pruitt 2 |
| 9 | [09-level-minus-four.md](09-level-minus-four.md) | gravity puzzle, lab fight, deduction, lockdown |
| 10 | [10-disclosure.md](10-disclosure.md) | anteroom fight, broadcast puzzle (not the Administrator) |
