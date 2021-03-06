
import { BaseClass } from '../base/BaseClass';
import { SkillHelper } from '../helpers/character/skill-helper';
import { ICharacter, SkillClassNames } from '../../shared/interfaces/character';

export class Healer extends BaseClass {
  static combatLevelDivisor = 3;
  static willDivisor = 3;

  static becomeClass(character: ICharacter) {
    BaseClass.becomeClass(character);

    if(!character.getBaseStat('mp')) {
      character.gainBaseStat('mp', 30);
      character._gainSkill(SkillClassNames.Restoration, SkillHelper.calcSkillXP(0));
    }
  }

  static gainLevelStats(character: ICharacter) {
    BaseClass.gainLevelStats(character);
    character.gainBaseStat('hp', this.rollDie(`f([con] / 5)d3 + f([con] / 3)`, character));
    character.gainBaseStat('mp', this.rollDie(`1d[wis] + f([wis] / 3)`, character));
  }
}
