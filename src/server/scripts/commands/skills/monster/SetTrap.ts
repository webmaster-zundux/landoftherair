
import { find } from 'lodash';

import { MonsterSkill } from '../../../../base/Skill';
import { Character } from '../../../../../shared/models/character';
import { TrapHelper } from '../../../../helpers/world/trap-helper';

export class SetTrap extends MonsterSkill {

  name = 'settrap';

  canUse(user: Character, target: Character) {
    const trap = find(user.sack.allItems, { itemClass: 'Trap' });
    return !!trap;
  }

  use(user: Character, target: Character) {
    const trap = find(user.sack.allItems, { itemClass: 'Trap' });
    if(TrapHelper.placeTrap(user.x, user.y, user, trap)) {
      trap.trapUses--;
      if(trap.trapUses <= 0) user.sack.takeItem(trap);
    }
  }

}
