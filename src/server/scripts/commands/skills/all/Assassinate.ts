
import { startsWith } from 'lodash';

import { Skill } from '../../../../base/Skill';
import { Character, SkillClassNames } from '../../../../../shared/models/character';
import { CombatHelper } from '../../../../helpers/combat-helper';
import { MoveHelper } from '../../../../helpers/move-helper';
import { MessageHelper } from '../../../../helpers/message-helper';
import { Revealed as CastEffect } from '../../../../effects/misc/Revealed';

export class Assassinate extends Skill {

  static macroMetadata = {
    name: 'Assassinate',
    macro: 'assassinate',
    icon: 'decapitation',
    color: '#530000',
    mode: 'lockActivation',
    tooltipDesc: 'Attempt to assassinate your target from the shadows. Requires Thievery & weapon skill 13.'
  };

  public name = 'assassinate';
  public format = 'Target';

  requiresLearn = false;

  range = (attacker: Character) => {
    const weapon = attacker.rightHand;
    if(!weapon) return 0;

    if(weapon.twoHanded && attacker.leftHand) return -1;

    return weapon.attackRange;
  }

  execute(user: Character, { gameState, args }) {
    if(!args) return false;

    if(user.baseClass !== 'Thief') return user.sendClientMessage('You don\'t know how to do that!');

    const hidden = user.hasEffect('Hidden');
    const shadowMeld = user.hasEffect('ShadowMeld');
    if(!hidden && !shadowMeld) return user.sendClientMessage('You are not hidden!');

    const weapon = user.rightHand;
    if(!weapon) return user.sendClientMessage('You need a weapon in your hand to attempt assassination!');

    if(user.calcSkillLevel(weapon.type) < 13) return user.sendClientMessage('You are not skilled enough to do that!');

    const userSkill = user.calcSkillLevel(SkillClassNames.Thievery);
    if(userSkill < 13) return user.sendClientMessage('You are not skilled enough to do that!');

    const range = this.range(user);
    if(range === -1) return user.sendClientMessage('You need to have your left hand empty to use that weapon!');

    const possTargets = MessageHelper.getPossibleMessageTargets(user, args);
    const target = possTargets[0];
    if(!target) return user.sendClientMessage('You do not see that person.');

    if(target === user) return;

    if(target.canSeeThroughStealthOf(user)) return user.sendClientMessage('You do not have the element of surprise!');

    if(hidden)      user.unapplyEffect(hidden, true);
    if(shadowMeld)  user.unapplyEffect(shadowMeld, true);

    const revealed = new CastEffect({});
    revealed.duration = 15;
    revealed.cast(user, user, this);

    this.use(user, target);
  }

  use(user: Character, target: Character) {
    const xDiff = target.x - user.x;
    const yDiff = target.y - user.y;

    MoveHelper.move(user, { room: user.$$room, gameState: user.$$room.state, x: xDiff, y: yDiff }, true);
    user.$$room.updatePos(user);

    CombatHelper.physicalAttack(user, target, { isAssassinate: true, attackRange: this.range(user) });
  }

}
