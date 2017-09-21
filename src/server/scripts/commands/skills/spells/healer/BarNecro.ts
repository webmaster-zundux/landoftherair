
import { startsWith } from 'lodash';

import { Skill } from '../../../../../base/Skill';
import { Character, SkillClassNames } from '../../../../../../models/character';
import { BarNecro as CastEffect } from '../../../../../effects/BarNecro';

export class BarNecro extends Skill {

  public name = 'barnecro';
  public format = 'Target';

  static macroMetadata = {
    name: 'BarNecro',
    macro: 'barnecro',
    icon: 'rosa-shield',
    color: '#1b390e',
    mode: 'clickToTarget'
  };

  flagSkills = [SkillClassNames.Restoration];

  mpCost = () => 40;
  range = () => 5;

  execute(user: Character, { gameState, args, effect }) {
    const range = this.range();

    let target = user;

    if(args) {
      const possTargets = user.$$room.getPossibleMessageTargets(user, args);
      target = possTargets[0];
      if(!target) return user.sendClientMessage('You do not see that person.');

      if(target.distFrom(user) > range) return user.sendClientMessage('That target is too far away!');
    }

    const cost = this.mpCost();

    if(!effect && user.mp.getValue() < cost) return user.sendClientMessage('You do not have enough MP!');
    user.mp.sub(cost);

    this.use(user, target, effect);
  }

  use(user: Character, target: Character, baseEffect = {}) {
    const effect = new CastEffect(baseEffect);
    effect.cast(user, target);
  }

}
