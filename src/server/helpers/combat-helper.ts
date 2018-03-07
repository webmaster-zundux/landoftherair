
import { includes, random, capitalize, get, clamp } from 'lodash';

import { Character, SkillClassNames, StatName } from '../../shared/models/character';
import { ShieldClasses, Item, MagicCutArmorClasses, WeaponClasses } from '../../shared/models/item';
import * as Classes from '../classes';
import * as Effects from '../effects';

import * as dice from 'dice.js';
import { CharacterHelper } from './character-helper';
import { NPC } from '../../shared/models/npc';
import { BuildupEffect } from '../base/Effect';

export type DamageType =
  'Physical'
| 'Fire'
| 'Ice'
| 'Water'
| 'Energy';

export const BaseItemStatsPerTier = {
  Axe:                  { base: 2, min: 0, max: 2, weakChance: 10, damageBonus: 0 },
  Broadsword:           { base: 2, min: 0, max: 2, weakChance: 5,  damageBonus: 5 },
  Claws:                { base: 3, min: 0, max: 1, weakChance: 10, damageBonus: 0 },
  Club:                 { base: 1, min: 0, max: 1, weakChance: 10, damageBonus: 10 },
  Crossbow:             { base: 0, min: 0, max: 3, weakChance: 10, damageBonus: 10 },
  Dagger:               { base: 1, min: 0, max: 1, weakChance: 10, damageBonus: 15 },
  Flail:                { base: 0, min: 1, max: 4, weakChance: 10, damageBonus: 0 },
  Gloves:               { base: 1, min: 0, max: 2, weakChance: 10, damageBonus: 5 },
  Hands:                { base: 1, min: 0, max: 2, weakChance: 10, damageBonus: 5 },
  Greataxe:             { base: 5, min: 0, max: 3, weakChance: 10, damageBonus: 0 },
  Greatmace:            { base: 5, min: 0, max: 3, weakChance: 10, damageBonus: 0 },
  Greatsword:           { base: 1, min: 1, max: 7, weakChance: 10, damageBonus: 0 },
  Halberd:              { base: 1, min: 0, max: 4, weakChance: 10, damageBonus: 0 },
  Hammer:               { base: 1, min: 0, max: 1, weakChance: 20, damageBonus: 15 },
  Longbow:              { base: 4, min: 1, max: 3, weakChance: 10, damageBonus: 0 },
  Longsword:            { base: 2, min: 1, max: 2, weakChance: 15, damageBonus: 5 },
  Mace:                 { base: 2, min: 0, max: 2, weakChance: 10, damageBonus: 10 },
  Shield:               { base: 0, min: 0, max: 0, weakChance: 10, damageBonus: 0 },
  Shortbow:             { base: 3, min: 1, max: 2, weakChance: 10, damageBonus: 0 },
  Shortsword:           { base: 1, min: 1, max: 2, weakChance: 15, damageBonus: 10 },
  Spear:                { base: 1, min: 0, max: 3, weakChance: 10, damageBonus: 0 },
  Staff:                { base: 0, min: 0, max: 2, weakChance: 20, damageBonus: 0 },
  Totem:                { base: 1, min: 0, max: 1, weakChance: 30, damageBonus: 0 },
  Wand:                 { base: 1, min: 0, max: 1, weakChance: 30, damageBonus: 0 }
};

export class CombatHelper {

  static determineWeaponInformation(item: Item, baseRolls = 0) {
    if(!BaseItemStatsPerTier[item.itemClass]) {
      return { damageRolls: 0, damageBonus: 0, isWeak: false, isStrong: false };
    }

    const tier = item.tier || 0;
    const { base, min, max, weakChance, damageBonus } = BaseItemStatsPerTier[item.itemClass];

    let damageRolls = baseRolls;
    const minTier = min * tier;
    const maxTier = max * tier;
    const baseTier = base * tier;

    // try to flub
    const didFlub = random(0, 100) <= weakChance;

    const bonusRolls = didFlub ? minTier : random(minTier, maxTier);

    damageRolls += bonusRolls;

    // check if weak or strong hit
    const isWeak = min !== max && didFlub;
    const isStrong = min !== max && bonusRolls === maxTier;

    // add base tier damage if no flub
    if(!didFlub) damageRolls += baseTier;

    return { damageRolls, damageBonus: damageBonus * tier, isWeak, isStrong };
  }

  static attemptToShadowSwap(char: Character) {
    const shadowSwapLevel = char.getTraitLevelAndUsageModifier('ShadowSwap');
    if(shadowSwapLevel === 0) return;
    if(!CharacterHelper.isNearWall(char)) return;

    if(random(1, 100) > shadowSwapLevel) return;

    const hidden = new Effects.Hidden({});
    char.sendClientMessage('You swap places with your shadow!');
    hidden.cast(char, char);
  }

