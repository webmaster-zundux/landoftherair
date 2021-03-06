
import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class CoinToRight extends Command {

  public name = '~CtR';
  public format = 'Value';

  async execute(player: Player, { args }) {
    const value = +args;
    if(value <= 0 || value > player.currentGold || isNaN(value)) return false;

    if(!player.hasEmptyHand()) return player.sendClientMessage('Your hands are full.');
    this.trySwapRightToLeft(player);

    const item = await player.$$room.itemCreator.getGold(value);

    player.setRightHand(item);
    player.spendGold(value, 'Service:CoinInHand');
  }

}
