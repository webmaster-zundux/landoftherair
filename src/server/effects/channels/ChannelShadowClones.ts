
import { ChanneledSpellEffect } from '../../base/Effect';
import { Character, StatName } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { NPC } from '../../../shared/models/npc';
import { ActivePet } from '../special/ActivePet';
import { SummonedClone } from '../special/SummonedClone';
import { Item } from '../../../shared/models/item';

export class ChannelShadowClones extends ChanneledSpellEffect {

  iconData = {
    name: 'dark-squad',
    bgColor: '#050',
    color: '#fff',
    tooltipDesc: 'Channeling Shadow Clones.'
  };

  maxSkillForSkillGain = 17;

  cast(caster: Character, target: Character, skillRef?: Skill, animalStr?: string) {
    super.cast(caster, target, skillRef);

    this.setPotencyAndGainSkill(caster, skillRef);
    if(!this.duration) this.duration = 5;

    // first, go down to a base of skill 10
    this.potency -= 10;

    // then divide by 5 to see the number of clones total
    this.potency = Math.floor(this.potency / 5);

    caster.applyEffect(this);
  }

  effectStart(char: Character) {
    char.sendClientMessage('You begin calling for backup.');
    char.killAllPets();
  }

  effectEnd(char: Character) {
    if(this.duration !== 0) return;

    char.sendClientMessage('Your backup has arrived!');

    const defaultSpawner = {
      maxCreatures: this.potency,
      respawnRate: 0,
      initialSpawn: this.potency,
      spawnRadius: 0,
      randomWalkRadius: 30,
      leashRadius: 50,
      shouldStrip: false,
      stripOnSpawner: true,
      removeWhenNoNPCs: true,
      npcIds: ['Thief Shadow Clone'],

      npcCreateCallback: (npc: NPC) => {

        // match the player
        npc.allegianceReputation = char.allegianceReputation;
        npc.allegianceReputation.Enemy = -100000;
        npc.allegiance = char.allegiance;
        npc.alignment = char.alignment;
        npc.hostility = 'Faction';
        npc.level = char.level;

        // boost stats
        const skills = char.allSkills;
        Object.keys(skills).forEach(skill => {
          npc._gainSkill(skill, skills[skill]);
        });

        const stats = char.baseStats;
        Object.keys(stats).forEach((stat: StatName) => {
          npc.gainStat(stat, char.getTotalStat(stats[stat]));
        });

        const reversedPotency = (this.potency * 5) + 10;
        npc.gainStat('hp', char.getBaseStat('hp') * reversedPotency);

        npc.recalculateStats();

        if(char.rightHand) {
          npc.rightHand = new Item(char.rightHand);
          npc.rightHand.tier = Math.max(1, npc.rightHand.tier - 1);
        }

        if(char.leftHand) {
          npc.leftHand = new Item(char.leftHand);
          npc.leftHand.tier = Math.max(1, npc.leftHand.tier - 1);
        }

        // make them know each other
        char.$$pets = char.$$pets || [];
        char.$$pets.push(npc);
        npc.$$owner = char;

        const summoned = new SummonedClone({});
        summoned.cast(char, npc);
      }
    };

    char.$$room.createSpawner(defaultSpawner, char);

    const activePet = new ActivePet({ potency: this.potency });
    activePet.duration = this.potency * 50;
    activePet.cast(char, char);
  }
}