  static attemptToStun(attacker: Character, weapon: Item, defender: Character) {
    if(!weapon.proneChance) return;
    if(random(1, 100) > weapon.proneChance) return;

    const push = new Effects.Push({ potency: attacker.level });
    push.cast(attacker, defender);

    // low chance of cstun
    if(random(1, defender.getTotalStat('con')) > 3) return;

    const stun = new Effects.Stunned({});
    stun.cast(attacker, defender);
  }

  static isShield(item) {
    return includes(ShieldClasses, item.itemClass);
  }

  static resolveThrow(attacker, defender, hand, item) {
    if(item.returnsOnThrow) return;
    attacker[`set${capitalize(hand)}Hand`](null);

    const breakTypes = {
      Bottle: `You hear the sound of glass shattering!`,
      Trap: `You hear a mechanical snap and see parts fly all over!`
    };

    if(breakTypes[item.itemClass]) {
      defender.sendClientMessageToRadius({
        message: breakTypes[item.itemClass], subClass: 'combat' }, 5
      );

    } else {
      defender.$$room.addItemToGround(defender, item);
    }
  }

  static physicalAttack(attacker: Character, defender: Character, opts: any = {}) {
    this.doPhysicalAttack(attacker, defender, opts);

    const throwCheck = !opts.isThrow || (opts.isThrow && get(attacker.leftHand, 'returnsOnThrow'));

    if(throwCheck && get(attacker.leftHand, 'offhand')) {
      opts = opts || {};
      opts.isOffhand = true;
      opts.throwHand = 'left';
      this.doPhysicalAttack(attacker, defender, opts);
    }
  }

  private static calcDurabilityDamageDoneBasedOnDefender(item: Item, attacker: Character, defender: Character, baseDamage: number): number {
    if(!defender.isNaturalResource) return baseDamage;

    if(item.itemClass === 'Bottle') {
      attacker.sendClientMessage('Your bottle is in critical condition!');
      return item.condition;
    }

    attacker.sendClientMessage(`You strain your ${item.itemClass.toLowerCase()} from striking the ${defender.name}!`);

    let modifier = 1;
    const classMultiplier = attacker.baseClass === 'Warrior' ? 50 : 100;

    if(defender.isOreVein) {
      if(item.type !== 'Mace') modifier = 2;
    } else {
      if(item.type === 'Mace' || item.type === 'Staff') modifier = 2;
    }

    return classMultiplier * baseDamage * modifier;
  }

  private static calcDamageDoneBasedOnDefender(item: Item, attacker: Character, defender: Character, baseDamage: number, criticality: number): number {
    if(!defender.isNaturalResource) return baseDamage;

    if(!includes(WeaponClasses, item.itemClass)) return 0;

    if(defender.isOreVein) {
      if(item.type === 'Mace') criticality += 1;
    } else {
      if(item.type !== 'Mace' && item.type !== 'Staff') criticality += 1;
    }

    if(attacker.baseClass === 'Warrior') criticality += 1;

    return criticality;
  }

