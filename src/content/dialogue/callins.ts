/**
 * The blackout when Myko is called in. DESIGN.md section 7.5: the screen cuts
 * to black and three narrator cards say, flatly, how little time it took and
 * how little trouble it was. The player never sees how.
 *
 * There are three calls in the game and each has its own cutscene, so no two
 * calls ever show the same cards. IDs: `myko.call.<kind>.blackout.<n>`, where
 * kind is `fight` or `puzzle` and n is 1, 2 or 3: the first, second or third
 * call of the save, whatever the chapter. The scene that follows is the
 * chapter's own (`c<N>.call.fight`, `c<N>.call.puzzle`) or one of the shared
 * ones in common.ts.
 *
 * Rules for these cards (playtest 8: funnier, cruder, darker): no exclamation marks and never the method. Say what was
 * heard, what was left lying about, and how little it bothered him. Understate the worst of it.
 */

import type { DialogueSequence } from '../../core/types';
import type { DialogueFile } from './index';
import { seq } from './build';

const blackout = (id: string, ...cards: string[]): DialogueSequence =>
  seq(
    id,
    'caption',
    cards.map((card) => ['narrator', card] as const),
  );

export const CALLINS: DialogueFile = {
  text: {},
  sequences: [
    // First call of the game.
    blackout(
      'myko.call.fight.blackout.1',
      'What happens next takes four seconds.',
      'There is a sound like a wet coat hitting a wall. Then the same sound again, lower down.',
      'Somebody asks for his mother. Myko tells him she is not coming, and relights the rollie.',
    ),
    blackout(
      'myko.call.puzzle.blackout.1',
      'Myko looks at it.',
      'He has looked at worse. He once walked in on Andrew trying on a wetsuit.',
      'Then it is done. He wipes his hands on Andrew’s jacket, though he touched nothing.',
    ),

    // Second call.
    blackout(
      'myko.call.fight.blackout.2',
      'Andrew closes his eyes for this one.',
      'He hears a zip, a short prayer, and something small landing a long way off.',
      'When he opens them Myko is asking has he a light. A man on the ground offers his.',
    ),
    blackout(
      'myko.call.puzzle.blackout.2',
      'Myko asks what the problem is.',
      'Andrew explains. It takes him a while. Myko goes for a piss in the middle of it and misses nothing.',
      'By the end of the explanation there is no problem. Myko has not washed his hands.',
    ),

    // Third and last call.
    blackout(
      'myko.call.fight.blackout.3',
      'Two seconds.',
      'He is getting quicker. Nobody knows what he practises on. A man in the parish has not been seen since Lent.',
      'Nobody on the ground is dead. Myko checks one of them twice, to be fair to him.',
    ),
    blackout(
      'myko.call.puzzle.blackout.3',
      'One move.',
      'It was the first thing Andrew tried, done by a man whose eyes were not full.',
      'Myko says nothing. He scratches himself, thoroughly, and looks at Andrew the whole time.',
    ),
  ],
};
