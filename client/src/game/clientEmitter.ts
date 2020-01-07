import {Emitter} from '../../../common/src/game/emitter';

export interface ClientEmitter extends Emitter {
  tick(): void;
  draw(context: CanvasRenderingContext2D): void;
}