  private static doPhysicalAttack(attacker: Character, defender: Character, opts: any = {}) {
    const { isThrow, throwHand, isMug, attackRange, isOffhand } = opts;
    let { isBackstab } = opts;

    if(!isBackstab) {
      const procChance = attacker.getTraitLevelAndUsageModifier('ShadowDaggers');
      if(random(1, 100) <= procChance) {
        defender.sendClientMessage({
          message: `Your shadow daggers unsheathe themselves and attempt to strike ${defender.name}!`,
          subClass: 'combat other hit'
        });
        isBackstab = true;
      }
    }

    if(defender.isDead() || attacker.isDead()) return { isDead: true };

    attacker.combatTicks = 10;
    defender.combatTicks = 10;

    const isAttackerVisible = defender.canSeeThroughStealthOf(attacker);

    let attackerWeapon: Item;

    if(isThrow) {
      attackerWeapon = attacker[`${throwHand}Hand`];

    } else if(isOffhand) {
      attackerWeapon = attacker.leftHand;

    } else {
      attackerWeapon = attacker.rightHand
                    || attacker.gear.Hands
                    || { type: SkillClassNames.Martial, itemClass: 'Hands', name: 'hands',
                         tier: 1,
                         canUseInCombat: () => true,
                         isOwnedBy: () => true, hasCondition: () => true, loseCondition: (x, y) => {} };
    }

    const flagSkills = [];
    flagSkills[0] = attackerWeapon.type;
    if(attackerWeapon.secondaryType) flagSkills[1] = attackerWeapon.secondaryType;

    if(isThrow)                           flagSkills[2] = SkillClassNames.Throwing;
    if(!isAttackerVisible || isBackstab)  flagSkills[2] = SkillClassNames.Thievery;

    attacker.flagSkill(flagSkills);

    if(attacker.rightHand && !attackerWeapon.canUseInCombat(attacker)) {
      if(!isThrow || (isThrow && attackerWeapon.returnsOnThrow)) {
        attacker.$$room.addItemToGround(attacker, attacker.rightHand);
        attacker.setRightHand(null);
      }

      attacker.sendClientMessage({ message: `Your hand feels a burning sensation!`, target: defender.uuid });
      return;
    }

    let defenderArmor = null;

    if(!defenderArmor && defender.gear.Robe2 && defender.gear.Robe2.hasCondition()) defenderArmor = defender.gear.Robe2;
    if(!defenderArmor && defender.gear.Robe1 && defender.gear.Robe1.hasCondition()) defenderArmor = defender.gear.Robe1;
    if(!defenderArmor && defender.gear.Armor && defender.gear.Armor.hasCondition()) defenderArmor = defender.gear.Armor;

    if(!defenderArmor) defenderArmor = { hasCondition: () => true,
                                         isOwnedBy: (x) => true,
                                         loseCondition: (x, y) => {},
                                         conditionACModifier: () => 0 };

    const defenderBlocker = defender.rightHand
                        || { type: SkillClassNames.Martial, itemClass: 'Hands', name: 'hands', conditionACModifier: () => 0,
                             hasCondition: () => true, isOwnedBy: (x) => true, loseCondition: (x, y) => {} };

    const defenderShield = defender.leftHand && this.isShield(defender.leftHand)
                         ? defender.leftHand
                         : null;

    const offhandDivisor = isOffhand ? 3 : 1;

    const attackerName = isAttackerVisible ? attacker.name : 'somebody';
    const attackerDamageRolls = attacker.getTotalStat('weaponDamageRolls');

    const { damageRolls, damageBonus, isWeak, isStrong } = this.determineWeaponInformation(attackerWeapon, attackerDamageRolls);

    // skill + 1 because skill 0 is awful
    const calcSkill = attacker.calcSkillLevel(isThrow ? SkillClassNames.Throwing : attackerWeapon.type) + 1;

    const damageCalcStat = isThrow || attackerWeapon.type === 'Ranged' ? 'dex' : 'str';

    const attackerScope = {
      skill: calcSkill,
      skill4: Math.floor(calcSkill / 4),
      offense: Math.floor(attacker.getTotalStat('offense') / offhandDivisor),
      accuracy: Math.floor(attacker.getTotalStat('accuracy') / offhandDivisor),
      dex: Math.floor(attacker.getTotalStat('dex') / offhandDivisor),
      dex4: Math.floor((attacker.getTotalStat('dex') / 4) / offhandDivisor),
      damageStat: Math.floor(attacker.getTotalStat(damageCalcStat) / offhandDivisor),
      damageStat4: Math.floor((attacker.getTotalStat(damageCalcStat) / 4) / offhandDivisor),
      level: 1 + Math.floor(attacker.level / Classes[attacker.baseClass || 'Undecided'].combatLevelDivisor),
      realLevel: attacker.level,
      damageRolls: Math.max(1, damageRolls)
    };

    const defenderWeaponAC = defender.getTotalStat('weaponArmorClass');
    const defenderACBoost = defenderArmor.conditionACModifier() + (defenderShield ? defenderShield.conditionACModifier() : 0);

    const defenderScope = {
      skill: defender.calcSkillLevel(defenderBlocker.type) + 1,
      defense: defender.getTotalStat('defense'),
      agi: defender.getTotalStat('agi'),
      dex: defender.getTotalStat('dex'),
      dex4: Math.floor(defender.getTotalStat('dex') / 4),
      armorClass: defender.getTotalStat('armorClass') + defenderACBoost,
      shieldAC: defenderShield ? defenderShield.stats.armorClass : 0,
      shieldDefense: defenderShield ? defenderShield.stats.defense || 0 : 0,
      level: 1 + Math.floor(defender.level / Classes[defender.baseClass || 'Undecided'].combatLevelDivisor),
      realLevel: defender.level,
      mitigation: defender.getTotalStat('mitigation')
    };

    const lostAtkCondition = 1 - (attacker.getTraitLevelAndUsageModifier('CarefulTouch'));
    const totalConditionDamageDone = this.calcDurabilityDamageDoneBasedOnDefender(attackerWeapon, attacker, defender, lostAtkCondition);
    attackerWeapon.loseCondition(totalConditionDamageDone, () => attacker.recalculateStats());
    defender.addAgro(attacker, 1);

    // try to dodge
    const attackerDodgeBlockLeftSide = Math.floor(10 + attackerScope.skill + attackerScope.offense + attackerScope.accuracy);
    const attackerDodgeBlockRightSide = Math.floor(attackerScope.dex + attackerScope.skill);

    const defenderDodgeBlockLeftSide = Math.floor(1 + defenderScope.defense);
    const defenderDodgeRightSide = Math.floor(defenderScope.dex4 + defenderScope.agi + defenderScope.level);

    const attackerDodgeRoll = +dice.roll(`${attackerDodgeBlockLeftSide}d${attackerDodgeBlockRightSide}`);
    let defenderDodgeRoll = -+dice.roll(`${defenderDodgeBlockLeftSide}d${defenderDodgeRightSide}`);

    if(defender.isNaturalResource) defenderDodgeRoll = 0;

    let attackDistance = attackRange ? attackRange : 0;
    const distBetween = attacker.distFrom(defender);

    if(isBackstab || isMug) {
      attackDistance = 0;
    }

    const dodgeRoll = random(defenderDodgeRoll, attackerDodgeRoll);

    if(dodgeRoll < 0 || attackDistance < distBetween) {
      attacker.$$room.combatEffect(attacker, 'block-miss', defender.uuid);
      attacker.sendClientMessage({
        message: `You miss!`,
        subClass: 'combat self miss',
        target: defender.uuid,
        extraData: {
          type: 'miss',
          uuid: attacker.uuid,
          weapon: attackerWeapon.itemClass,
          damage: 0,
          monsterName: defender.name
        }
      });

      defender.sendClientMessage({
        message: `${attackerName} misses!`, subClass: 'combat other miss',
        extraData: {
          type: 'miss',
          uuid: attacker.uuid,
          weapon: attackerWeapon.itemClass,
          damage: 0,
          monsterName: attacker.name
        }
      });
      if(isThrow) this.resolveThrow(attacker, defender, throwHand, attackerWeapon);
      return { dodge: true };
    }

    // try to block with armor
    const defenderBlockRightSide = Math.floor(defenderScope.level + defenderScope.armorClass);

    const attackerACRoll = Math.max(1, +dice.roll(`${attackerDodgeBlockLeftSide}d${attackerDodgeBlockRightSide}`) - defenderScope.armorClass);
    let defenderACRoll = -+dice.roll(`${defenderDodgeBlockLeftSide}d${defenderBlockRightSide}`);

    if(defender.isNaturalResource) defenderACRoll = 0;

    const acRoll = random(defenderACRoll, attackerACRoll);
    if(acRoll < 0) {
      attacker.$$room.combatEffect(attacker, 'block-armor', defender.uuid);
      attacker.sendClientMessage({
        message: `You were blocked by armor!`,
        subClass: 'combat self block armor',
        target: defender.uuid,
        extraData: {
          type: 'block-armor',
          uuid: attacker.uuid,
          weapon: attackerWeapon.itemClass,
          damage: 0,
          monsterName: defender.name
        }
      });

      defender.sendClientMessage({
        message: `${attackerName} was blocked by your armor!`,
        subClass: 'combat other block armor',
        extraData: {
          type: 'block-armor',
          uuid: attacker.uuid,
          weapon: attackerWeapon.itemClass,
          damage: 0,
          monsterName: attacker.name
        }
      });
      defenderArmor.loseCondition(1, () => defender.recalculateStats());
      if(isThrow) this.resolveThrow(attacker, defender, throwHand, attackerWeapon);
      return { block: true, blockedBy: 'armor' };
    }

    // try to block with weapon
    const attackerWeaponShieldBlockRightSide = Math.floor(attackerScope.damageStat4 + attackerScope.dex + attackerScope.skill) - defenderWeaponAC;
    const defenderWeaponBlockLeftSide = 1;
    const defenderWeaponBlockRightSide = Math.floor(defenderScope.dex4 + defenderScope.skill);

    const attackerWeaponBlockRoll = +dice.roll(`${attackerDodgeBlockLeftSide}d${attackerWeaponShieldBlockRightSide}`);
    let defenderWeaponBlockRoll = -+dice.roll(`${defenderWeaponBlockLeftSide}d${defenderWeaponBlockRightSide}`);

    if(defender.isNaturalResource) defenderWeaponBlockRoll = 0;

    const weaponBlockRoll = random(defenderWeaponBlockRoll, attackerWeaponBlockRoll);
    if(weaponBlockRoll < 0 && defenderBlocker.isOwnedBy(defender) && defenderBlocker.hasCondition()) {
      attacker.$$room.combatEffect(attacker, 'block-weapon', defender.uuid);

      const itemTypeToLower = defenderBlocker.itemClass.toLowerCase();
      attacker.sendClientMessage({
        message: `You were blocked by a ${itemTypeToLower}!`,
        subClass: 'combat self block weapon',
        target: defender.uuid,
        extraData: {
          type: 'block-weapon',
          uuid: attacker.uuid,
          weapon: attackerWeapon.itemClass,
          damage: 0,
          monsterName: defender.name
        }
      });

      defender.sendClientMessage({
        message: `${attackerName} was blocked by your ${itemTypeToLower}!`,
        subClass: 'combat other block weapon',
        extraData: {
          type: 'block-weapon',
          uuid: attacker.uuid,
          weapon: attackerWeapon.itemClass,
          damage: 0,
          monsterName: attacker.name
        }
      });


      const lostCondition = 1 - (defender.getTraitLevelAndUsageModifier('CarefulTouch'));
      defenderBlocker.loseCondition(lostCondition, () => defender.recalculateStats());
      if(isThrow) this.resolveThrow(attacker, defender, throwHand, attackerWeapon);
      return { block: true, blockedBy: `a ${itemTypeToLower}` };
    }

    // try to block with shield
    if(defenderShield && defender.leftHand.isOwnedBy(defender) && defenderShield.hasCondition()) {
      const defenderShieldBlockLeftSide = Math.floor(1 + defenderScope.shieldDefense);
      const defenderShieldBlockRightSide = Math.floor(defenderScope.dex4 + defenderScope.skill);

      const attackerShieldBlockRoll = Math.max(1, +dice.roll(`${attackerDodgeBlockLeftSide}d${attackerWeaponShieldBlockRightSide}`) - defenderScope.shieldAC);
      const defenderShieldBlockRoll = -+dice.roll(`${defenderShieldBlockLeftSide}d${defenderShieldBlockRightSide}`);

      const shieldBlockRoll = random(attackerShieldBlockRoll, defenderShieldBlockRoll);
      if(shieldBlockRoll < 0) {
        attacker.$$room.combatEffect(attacker, 'block-shield', defender.uuid);
        const itemTypeToLower = defenderShield.itemClass.toLowerCase();
        attacker.sendClientMessage({
          message: `You were blocked by a ${itemTypeToLower}!`,
          subClass: 'combat self block shield',
          target: defender.uuid,
          extraData: {
            type: 'block-shield',
            uuid: attacker.uuid,
            weapon: attackerWeapon.itemClass,
            damage: 0,
            monsterName: defender.name
          }
        });

        defender.sendClientMessage({
          message: `${attackerName} was blocked by your ${itemTypeToLower}!`,
          subClass: 'combat other block shield',
          extraData: {
            type: 'block-shield',
            uuid: attacker.uuid,
            weapon: attackerWeapon.itemClass,
            damage: 0,
            monsterName: attacker.name
          }
        });

        const lostCondition = 1 - (defender.getTraitLevelAndUsageModifier('CarefulTouch'));
        defenderShield.loseCondition(lostCondition, () => defender.recalculateStats());
        if(isThrow) this.resolveThrow(attacker, defender, throwHand, attackerWeapon);
        return { block: true, blockedBy: `a ${itemTypeToLower}` };
      }
    }

    const damageLeft = attackerScope.damageRolls + attackerScope.skill4;
    const damageRight = Math.floor(attackerScope.damageStat + attackerScope.level + attackerScope.skill);
    const damageBoost = attacker.getTotalStat('physicalDamageBoost') + damageBonus;

    // thieves get +25% to the bottom damage range, warriors get +50%
    let damageRollMinimum = 1;
    if(attacker.baseClass === 'Thief') damageRollMinimum = Math.floor(damageRight * 0.25);
    if(attacker.baseClass === 'Warrior') damageRollMinimum = Math.floor(damageRight * 0.5);

    let damage = Math.floor(+dice.roll(`${damageLeft}d${damageRight}..${damageRollMinimum}`)) + damageBoost;

    if(isOffhand) {
      damage = Math.floor(damage / offhandDivisor);
    }

    if(isBackstab) {
      const thiefSkill = attacker.calcSkillLevel(SkillClassNames.Thievery);
      const bonusMultiplier = attacker.baseClass === 'Thief' ? 1 + Math.floor(thiefSkill / 8) : 1.5;
      damage = Math.floor(damage * bonusMultiplier);
    }

    if(isMug) {
      const thiefSkill = attacker.calcSkillLevel(SkillClassNames.Thievery);
      const reductionFactor = 1 - Math.max(
        0.5,
        0.9 - (attacker.baseClass === 'Thief' ? Math.floor(thiefSkill / 5) / 10 : 0)
      );
      damage = Math.floor(damage * reductionFactor);
    }

    let msg = '';

    if(attacker.rightHand) {
      msg = `${attackerName} hits with a ${attackerWeapon.itemClass.toLowerCase()}!`;
    } else if(attackerWeapon.itemClass === 'Claws') {
      msg = `${attackerName} claws you!`;
    } else {
      msg = `${attackerName} punches you!`;
    }

    if(damage > 0) {
      const levelDifferenceModifier = clamp(attackerScope.realLevel - defenderScope.realLevel, -10, 10) * 5;
      const mitigationModifier = Math.min(75, defenderScope.mitigation - (defenderScope.mitigation * (levelDifferenceModifier / 100)));
      const mitigatedDamage = Math.floor(damage * (mitigationModifier / 100));
      damage -= mitigatedDamage;
    }

    let damageType = 'was a successful strike';
    let criticality = 1;

    if(isWeak) {
      damageType = 'was a grazing blow';
      criticality = 0;
      attacker.$$room.combatEffect(attacker, 'hit-min', defender.uuid);

    } else if(isStrong) {
      damageType = 'left a grievous wound';
      criticality = 2;
      attacker.$$room.combatEffect(attacker, 'hit-max', defender.uuid);

    } else {
      attacker.$$room.combatEffect(attacker, 'hit-mid', defender.uuid);
    }

    damage = this.calcDamageDoneBasedOnDefender(attackerWeapon, attacker, defender, damage, criticality);

    damage = this.dealDamage(attacker, defender, {
      damage,
      damageClass: 'physical',
      attackerDamageMessage: damage > 0 ? `Your attack ${damageType}!` : '',
      defenderDamageMessage: msg,
      attackerWeapon,
      isRanged: damageCalcStat === 'dex',
      isAttackerVisible
    });

    this.attemptToStun(attacker, attackerWeapon, defender);
    this.attemptToShadowSwap(attacker);

    if(isThrow) this.resolveThrow(attacker, defender, throwHand, attackerWeapon);

    const encrustEffect = get(attackerWeapon, 'encrust.stats.effect', null);

    // encrusted effect takes priority if it exists
    if(encrustEffect) {
      this.tryApplyEffect(attacker, defender, encrustEffect);

    } else if(attackerWeapon.effect) {
      this.tryApplyEffect(attacker, defender, attackerWeapon.effect);
    }

    if(damage <= 0) {
      return { noDamage: true };
    }

    return { hit: true, damage, dealtBy: attackerWeapon.itemClass.toLowerCase(), damageType };
  }

