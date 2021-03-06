
import { extend, merge, differenceBy, values, filter, reject, size, get, set, findIndex } from 'lodash';

import { BehaviorSubject, Subject } from 'rxjs';

import { MapLayer } from '../../shared/models/maplayer';
import { LootHelper } from '../../server/helpers/world/loot-helper';
import { SkillTree } from '../../shared/models/skill-tree';
import { ICharacter, IPlayer } from '../../shared/interfaces/character';
import { Character } from '../../shared/models/character';
import { Player } from '../../shared/models/player';
import { Item } from '../../shared/models/item';
import { IItem } from '../../shared/interfaces/item';

const SpecialDiscordMaps = {
  'Rylt-CaveUpstairs-Dungeon': 'lair-mage',
  'Rylt-BeneathPrison-Dungeon': 'lair-smith',
  'Yzalt-BelowMadhouse-Dungeon': 'lair-lich',
  'YzaltBasement-Dungeon': 'lair-lich'
};

export class ClientGameState {
  fovArray = Array(9).fill(null).map((x, i) => i - 4);

  _currentPlayer: IPlayer;

  public set currentPlayer(player: IPlayer) {
    this._currentPlayer = player;

    if(player) {
      (<any>window).discordGlobalCharacter = player.toSaveObject();
      if(SpecialDiscordMaps[player.map]) (<any>window).discordGlobalCharacter._gameImage = SpecialDiscordMaps[player.map];

    } else {
      (<any>window).discordGlobalCharacter = null;
    }
  }

  public get currentPlayer() {
    return this._currentPlayer;
  }

  private playerHash: { [key: string]: IPlayer } = {};
  map: any = {};
  mapName = '';
  mapData: any = { openDoors: {} };
  mapNPCs: { [key: string]: ICharacter } = {};
  fov: any = {};
  darkness: any = {};
  secretWallHash: any = {};

  _activeTarget: ICharacter;

  groundItems: any = {};

  public logMessages$ = new Subject<any>();
  public skillTree$ = new BehaviorSubject<SkillTree>(new SkillTree({}));

  environmentalObjects: any[] = [];

  updates = {
    openDoors: []
  };

  playerBoxes$  = new Subject<{ newPlayer: IPlayer, oldPlayer: IPlayer }>();
  updateGround$ = new BehaviorSubject({});

  setMap$ = new BehaviorSubject({});

  public hasLoadedInGame: boolean;

  get players() {
    return values(this.playerHash);
  }

  get allCharacters(): ICharacter[] {
    return (<ICharacter[]>values(this.mapNPCs)).concat(this.players);
  }

  get activeTarget() {
    return this._activeTarget;
  }

  set activeTarget(target) {
    this._activeTarget = target;
  }

  constructor(opts) {
    extend(this, opts);
    this.initFOV();
  }

  modifyDoor(doorChange) {
    this.updates.openDoors.push(doorChange.path.id);
  }

  grabOldUpdates(mapData) {
    Object.keys(mapData.openDoors).forEach(doorId => {
      if(!mapData.openDoors[doorId].isOpen) return;
      this.updates.openDoors.push(doorId);
    });
  }

  setPlayer(player: IPlayer) {
    this.currentPlayer = player;
  }

  setMap(map) {
    this.map = map;
    this.findSecretWalls();
    this.setMap$.next(map);
  }

  setNPCVolatile(npcVolatile) {
    Object.keys(npcVolatile).forEach(npcUUID => {
      if(!this.mapNPCs[npcUUID]) return;
      merge(this.mapNPCs[npcUUID], npcVolatile[npcUUID]);
      this.mapNPCs[npcUUID].effects = npcVolatile[npcUUID].effects;

      const newStealth = get(npcVolatile[npcUUID], 'totalStats.stealth', 0);
      set(this.mapNPCs[npcUUID], 'totalStats.stealth', newStealth);
    });
  }

