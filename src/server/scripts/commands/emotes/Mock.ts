
import { Command } from '../../../base/Command';
import { Player } from '../../../../shared/models/player';
import { MessageHelper } from '../../../helpers/world/message-helper';

export class Mock extends Command {

  public name = 'mock';
  public format = 'Target?';

  async execute(player: Player, { args }) {
    const possTargets = MessageHelper.getPossibleMessageTargets(player, args);

    if(possTargets && possTargets[0]) {
      const target = possTargets[0];

      player.sendClientMessage(`You mock ${target.name}!`);
      target.sendClientMessage(`${player.name} mocks you!`);
      player.sendClientMessageToRadius(`${player.name} mocks ${target.name}!`, 4, [player.uuid, target.uuid]);
      target.addAgro(player, 1);
      return;
    }

    player.sendClientMessage('You mock yourself!');
    player.sendClientMessageToRadius(`${player.name} mocks theirself!`, 4, [player.uuid]);

  }
}
