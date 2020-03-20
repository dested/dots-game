import {GameConfigEmitter} from '../models/gameConfig';
import {ServerToClientMessage} from '../models/messages';
import {unreachable} from '../utils/unreachable';
import {Utils} from '../utils/utils';
import {ArrayBufferBuilder, ArrayBufferReader} from './arrayBufferBuilder';

export class ServerToClientMessageParser {
  static fromServerToClientMessages(messages: ServerToClientMessage[]) {
    const buff = new ArrayBufferBuilder();
    buff.addUint16(messages.length);
    for (const message of messages) {
      switch (message.type) {
        case 'joined':
          buff.addUint8(1);
          buff.addInt32(message.startingX);
          buff.addInt32(message.startingY);
          buff.addString(message.yourTeamId);
          break;
        case 'game-data':
          buff.addUint8(2);
          buff.addUint32(message.gameWidth);
          buff.addUint32(message.gameHeight);
          buff.addUint16(message.teams.length);
          for (const team of message.teams) {
            buff.addString(team.teamId);
            buff.addString(team.color);
          }
          buff.addUint16(message.swarms.length);
          for (const swarm of message.swarms) {
            buff.addString(swarm.teamId);
            buff.addInt32(swarm.swarmId);
            buff.addUint16(swarm.dotCount);
            buff.addInt32(swarm.x);
            buff.addInt32(swarm.y);
            buff.addOptionalInt32(swarm.headingX);
            buff.addOptionalInt32(swarm.headingY);
            buff.addOptionalInt32(swarm.ownerEmitterId);
          }
          buff.addUint16(message.emitters.length);
          for (const emitter of message.emitters) {
            switch (emitter.type) {
              case 'dot':
                buff.addUint8(1);
                buff.addString(emitter.teamId);
                buff.addInt32(emitter.emitterId);
                buff.addInt32(emitter.x);
                buff.addInt32(emitter.y);
                buff.addUint8(emitter.power);
                break;
              case 'dead':
                buff.addUint8(2);
                buff.addInt32(emitter.emitterId);
                buff.addInt32(emitter.x);
                buff.addInt32(emitter.y);
                buff.addUint8(emitter.power);
                buff.addUint16(emitter.life);
                buff.addUint16(emitter.duration);
                break;
              default:
                unreachable(emitter);
            }
          }

          break;
        case 'new-emitter':
          buff.addUint8(3);
          buff.addInt32(message.x);
          buff.addInt32(message.y);
          buff.addUint8(message.power);
          buff.addInt32(message.emitterId);
          buff.addString(message.teamId);
          break;
        case 'dead':
          buff.addUint8(4);
          break;
        case 'new-dead-emitter':
          buff.addUint8(5);
          buff.addInt32(message.x);
          buff.addInt32(message.y);
          buff.addUint8(message.power);
          buff.addInt32(message.emitterId);
          buff.addUint16(message.duration);
          buff.addUint16(message.life);
          break;
        case 'set-dead-emitter-life':
          buff.addUint8(6);
          buff.addInt32(message.emitterId);
          buff.addInt16(message.life);
          break;
        case 'remove-swarm':
          buff.addUint8(7);
          buff.addInt32(message.swarmId);
          break;
        case 'kill-emitter':
          buff.addUint8(8);
          buff.addInt32(message.emitterId);
          break;
        case 'remove-emitter':
          buff.addUint8(9);
          buff.addInt32(message.emitterId);
          break;
        case 'augment-dot-count':
          buff.addUint8(10);
          buff.addInt32(message.swarmId);
          buff.addInt16(message.dotCount);
          break;
        case 'set-team-data':
          buff.addUint8(11);
          buff.addUint16(message.teams.length);
          for (const team of message.teams) {
            buff.addString(team.teamId);
            buff.addString(team.color);
          }
          break;
        case 'new-swarm':
          buff.addUint8(12);
          buff.addInt32(message.swarmId);
          buff.addInt32(message.x);
          buff.addInt32(message.y);
          buff.addString(message.teamId);
          buff.addOptionalInt32(message.ownerEmitterId);
          break;
        case 'set-swarm-heading':
          buff.addUint8(13);
          buff.addInt32(message.swarmId);
          buff.addInt32(message.x);
          buff.addInt32(message.y);
          break;
        case 'set-dead-emitter-duration':
          buff.addUint8(14);
          buff.addInt32(message.emitterId);
          buff.addInt16(message.duration);
          break;
        default:
          throw unreachable(message);
      }
    }
    return buff.buildBuffer();
  }