  private findSecretWalls() {
    const allPossibleLayers = this.map.layers[MapLayer.OpaqueDecor].objects;
    const secretWalls: any = filter(allPossibleLayers, { type: 'SecretWall' });
    secretWalls.forEach(({ x, y }) => {
      this.secretWallHash[x / 64] = this.secretWallHash[x / 64] || {};
      this.secretWallHash[x / 64][(y / 64) - 1] = true;
    });
  }

  setMapData(data) {
    this.mapData = data;
  }

  addNPC(npc) {
    if(!npc) return;
    this.mapNPCs[npc.uuid] = new Character(npc);
  }

  removeNPC(npcUUID: string) {
    delete this.mapNPCs[npcUUID];
  }

  setMapNPCs(data) {
    Object.keys(data).forEach(uuid => data[uuid] = new Character(data[uuid]));
    this.mapNPCs = data;
  }

  addGroundItem(x: number, y: number, item: IItem) {
    const xKey = `x${x}`;
    const yKey = `y${y}`;

    this.groundItems[xKey] = this.groundItems[xKey] || {};
    this.groundItems[xKey][yKey] = this.groundItems[xKey][yKey] || {};
    this.groundItems[xKey][yKey][item.itemClass] = this.groundItems[xKey][yKey][item.itemClass] || [];

    const typeList = this.groundItems[xKey][yKey][item.itemClass];

    if(LootHelper.isItemValueStackable(item) && typeList[0]) {
      typeList[0].value += item.value;
    } else {
      typeList.push(item);
    }

    this.updateGroundItems();
  }

  updateGroundItem(x: number, y: number, item: IItem) {
    const xKey = `x${x}`;
    const yKey = `y${y}`;

    this.groundItems[xKey] = this.groundItems[xKey] || {};
    this.groundItems[xKey][yKey] = this.groundItems[xKey][yKey] || {};
    this.groundItems[xKey][yKey][item.itemClass] = this.groundItems[xKey][yKey][item.itemClass] || [];

    const typeList = this.groundItems[xKey][yKey][item.itemClass];

    const oldItem = findIndex(typeList, { uuid: item.uuid });
    if(oldItem === -1) return;

    typeList[oldItem] = item;

    this.updateGroundItems();
  }

  removeGroundItem(x: number, y: number, item: IItem) {
    const xKey = `x${x}`;
    const yKey = `y${y}`;

    this.groundItems[xKey] = this.groundItems[xKey] || {};
    this.groundItems[xKey][yKey] = this.groundItems[xKey][yKey] || {};
    this.groundItems[xKey][yKey][item.itemClass] = this.groundItems[xKey][yKey][item.itemClass] || [];

    this.groundItems[xKey][yKey][item.itemClass] = reject(this.groundItems[xKey][yKey][item.itemClass], (i: IItem) => i.uuid === item.uuid);

    if(size(this.groundItems[xKey][yKey][item.itemClass]) === 0) delete this.groundItems[xKey][yKey][item.itemClass];
    if(size(this.groundItems[xKey][yKey]) === 0) delete this.groundItems[xKey][yKey];
    if(size(this.groundItems[xKey]) === 0) delete this.groundItems[xKey];

    this.updateGroundItems();
  }

  setGroundItems(data) {
    this.groundItems = data;
    this.updateGroundItems();
  }

  private updateGroundItems() {
    this.updateGround$.next(this.groundItems || {});
  }

  setEnvironmentalObjects(data) {
    this.environmentalObjects = data;
  }

  setDarkness(data) {
    this.darkness = data;
  }

  initFOV(fov?) {
    for(let x = -5; x <= 5; x++) {
      this.fov[x] = this.fov[x] || {};

      for(let y = -5; y <= 5; y++) {
        this.fov[x][y] = !!(fov && fov[x] && fov[x][y]);
      }
    }
  }

  setFOV(fov) {
    this.initFOV(fov);
  }

  setPlayers(players) {
    const newList = Object.keys(players);
    const oldList = Object.keys(this.playerHash);

    const delPlayers = differenceBy(oldList, newList);

    newList.forEach(playerUsername => {
      this.playerHash[playerUsername] = new Player(players[playerUsername]);
      this.playerHash[playerUsername].init();
    });

    delPlayers.forEach(p => this.removePlayer(this.playerHash[p]));
  }