  static tryApplyEffect(attacker, defender, effect) {
    const applyEffect = Effects[effect.name];
    if(!applyEffect) return;

    const chance = effect.chance || 100;
    if(+dice.roll('1d100') > chance) return;

    const appEffect = new applyEffect(effect);
    if(!appEffect.cast) return;

    appEffect.potency = effect.potency || 0;

    appEffect.cast(attacker, defender);
  }

  static magicalAttack(attacker: Character, attacked: Character, { effect, skillRef, atkMsg, defMsg, damage, damageClass }: any = {}) {

    if(attacker) {
      attacker.combatTicks = 10;
    }

    attacked.combatTicks = 10;

    if(skillRef && attacker) {
      attacker.flagSkill(skillRef.flagSkills);
    }

    const willCheck = +dice.roll('1d500') <= attacked.getTotalStat('wil');

    if(willCheck && damage > 0) {
      const willDivisor = Classes[attacked.baseClass || 'Undecided'].willDivisor;
      damage -= Math.floor(damage / willDivisor);
    }

    if(attacker) {
      const armorClass = get(attacker, 'gear.Armor.itemClass');
      if(includes(MagicCutArmorClasses, armorClass)) {
        damage = Math.floor(damage / 2);
      }
    }

    damage = attacked.isNaturalResource ? 0 : damage;
    const totalDamage = this.dealDamage(attacker, attacked, {
      damage, damageClass, attackerDamageMessage: atkMsg, defenderDamageMessage: defMsg, attackerWeapon: {
        itemClass: effect.name,
        owner: effect.effectInfo.caster,
        ownerName: effect.effectInfo.casterName
      }
    });

    if(attacker && !attacker.isPlayer() && effect) {
      (<NPC>attacker).registerAttackDamage(attacked, effect.name, totalDamage);
    }

    if(attacker) {
      attacker.$$room.combatEffect(attacker, `hit-${damage > 0 ? 'magic' : 'heal'}`, attacked.uuid);
    }
  }

