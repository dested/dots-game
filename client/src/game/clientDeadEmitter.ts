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

  constructor(public game: ClientGame, x: number, y: number, power: number, emitterId: number) {
    super(x, y, power, emitterId);
  }

  tick() {}

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.fillStyle =
      '#d4d4d4' + ColorUtils.getTransparentHex(1 - this.duration / GameConstants.deadEmitterStartingDuration);

    CanvasUtils.circle(
      context,
      this.x,
      this.y,
      GameConstants.emitterRadius * (this.life / GameConstants.deadEmitterStartingLife)
    );
    context.stroke();
    context.fill();
    if (GameConstants.debug) {
      context.font = '30px bold';
      context.fillStyle = 'red';
      context.fillText(this.life.toString(), this.x, this.y);
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
