
import { Command } from '../../../base/Command';
import { Player } from '../../../../shared/models/player';
import { MessageHelper } from '../../../helpers/world/message-helper';

export class Agree extends Command {

  public name = 'agree';
  public format = 'Target?';

  async execute(player: Player, { args }) {
    const possTargets = MessageHelper.getPossibleMessageTargets(player, args);

    if(possTargets && possTargets[0]) {
      const target = possTargets[0];

      player.sendClientMessage(`You agree with ${target.name}!`);
      target.sendClientMessage(`${player.name} agrees with you!`);
      player.sendClientMessageToRadius(`${player.name} agrees with ${target.name}!`, 4, [player.uuid, target.uuid]);
      return;
    }

    player.sendClientMessage('You agree!');
    player.sendClientMessageToRadius(`${player.name} agrees!`, 4, [player.uuid]);

  }
}