  static dealOnesidedDamage(defender, { damage, damageClass, damageMessage, suppressIfNegative }) {
    if(defender.isDead()) return;

    const isHeal = damage < 0;

    if(!isHeal) {
      const damageReduced = defender.getTotalStat(`${damageClass}Resist`);
      damage -= damageReduced;

      // non-physical attacks are magical
      if(damageClass !== 'physical' && damageClass !== 'gm') {
        const magicReduction = defender.getTotalStat('magicalResist');
        damage -= magicReduction;
      }
    }

    if(!isHeal && damage < 0) damage = 0;

    defender.hp.sub(damage);

    if((damage <= 0 && !suppressIfNegative) || damage > 0) {
      defender.sendClientMessage({ message: `${damageMessage} [${damage} ${damageClass} damage]`, subClass: 'combat other hit' });
    }

    if(defender.isDead()) {
      defender.sendClientMessage({ message: `You died!`, subClass: 'combat other kill' });
      defender.die();
    }

    if(damage < 0) return 0;
  }

  static dealDamage(
    attacker: Character,
    defender: Character,
    { damage, damageClass, attackerDamageMessage, defenderDamageMessage, attackerWeapon, isRanged, isAttackerVisible }: any
  ): number {

    if(defender.isDead() || (<any>defender).hostility === 'Never') return;

    const baseDamage = damage;

    const isHeal = damage < 0;

    if(attacker) {
      let damageBoostPercent = 0;

      switch(damageClass) {
        case 'energy':    damageBoostPercent = attacker.getTraitLevelAndUsageModifier('MagicFocus'); break;
        case 'necrotic':  damageBoostPercent = attacker.getTraitLevelAndUsageModifier('NecroticFocus'); break;
        case 'heal':      damageBoostPercent = attacker.getTraitLevelAndUsageModifier('HealingFocus'); break;
        case 'physical':  damageBoostPercent = attacker.getTraitLevelAndUsageModifier('ForcefulStrike'); break;
      }

      if(damageClass === 'physical' && !isAttackerVisible) {
        damageBoostPercent = 10 + attacker.getTraitLevelAndUsageModifier('ShadowRanger');
      }

      damage = Math.floor(damage * (1 + (damageBoostPercent / 100)));

      if(damageClass !== 'physical') {
        damage += attacker.getTotalStat('magicalDamageBoost');
      }
    }

    // if not healing, check for damage resist
    if(!isHeal) {
      const damageReduced = defender.getTotalStat(<StatName>`${damageClass}Resist`);
      damage -= damageReduced;
      // non-physical attacks are magical
      if(damageClass !== 'physical') {
        const magicReduction = defender.getTotalStat('magicalResist');
        damage -= magicReduction;
      }

      if(damage < 0) damage = 0;

      if(damageReduced > 0 && damage !== 0 && attacker && attacker !== defender) {
        attacker.sendClientMessage({
          message: `Your attack is mangled by a magical force!`,
          subClass: `combat self blocked`,
          target: defender.uuid,
          extraData: {
            type: 'hit-physical',
            uuid: attacker ? attacker.uuid : get(attackerWeapon, 'owner', '???'),
            weapon: attackerWeapon ? attackerWeapon.itemClass : '???',
            damage,
            monsterName: defender.name
          }
        });
      }

      if(attacker && attacker !== defender && damage === 0) {
        attacker.sendClientMessage({
          message: `Your attack did no visible damage!`,
          subClass: `combat self blocked`,
          target: defender.uuid,
          extraData: {
            type: 'hit-physical',
            uuid: attacker ? attacker.uuid : get(attackerWeapon, 'owner', '???'),
            weapon: attackerWeapon ? attackerWeapon.itemClass : '???',
            damage: 0,
            monsterName: defender.name
          }
        });
      }

    // if healing, add some boost
    } else {
      if(attacker) {
        damage -= attacker.getTotalStat('healingBoost');
      }
    }

    this.doElementalDebuffing(attacker, defender, damageClass, damage, { isRanged, isAttackerVisible });

    if(defender.isNaturalResource) damage = baseDamage;

    const absDmg = Math.round(Math.abs(damage));
    const dmgString = isHeal ? 'health' : `${damageClass} damage`;

    const otherClass = isHeal ? 'heal' : 'hit';
    const damageType = damageClass === 'physical' ? 'melee' : 'magic';

    if(attackerDamageMessage && (<any>attacker).username) {

      const secondaryClass = attacker !== defender ? 'self' : 'other';

      attacker.sendClientMessage({
        message: `${attackerDamageMessage} [${absDmg} ${dmgString}]`,
        subClass: `combat ${secondaryClass} ${otherClass} ${damageType}`,
        target: defender.uuid,
        extraData: {
          type: 'damage',
          uuid: attacker ? attacker.uuid : get(attackerWeapon, 'owner', '???'),
          weapon: attackerWeapon ? attackerWeapon.itemClass : '???',
          damage,
          monsterName: defender.name
        }
      });
    }

    if(defenderDamageMessage && (<any>defender).username && attacker !== defender) {
      defender.sendClientMessage({
        message: `${defenderDamageMessage} [${absDmg} ${dmgString}]`,
        subClass: `combat other ${otherClass} ${damageType}`,
        extraData: {
          type: 'damage',
          uuid: attacker ? attacker.uuid : get(attackerWeapon, 'owner', '???'),
          weapon: attackerWeapon ? attackerWeapon.itemClass : '???',
          damage,
          monsterName: attacker ? attacker.name : get(attackerWeapon, 'ownerName', '???')
        }
      });
    }

    defender.hp.sub(damage);
    if(defender.$$ai) defender.$$ai.damage.dispatch(defender, { damage, attacker });

    const wasFatal = defender.isDead();

    if(!wasFatal) {
      if(defender !== attacker) {
        defender.addAgro(attacker, damage);
      }
    } else {
      if(attacker) {
        const killMethod = defender.isNaturalResource ? 'smashed' : 'killed';
        defender.sendClientMessageToRadius({
          message: `${defender.name} was ${killMethod} by ${attacker.name}!`, subClass: 'combat self kill' }, 5, [defender.uuid]
        );
        defender.sendClientMessage({ message: `You were killed by ${attacker.name}!`, subClass: 'combat other kill' });
        defender.die(attacker);

        if((<any>attacker).uuid) {
          attacker.kill(defender);
        }

      } else {
        defender.sendClientMessageToRadius({ message: `${defender.name} was killed!`, subClass: 'combat self kill' }, 5, [defender.uuid]);
        defender.sendClientMessage({ message: `You were killed!`, subClass: 'combat other kill' });
        defender.die(attacker);
      }
    }

    defender.$$room.state.updateNPCVolatile(defender);

    return damage;

  }

