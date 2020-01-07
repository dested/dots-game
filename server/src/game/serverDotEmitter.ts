import {GameConstants} from '../../../common/src/game/gameConstants';
import {ServerEmitter} from './serverEmitter';
import {ServerGame} from './serverGame';

export class ServerDotEmitter implements ServerEmitter {
  constructor(
    public game: ServerGame,
    public x: number,
    public y: number,
    public power: number,
    public emitterId: string,
    public teamId: string,
    public isRootEmitter: boolean
  ) {}

  get radius() {
    return this.game.swarms.find(a => a.ownerEmitterId === this.emitterId)!.radius;
  }

  serverTick() {
    const find = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!find) {
      // debugger;
      throw new Error('bnunko');
    }
    find.augmentDotCount(Math.min(this.power, GameConstants.maxDotsPerSwarm - find.dotCount));
  }
}
