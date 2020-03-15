import {Emitter} from '../../../common/src/game/emitter';

export interface ServerEmitter extends Emitter {
  serverTick(tickIndex: number): void;

  remove(): void;
}
