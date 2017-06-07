import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ground',
  templateUrl: './ground.component.html',
  styleUrls: ['./ground.component.scss']
})
export class GroundComponent {

  @Input()
  public colyseusGame: any;

  public selectedType: string;

  get player() {
    return this.colyseusGame.character;
  }

  get currentGround() {
    const ground = this.colyseusGame.clientGameState.groundItems;
    const player = this.player;

    if(!ground[player.x]) return [];
    if(!ground[player.x][player.y]) return [];

    return ground[player.x][player.y];
  }

  get itemTypes() {
    const ground = this.currentGround;
    return Object.keys(ground).sort();
  }

}
