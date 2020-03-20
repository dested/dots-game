import {BaseDeadEmitter} from '../../../common/src/game/baseDeadEmitter';
import {GameConstants} from '../../../common/src/game/gameConstants';
import {ColorUtils} from '../../../common/src/utils/colorUtils';
import {CanvasUtils} from '../utils/canvasUtils';
import {ClientEmitter} from './clientEmitter';
import {ClientGame} from './clientGame';
import {ClientGameUI} from './clientGameUI';

export class ClientDeadEmitter extends BaseDeadEmitter implements ClientEmitter {
  life: number = GameConstants.deadEmitterStartingLife;
  duration: number = GameConstants.deadEmitterStartingDuration;

  constructor(
    public game: ClientGame,
    x: number,
    y: number,
    power: number,
    emitterId: number,
    life: number,
    duration: number
  ) {
    super(x, y, power, emitterId);
    this.life = life;
    this.duration = duration;
  }

  tick() {}

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    const percent = this.duration / GameConstants.deadEmitterStartingDuration;
    context.fillStyle = '#d4d4d4' + ColorUtils.getTransparentHex(percent);

    CanvasUtils.circle(
      context,
      this.x,
      this.y,
      GameConstants.emitterRadius * (this.life / GameConstants.deadEmitterStartingLife)
    );
    context.stroke();
    context.fill();
    if (GameConstants.debugDraw) {
/*
      context.font = '60px bold';
      context.fillStyle = 'red';
      // context.fillText(this.life.toString(), this.x, this.y);
      context.fillText(this.duration.toString() + '-' + percent, this.x, this.y);
*/
    }
    context.restore();
  }

  setLife(life: number) {
    this.life = life;
  }

  setDuration(duration: number) {
    this.duration = duration;
  }
}