  private static elementalBoostValue(attacker: Character, debuffName): number {
    if(!attacker) return 0;

    switch(debuffName) {
      case 'BuildupHeat':    return attacker.getTraitLevelAndUsageModifier('ForgedFire');
      case 'BuildupChill':   return attacker.getTraitLevelAndUsageModifier('FrostedTouch');
    }

    return 0;
  }

  private static elementalDecayRateValue(attacker: Character, debuffName: string): number {
    if(!attacker) return 0;

    switch(debuffName) {
      case 'BuildupHeat':   return attacker.getTraitLevelAndUsageModifier('ForgedFire');
      case 'BuildupChill':  return attacker.getTraitLevelAndUsageModifier('FrostedTouch');
    }

    return 0;
  }

  private static getElementalDebuff(damageClass: DamageType,
                                    extraData: { attacker: Character, defender: Character, isRanged: boolean, isAttackerVisible: boolean }): string[] {

    const lowerDamageClass = damageClass.toLowerCase();

    const atk = extraData.attacker;
    const def = extraData.defender;

    if(atk && def && lowerDamageClass === 'physical') {
      if(atk.baseClass === 'Thief' && !extraData.isAttackerVisible && extraData.isRanged) {
        return ['BuildupSneakAttack', 'DefensesShattered', 'RecentlyShattered'];
      }
    }

    switch(lowerDamageClass) {
      case 'fire': return ['BuildupHeat', 'Burning', 'RecentlyBurned'];
      case 'ice': return ['BuildupChill', 'Frosted', 'RecentlyFrosted'];
    }

    return [];
  }

