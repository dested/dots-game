import {BaseDeadEmitter} from '../../../common/src/game/baseDeadEmitter';
import {GameConstants} from '../../../common/src/game/gameConstants';
import {ColorUtils} from '../../../common/src/utils/colorUtils';
import {CanvasUtils} from '../utils/canvasUtils';
import {ClientEmitter} from './clientEmitter';
import {ClientGame} from './clientGame';

export class ClientDeadEmitter extends BaseDeadEmitter implements ClientEmitter {
  life: number = GameConstants.deadEmitterStartingLife;
  constructor(public game: ClientGame, x: number, y: number, power: number, emitterId: string) {
    super(x, y, power, emitterId);
  }

  tick() {}

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.fillStyle = ColorUtils.shade('#d4d4d4', 50) + 'aa';

    CanvasUtils.circle(
      context,
      this.x,
      this.y,
      GameConstants.emitterRadius * (this.life / GameConstants.deadEmitterStartingLife)
    );
    context.stroke();
    context.fill();
    context.restore();
  }

  setLife(life: number) {
    this.life = life;
  }
}
