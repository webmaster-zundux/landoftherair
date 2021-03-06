
import { WeaponEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { CombatHelper } from '../../helpers/world/combat-helper';
import { LoweredDefenses } from '../antibuffs/LoweredDefenses';

export class Multistrike extends WeaponEffect {

  static get skillRequired() { return 13; }
  protected skillRequired = Multistrike.skillRequired;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    const numTargets = 3 + caster.getTraitLevelAndUsageModifier('Multitarget');

    const attacked = target.$$room.state.getAllInRange(target, 0, [caster.uuid]).slice(0, numTargets);

    attacked.forEach(refTarget => {
      if(caster.isPlayer() && refTarget.isPlayer()) return;
      CombatHelper.physicalAttack(caster, refTarget);
    });

    if(attacked.length > 0 && !caster.getTraitLevel('ImprovedMultifocus')) {
      const divisor = caster.getTraitLevel('Multifocus') ? 2 : 1;

      let castPotency = attacked.length / divisor;
      let castDuration = 7;
      const loweredDefensesInstance = caster.hasEffect('LoweredDefenses');

      if(loweredDefensesInstance) {
        castPotency = Math.max(loweredDefensesInstance.setPotency, castPotency);
        castDuration = Math.max(loweredDefensesInstance.duration, castPotency);
      }

      const debuff = new LoweredDefenses({ potency: castPotency, duration: castDuration });
      debuff.cast(caster, caster);
    }
  }
}
