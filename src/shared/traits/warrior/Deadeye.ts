
import { Trait } from '../../models/trait';
import { Player } from '../../models/player';

export class Deadeye extends Trait {

  static baseClass = 'Warrior';
  static traitName = 'Deadeye';
  static description = 'Sharpen your vision further, increasing your accuracy even more. Requires [Eagle Eye] Level 10';
  static icon = 'bullseye';

  static tpCost = 10;
  static maxLevel = 20;

  static canBuy(player: Player): boolean {
    return super.canBuy(player) && player.getTraitLevel('EagleEye') === 10;
  }

}
