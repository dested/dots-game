import {GameConstants} from '../../../common/src/game/gameConstants';
import {RNode} from '../rbush';
import {ServerEmitter} from './serverEmitter';
import {ServerGame} from './serverGame';

export class ServerDotEmitter implements ServerEmitter {
  private bushNode: RNode<ServerDotEmitter>;

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
    };
    game.emitterBush.insert(this.bushNode);
  }

  get radius() {
    return this.game.swarms.find(a => a.ownerEmitterId === this.emitterId)!.radius;
  }

  serverTick(tickIndex: number) {
    const find = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!find) {
      // debugger;
      throw new Error('bnunko');
    }
    find.augmentDotCount(Math.min(this.power, GameConstants.maxDotsPerSwarm - find.dotCount));
  }

  remove(): void {
    this.game.emitterBush.remove(this.bushNode);
  }
}
