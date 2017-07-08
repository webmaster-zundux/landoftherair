
import { find } from 'lodash';

import { Command } from '../../../base/Command';
import { Player } from '../../../../models/player';

import { CommandExecutor } from '../../../helpers/command-executor';

export class E extends Command {

  public name = 'e';

  execute(player: Player, { room, gameState }) {
    CommandExecutor.executeCommand(player, '~move', { room, gameState, x: 1, y: 0 });
  }

}
