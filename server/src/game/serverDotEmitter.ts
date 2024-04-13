import {GameConstants} from '@common/game/gameConstants';
import {RNode} from '../rbush';
import {ServerEmitter} from './serverEmitter';
import {ServerGame} from './serverGame';
import {ServerDotSwarm} from './serverDotSwarm';

export class ServerDotEmitter implements ServerEmitter {
  private bushNode: RNode<ServerDotEmitter>;
  private _mySwarm!: ServerDotSwarm;

  constructor(
    public game: ServerGame,
    public x: number,
    public y: number,
    public power: number,
    public emitterId: number,
    public teamId: string,
    public isRootEmitter: boolean
  ) {
    this.bushNode = {
      minX: x - GameConstants.maxSwarmRadius,
      minY: y - GameConstants.maxSwarmRadius,
      maxX: x + GameConstants.maxSwarmRadius,
      maxY: y + GameConstants.maxSwarmRadius,
      item: this,
      children: null!,
    };
    game.emitterBush.insert(this.bushNode);
  }

  get mySwarm() {
    if (!this._mySwarm) {
      this._mySwarm = this.game.swarms.find((a) => a.ownerEmitterId === this.emitterId)!;
    }
    return this._mySwarm;
  }

  get radius() {
    return this.mySwarm.radius;
  }

  serverTick(tickIndex: number) {
    if (this.mySwarm.dotCount < GameConstants.emitterDotCap) {
      this.mySwarm.augmentDotCount(Math.min(this.power, GameConstants.emitterDotCap - this.mySwarm.dotCount));
    }
  }

  remove(): void {
    this.game.emitterBush.remove(this.bushNode);
  }
}
