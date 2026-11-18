/**
 * Chapter 8 script: A STUB. It only lets Andrew walk between the three screens. The real script is a separate task.
 *
 * What the real script must wire (docs/chapters/08-the-long-road.md; constants are in `./maps`):
 * - Bar and roadhouse: `c8.bar.open` on first arrival; the dollar and one beer at `BAR_BEER_SPOT` (`c8.bar.dollar`);
 *   the hot drink at `TEA_SPOT` (`c8.bar.hotDrink`; `bar.steam` shows while it can be taken); attendant talk cycles
 *   `c8.attendant.1` to `.4`; `c8.clue.schedule` at `SCHEDULE_SPOT`, `c8.clue.car` at `CAR_SPOT` (`c8.car`).
 * - The sun: `SUN_AREA` starts `c8.sun.lesson`; heat applies in the sun everywhere except the shade areas
 *   (`AWNING_SHADE`, `TRUCK_SHADE`, `ROAD_SHADE`, `PERIMETER_SHADE`) and not at all after sunset (`c8.fence.intro`
 *   onward); the `c8.sun` pool plays while Andrew stands in the sun.
 * - Barred: `BARRED_AGENT_SPOT` spawns a lone agent (`BARRED_TRIGGER` wakes him); `c8.barred.lesson` before, move 4
 *   granted, `c8.barred.done` after he is thrown out.
 * - Perimeter stealth `c8.stealth.perimeter` (`PERIMETER_STEALTH`, `STEALTH_START`, `STEALTH_EXIT`): build the hazards
 *   from `SENSOR_LINES` (ground sensors, one group per line, switched off by `JUNCTION_BOXES`), `THERMAL_MASTS`
 *   and `PATROL_TRUCKS` (two routes along `TRACKS`; the outcrops in `PERIMETER_OUTCROPS` block their view);
 *   `c8.perimeter.open` at `PERIMETER_OPEN_AREA`, `.ground`, `.thermal`, `.truck`, `.clean`, `.caught`; alarm fight
 *   `c8.stealth.perimeter.alarm` from `STEALTH_REINFORCEMENTS`. A clean run opens the `fence.service` gate prop and
 *   makes the `c8.perimeter.service` exit usable (it is a shortcut to the road). The stub hides it.
 * - Junction puzzle `c8.puzzle.junctions`: three boxes at `JUNCTION_BOXES` (`spot` is where E works one; the door shows
 *   `c8.junction.diagram` with its two lines); `pressJunction`/`junctionSolved` model the toggles; turning a line off
 *   disables that row's sensors in `SENSOR_LINES`; `c8.junctions.intro`, `.wrong`, `.done`; the safe corridor is `CORRIDOR`.
 * - Fence fight `c8.fight.fence` in `FENCE_FIGHT_AREA`: four agents at `FENCE_AGENT_SPAWNS`; the truck drives in along
 *   `FIGHT_TRUCK_ENTRY` to `FIGHT_TRUCK_PARK`, then shows prop `fight.truck`; the sun goes down (ambient) as he arrives
 *   (`c8.fence.intro`, `c8.fence.end`); then show `fence.clipboard` (`c8.clue.shift` at `CLIPBOARD_SPOT`) and open the
 *   `fence.gate` prop so `c8.perimeter.gate` can be used. The stub hides `fence.gate`.
 * - Deduction `c8.deduction.gate` (schedule, shift, `c7.clue.permit`).
 * - Boss `c8.boss.pruitt2` at Gate C: arena `GATE_ARENA`; Pruitt starts seated at `PRUITT_CHAIR` and gets up to
 *   `PRUITT_START` (`PRUITT_TRIGGER` starts it); marked barrier line `BARRIER_ARM_LINE` and prop `gate.barrier`;
 *   flashbang markers; floodlights `FLOODLIGHT_SPOTS`; phase 2 truck pass along `GATE_TRUCK_ROUTE` on `GATE_LIT_PATH`;
 *   end at 40% (`c8.pruitt.end`, lanyard); night ambient on this screen; closing scene (`c8.closing`) walking to
 *   `GATE_CLOSING_AREA`.
 * - Captions `c8.caption.*` and cards `c8.card.*` on first arrival at each screen; Myko tangents (`c8.ohio`, `c8.tangent`).
 * - Pickups: empties at the bottle spot lists are already in the module; objectives are in `index.ts`.
 */

import type { ChapterContext, ChapterScript } from '../../systems';

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  return {
    onStart() {
      // Stub: open both gates so the screens can be walked between.
      ctx.setPropVisible('fence.gate', false);
      ctx.setPropVisible('fence.service', false);
    },
  };
}
