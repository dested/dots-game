import {ServerDeadEmitter} from './serverDeadEmitter';
import {ServerDotEmitter} from './serverDotEmitter';
import {ServerEmitter} from './serverEmitter';

export function switchServerEmitter<T1, T2>(
  emitter: ServerEmitter,
  result: {dot: (e: ServerDotEmitter) => T1; dead: (e: ServerDeadEmitter) => T2}
): T1 | T2 {
  if (emitter instanceof ServerDotEmitter) {
    return result.dot(emitter);
  }
  if (emitter instanceof ServerDeadEmitter) {
    return result.dead(emitter);
  }
  throw new Error('Emitter not found');
}
