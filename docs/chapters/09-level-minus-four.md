# Chapter 9: Level Minus Four

Region: `base`. Cold, teal and violet, very tidy. Introduces alien enemies and the Borrowed Glove. The security wand is the weapon. Andrew collects the five pieces of proof.

The base is an office. There are desks, a kitchenette, a noticeboard and a lost-property box. The aliens are at work and mildly inconvenienced.

## The bar

The staff social area off the lift lobby on `c9.offices`: a dartboard, a fridge, a kettle and a sign-up sheet for a party. It is the Meridian depot's social club again, with one difference: forty people have signed the sheet. The tea is good, which annoys Andrew.

## Screens

| ID | Name | Size | Notes |
|---|---|---|---|
| `c9.offices` | Lift lobby and offices | 40 × 25 | The staff social area, open-plan desks, a water cooler, a kitchenette, meeting rooms named after moons, a lost-property box. |
| `c9.labs` | Labs | 60 × 40 | Three gravity rooms in a row, a hangar viewing window, a records room. |
| `c9.hall` | Containment hall | 50 × 30 | A long hall of sealed bays, blast doors, the lift to the control room at the far end. |

## The five proofs

They are the items shown in the broadcast in chapter 10. All five are required to open the lift.

| ID | What | Where |
|---|---|---|
| `c9.proof.craft` | A photo of the craft with a panel missing. The fragment from the bog fits it. | Hangar window, after the gravity puzzle |
| `c9.proof.contract` | The contract between Meridian and "the tenants". | Offices, a filing cabinet |
| `c9.proof.directory` | The staff directory, with photos. Gary is in it. | Offices, the noticeboard |
| `c9.proof.log` | The flight log for the night over Kilnamoe. Purpose: soil sample. Note: "wrong field". | Records room |
| `c9.proof.footage` | Security footage of the hangar, on a tape. | Containment hall, taken during the lockdown |

## Beats

1. **The staff social area** (`c9.explore.bar`). The hot drink and the kit.
2. **The offices** (`c9.stealth.offices`, stealth). Eight `clerk`s at desks, two walking. Seated clerks have short vision cones and look up on noise. Act Natural works at the water cooler, the noticeboard and in the queue for the kitchenette. Proofs: `c9.proof.contract`, `c9.proof.directory`. Clean-run reward: a tequila in the kitchenette, left over from a leaving do. Nobody there knew what it was for.
3. **The Borrowed Glove.** It is in the lost-property box with a sticky note. It is added to the kit as a move for slot 3: a stun that holds everyone in a wide cone for 4 seconds. From now on E at a gravity switch works it, whatever is in the slot.
4. **Gravity puzzle** (`c9.puzzle.gravity`, puzzle). Three small rooms. In each, a wall switch worked with the Glove changes which way is down: everything loose, Andrew included, slides to that wall until something stops it. Room 1 has one switch and teaches the idea. Room 2 has two switches and a crate that must end up on a pressure plate. Room 3 has two switches and needs Andrew to land on a ledge by sliding into a crate he placed first. The three rooms together are solvable in under two minutes; `completeNow()` finishes all three.
5. **The hangar window and records room** (`c9.explore.labs`). Proofs: `c9.proof.craft`, `c9.proof.log`. The flight log is the answer to the whole game: they were collecting a soil sample and got the wrong field. Andrew reads it twice.
6. **The labs** (`c9.fight.labs`, fight). Four `security` and four `clerk`s in two waves. Shields have to be flanked, held (the Glove, Lock-in, Bedside Manner), gone through (The Stumble) or removed (Barred). This is the exam for the whole kit.
7. **Deduction board** (`c9.deduction.uplink`, deduction). Link `c9.proof.contract` (a clause about "outbound communications"), `c9.proof.directory` (the Administrator's office is on the control level) and `c8.clue.shift` (Pruitt's lanyard opens the lift) to name the destination: the control room uplink.
8. **The lockdown** (`c9.setpiece.lockdown`, setpiece).

## Set piece: the containment hall lockdown

An announcement asks all staff to remain calm and return to their desks. The blast doors start to close.

- The hall is five bays long. Each bay's door closes on a timer shown above it. Andrew has to get through each before it shuts.
- Each bay has `security` and `clerk`s who do not need to be beaten, only passed.
- Bays 2 and 4 have a gravity switch that drops a barrier out of the way or slides the guards to the far wall.
- `c9.proof.footage` is in bay 3, in a wall recorder. Taking it costs 3 seconds.
- A door that closes on Andrew is a heavy hit and sends him back to the bay's start, and the timer resets. It is never a restart of the hall.
- The last door is the lift. It needs all five proofs and the lanyard. The guard at the lift says lift access is not his department, puts his wand down and goes on his break. Andrew takes the wand.
- If Andrew ends up sober or on the floor he is back in the staff social area and the hall starts again from bay 1. The tape stays taken.

## Back to the bar

The staff social area is beside the lift lobby. Passed clerks are gone and the gravity rooms stay solved, so the walk to the hall is the labs corridor.

## Sections for call-in

`c9.puzzle.gravity`, `c9.fight.labs`, `c9.deduction.uplink`, `c9.setpiece.lockdown` (after the blackout every door is open and Myko has the tape).

## Closing scene

In the lift, with lift music. Andrew has the five proofs in a carrier bag. Myko says the base is fine but the offices have no windows, and that the Starlite had a window.

## Dialogue needed

The staff social area (open, tea, hot drink, first return), office small talk overheard (6), proofs (5 casebook entries with margin notes), the Glove and its sticky note, gravity rooms (3 prompts and a reset line), the flight log scene, labs fight, board remarks (3), lockdown announcements (4) and Myko phone lines (4), the wand, closing scene, Ohio tangents (8), fight call, puzzle call and lockdown call lines.