  static toServerToClientMessages(buffer: ArrayBuffer): ServerToClientMessage[] {
    const reader = new ArrayBufferReader(buffer);
    return reader.loop(() => {
      const type = reader.readUint8();
      switch (type) {
        case 1:
          return {
            type: 'joined',
            startingX: reader.readInt32(),
            startingY: reader.readInt32(),
            yourTeamId: reader.readString(),
          };
        case 2:
          return {
            type: 'game-data',
            gameWidth: reader.readUint32(),
            gameHeight: reader.readUint32(),
            teams: reader.loop(() => ({
              teamId: reader.readString(),
              color: reader.readString(),
            })),
            swarms: reader.loop(() => ({
              teamId: reader.readString(),
              swarmId: reader.readInt32(),
              dotCount: reader.readUint16(),
              x: reader.readInt32(),
              y: reader.readInt32(),
              headingX: reader.readOptionalInt32(),
              headingY: reader.readOptionalInt32(),
              ownerEmitterId: reader.readOptionalInt32(),
            })),
            emitters: reader.loop(() =>
              reader.switch<1 | 2, GameConfigEmitter>({
                1: () => ({
                  type: 'dot',
                  teamId: reader.readString(),
                  emitterId: reader.readInt32(),
                  x: reader.readInt32(),
                  y: reader.readInt32(),
                  power: reader.readUint8(),
                }),
                2: () => {
                  return {
                    type: 'dead',
                    emitterId: reader.readInt32(),
                    x: reader.readInt32(),
                    y: reader.readInt32(),
                    power: reader.readUint8(),
                    life: reader.readUint16(),
                    duration: reader.readUint16(),
                  };
                },
              })
            ),
          };
        case 3:
          return {
            type: 'new-emitter',
            x: reader.readInt32(),
            y: reader.readInt32(),
            power: reader.readUint8(),
            emitterId: reader.readInt32(),
            teamId: reader.readString(),
          };
        case 4:
          return {
            type: 'dead',
          };
        case 5:
          return {
            type: 'new-dead-emitter',
            x: reader.readInt32(),
            y: reader.readInt32(),
            power: reader.readUint8(),
            emitterId: reader.readInt32(),
            duration: reader.readUint16(),
            life: reader.readUint16(),
          };
        case 6:
          return {
            type: 'set-dead-emitter-life',
            emitterId: reader.readInt32(),
            life: reader.readInt16(),
          };
        case 7:
          return {
            type: 'remove-swarm',
            swarmId: reader.readInt32(),
          };
        case 8:
          return {
            type: 'kill-emitter',
            emitterId: reader.readInt32(),
          };
        case 9:
          return {
            type: 'kill-emitter',
            emitterId: reader.readInt32(),
          };
        case 10:
          return {
            type: 'augment-dot-count',
            swarmId: reader.readInt32(),
            dotCount: reader.readInt16(),
          };
        case 11: {
          return {
            type: 'set-team-data',
            teams: reader.loop(() => ({
              teamId: reader.readString(),
              color: reader.readString(),
            })),
          };
        }
        case 12:
          return {
            type: 'new-swarm',
            swarmId: reader.readInt32(),
            x: reader.readInt32(),
            y: reader.readInt32(),
            teamId: reader.readString(),
            ownerEmitterId: reader.readOptionalInt32(),
          };
        case 13:
          return {
            type: 'set-swarm-heading',
            swarmId: reader.readInt32(),
            x: reader.readInt32(),
            y: reader.readInt32(),
          };
        case 14:
          return {
            type: 'set-dead-emitter-duration',
            emitterId: reader.readInt32(),
            duration: reader.readInt16(),
          };
        default:
          throw new Error('Missing buffer enum');
      }
    });
  }
}
