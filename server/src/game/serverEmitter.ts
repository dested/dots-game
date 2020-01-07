import {Emitter} from '../../../common/src/game/emitter';

export interface ServerEmitter extends Emitter {
  serverTick(): void;
}