  findPlayer(username) {
    return this.playerHash[username];
  }

  private removePlayer(player: IPlayer) {
    delete this.playerHash[player.username];
  }

  updatePlayerStealth(playerIndex, stealth) {
    if(!this.playerHash[playerIndex]) return;
    (<any>this.playerHash[playerIndex]).totalStats.stealth = stealth;
  }

  updatePlayerPerception(playerIndex, perception) {
    if(!this.playerHash[playerIndex]) return;
    (<any>this.playerHash[playerIndex]).totalStats.perception = perception;
  }

  updatePlayer(playerIndex, attr, val) {
    if(!this.playerHash[playerIndex]) return;
    this.playerHash[playerIndex][attr] = val;
  }

  updatePlayerEffect(change) {
    const playerIndex = change.path.id;
    const effectIndex = change.path.effect;
    const attr = change.path.attr;
    const effect = change.value;

    if(!this.playerHash[playerIndex]) return;

    const effectRef = this.playerHash[playerIndex].effects;

    if(change.operation === 'remove') {
      delete effectRef[effectIndex];
      return;
    }

    if(change.operation === 'add') {
      effectRef[effectIndex] = effectRef[effectIndex] || (<any>{});
      effectRef[effectIndex][attr] = effect;
    }

    if(change.operation === 'replace' && effectRef[effectIndex]) {
      effectRef[effectIndex][attr] = effect;
      if(effectRef[effectIndex].duration <= 0 && !get(effectRef[effectIndex], 'effectInfo.isPermanent', false)) {
        delete effectRef[effectIndex];
      }
    }
  }

  private __updatePlayerAttribute(playerIndex, attr, key, val) {
    if(!this.playerHash[playerIndex]) return;
    this.playerHash[playerIndex][attr][key] = val;
  }

  updatePlayerAgro(playerIndex, attr, val) {
    this.__updatePlayerAttribute(playerIndex, 'agro', attr, val);
  }

  updatePlayerHP(playerIndex, key, val) {
    this.__updatePlayerAttribute(playerIndex, 'hp', key, val);
  }

  updatePlayerHand(playerIndex, hand, item) {
    if(!this.playerHash[playerIndex]) return;
    this.playerHash[playerIndex][hand] = item;
  }

  updatePlayerGearItem(playerIndex, slot, item) {
    if(!this.playerHash[playerIndex]) return;
    this.__updatePlayerAttribute(playerIndex, 'gear', slot, item);
  }

  updatePlayerHandItem(playerIndex, hand, attr, value) {
    if(!this.playerHash[playerIndex]) return;
    this.playerHash[playerIndex][hand] = this.playerHash[playerIndex][hand] || {};
    this.__updatePlayerAttribute(playerIndex, hand, attr, value);

    // this is bad, but this function is only called when hand swapping happens and there's an item in both hands, so whatever
    this.playerHash[playerIndex][hand] = new Item(this.playerHash[playerIndex][hand]);
  }

  removeAllPlayers() {
    this.playerHash = {};
  }

  addLogMessage(message) {
    message.message = this.formatMessage(message);

    this.logMessages$.next(message);
  }

  private formatMessage(message: any) {
    if(message.dirFrom && message.message.toLowerCase().startsWith('you hear')) {
      return message.message.substring(8);
    }
    return message.message;
  }

  reset() {
    this.map = {};
    this.mapName = '';
    this.updates = { openDoors: [] };
    this.currentPlayer = null;

    this.mapchangeReset();
  }

  mapchangeReset() {
    this.darkness = {};
    this.groundItems = {};
    this.updateGround$.next({});
    this.skillTree$.next(new SkillTree({}));
    this._activeTarget = null;
    this.mapNPCs = {};
    this.environmentalObjects = [];
    this.fov = {};
    this.mapData = { openDoors: {} };
    this.removeAllPlayers();
  }
}
