import {Emitter} from '@common/game/emitter';

export interface ClientEmitter extends Emitter {
  tick(): void;
  draw(context: CanvasRenderingContext2D): void;
}
