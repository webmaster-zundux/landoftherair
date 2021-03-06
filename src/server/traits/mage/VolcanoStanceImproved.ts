
import { Trait } from '../../../shared/models/trait';

export class VolcanoStanceImproved extends Trait {

  static baseClass = 'Mage';
  static traitName = 'VolcanoStanceImproved';
  static description = 'Do $10|30$% more fire damage per physical hit (while resisting that much more fire damage) while in Volcano stance.';
  static icon = 'fire-silhouette';

  static upgrades = [
    { }, { capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 0.1;
  }

}
