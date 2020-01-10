import {ClientToServerMessage} from '../models/messages';
import {unreachable} from '../utils/unreachable';
import {ArrayBufferBuilder, ArrayBufferReader} from './arrayBufferBuilder';

export class ClientToServerMessageParser {
  static fromClientToServerMessage(message: ClientToServerMessage) {
    const buff = new ArrayBufferBuilder();

    switch (message.type) {
      case 'join':
        buff.addUint8(1);
        break;
      case 'move-dots':
        buff.addUint8(2);
        buff.addInt32(message.x);
        buff.addInt32(message.y);
        buff.addUint16(message.swarms.length);
        for (const swarm of message.swarms) {
          buff.addInt32(swarm.swarmId);
          buff.addFloat64(swarm.percent);
        }
        break;
      case 'resync':
        buff.addUint8(3);
        break;
      default:
        throw unreachable(message);
    }
    return buff.buildBuffer();
  }

  static toClientToServerMessage(buffer: ArrayBuffer): ClientToServerMessage {
    const reader = new ArrayBufferReader(buffer);
    const type = reader.readUint8();

    switch (type) {
      case 1:
        return {
          type: 'join',
        };
      case 2: {
        return {
          type: 'move-dots',
          x: reader.readInt32(),
          y: reader.readInt32(),
          swarms: reader.loop(() => ({
            swarmId: reader.readInt32(),
            percent: reader.readFloat64(),
          })),
        };
      }
      case 3:
        return {
          type: 'resync',
        };
      default:
        throw new Error('Missing buffer enum');
    }
  }
}
