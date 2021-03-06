
import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class PotionToGround extends Command {

  public name = '~PtG';
  public format = '';

  execute(player: Player, { room }) {
    if(this.isBusy(player)) return;
    if(!player.potionHand) return false;
    if(!player.hasEmptyHand()) return player.sendClientMessage('Your hands are full.');

    room.addItemToGround(player, player.potionHand);
    player.setPotionHand(null);
    room.showGroundWindow(player);
  }

}
