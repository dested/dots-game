import {Emitter} from '@common/game/emitter';

export interface ServerEmitter extends Emitter {
  serverTick(tickIndex: number): void;

  remove(): void;
}
