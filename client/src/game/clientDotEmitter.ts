import {GameConstants} from '../../../common/src/game/gameConstants';
import {ColorUtils} from '../../../common/src/utils/colorUtils';
import {CanvasUtils} from '../utils/canvasUtils';
import {ClientEmitter} from './clientEmitter';
import {ClientGame} from './clientGame';

export class ClientDotEmitter implements ClientEmitter {
  constructor(
    public game: ClientGame,
    public x: number,
    public y: number,
    public power: number,
    public emitterId: string,
    public teamId: string
  ) {}

  tick() {}

  get radius() {
    return this.game.swarms.find(a => a.ownerEmitterId === this.emitterId)!.radius;
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    const team = this.game.teams.find(t => t.teamId === this.teamId);
    if (!team) {
      // debugger;
      throw new Error('bunkop team' + this.teamId);
    }
    context.fillStyle = ColorUtils.shade(team.color, 20) + 'aa';
    const swarm = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!swarm) {
      // debugger;
      throw new Error('bunkop');
    }

    CanvasUtils.circle(context, this.x, this.y, Math.max(swarm.radius, GameConstants.emitterRadius));
    context.stroke();
    context.fill();
    context.restore();
  }
}