  private static doElementalDebuffing(attacker: Character, defender: Character, damageClass: DamageType, damage: number,
                                      { isRanged, isAttackerVisible }: any = {}) {
    if(!attacker || damage <= 0) return;

    const [debuff, activeDebuff, recentDebuff] = this.getElementalDebuff(damageClass, { attacker, defender, isRanged, isAttackerVisible });
    if(!debuff) return;

    if(defender.hasEffect(activeDebuff) || defender.hasEffect(recentDebuff)) return;

    let targetEffect = defender.hasEffect(debuff);
    const bonusIncrease = this.elementalBoostValue(attacker, debuff);
    const debuffIncrease = 30 + bonusIncrease;

    if(!targetEffect) {
      const buildupMax = 100 + (10 * defender.level);

      targetEffect = new Effects[debuff]({});
      (<BuildupEffect>targetEffect).buildupMax = buildupMax;
      (<BuildupEffect>targetEffect).buildupCur = bonusIncrease;
      (<BuildupEffect>targetEffect).decayRate -= this.elementalDecayRateValue(attacker, damageClass);
      (<BuildupEffect>targetEffect).cast(attacker, defender);
    }

    (<BuildupEffect>targetEffect).buildupCur += debuffIncrease;
    (<BuildupEffect>targetEffect).buildupDamage += damage;
  }
}
