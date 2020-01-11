import {Manager, Pan, Pinch, Press, Swipe, Tap} from 'hammerjs';
import {GameConfig} from '../../../common/src/models/gameConfig';
import {ClientToServerMessage, ServerToClientMessage} from '../../../common/src/models/messages';
import {MathUtils} from '../../../common/src/utils/mathUtils';
import {unreachable} from '../../../common/src/utils/unreachable';
import {uuid} from '../../../common/src/utils/uuid';
import {ClientSocket} from '../clientSocket';
import {CanvasUtils} from '../utils/canvasUtils';
import {ClientDeadEmitter} from './clientDeadEmitter';
import {ClientDotEmitter} from './clientDotEmitter';
import {ClientDotSwarm} from './clientDotSwarm';
import {ClientEmitter} from './clientEmitter';
import {GameView} from './gameView';

export class ClientGame {
  emitters: ClientEmitter[] = [];
  swarms: ClientDotSwarm[] = [];
  myTeamId?: string;
  teams: {teamId: string; color: string}[] = [];
  connectionId: string;
  protected socket: ClientSocket;
  protected isDead: boolean = false;

  constructor(private options: {onDied: () => void; onDisconnect: () => void}) {
    this.connectionId = uuid();
    let time = +new Date();
    let paused = 0;
    setInterval(() => {
      const now = +new Date();
      const duration = now - time;
      if (duration > 900 || duration < 4) {
        paused++;
      } else {
        if (paused > 3) {
          paused = 0;
          this.sendMessageToServer({
            type: 'resync',
          });
        }
      }
      this.tick(duration);
      time = +new Date();
    }, 1000 / 60);

    this.socket = new ClientSocket();
    this.socket.connect({
      onOpen: () => {
        this.sendMessageToServer({type: 'join'});
      },
      onDisconnect: () => {
        options.onDisconnect();
      },

      onMessage: messages => {
        this.processMessages(messages);
      },
    });
  }

  rejoin() {
    this.isDead = false;
    this.emitters.length = 0;
    this.swarms.length = 0;
    this.sendMessageToServer({type: 'join'});
  }

  sendMessageToServer(message: ClientToServerMessage) {
    this.socket.sendMessage(message);
  }

  fillGameData(gameConfig: GameConfig) {
    this.teams = gameConfig.teams;
    this.emitters = [];
    this.swarms = [];
    for (const emitter of gameConfig.emitters) {
      switch (emitter.type) {
        case 'dot':
          this.addNewEmitter(emitter.emitterId, emitter.x, emitter.y, emitter.power, emitter.teamId);
          break;
        case 'dead':
          this.addNewDeadEmitter(emitter.emitterId, emitter.x, emitter.y, emitter.power);
          break;
        default:
          unreachable(emitter);
          break;
      }
    }
    for (const swarm of gameConfig.swarms) {
      const s = this.addNewSwarm(swarm.swarmId, swarm.x, swarm.y, swarm.ownerEmitterId, swarm.teamId);
      s.augmentDotCount(swarm.dotCount);
      if (swarm.headingX !== undefined && swarm.headingY !== undefined) {
        s.setHeading(swarm.headingX, swarm.headingY);
      }
    }
  }

  processMessages(messages: ServerToClientMessage[]) {
    for (const message of messages) {
      switch (message.type) {
        case 'joined':
          this.myTeamId = message.yourTeamId;
          break;
        case 'game-data':
          console.log('got gamedata');
          this.fillGameData(message);
          break;
        case 'new-emitter':
          this.addNewEmitter(message.emitterId, message.x, message.y, message.power, message.teamId);
          break;
        case 'new-dead-emitter':
          this.addNewDeadEmitter(message.emitterId, message.x, message.y, message.power);
          break;
        case 'set-dead-emitter-life':
          {
            const emitter = this.emitters.find(a => a.emitterId === message.emitterId);
            if (emitter && emitter instanceof ClientDeadEmitter) {
              emitter.setLife(message.life);
            }
          }
          break;
        case 'set-dead-emitter-duration':
          {
            const emitter = this.emitters.find(a => a.emitterId === message.emitterId);
            if (emitter && emitter instanceof ClientDeadEmitter) {
              emitter.setDuration(message.duration);
            }
          }
          break;
        case 'remove-swarm':
          this.removeSwarm(message.swarmId);
          break;
        case 'kill-emitter':
          this.killEmitter(message.emitterId);
          break;
        case 'remove-emitter':
          this.removeEmitter(message.emitterId);
          break;
        case 'augment-dot-count':
          {
            const swarm = this.swarms.find(a => a.swarmId === message.swarmId);
            if (swarm) {
              swarm.augmentDotCount(message.dotCount);
            }
          }
          break;
        case 'new-swarm':
          this.addNewSwarm(message.swarmId, message.x, message.y, message.ownerEmitterId, message.teamId);
          break;
        case 'set-swarm-heading':
          {
            const swarm = this.swarms.find(a => a.swarmId === message.swarmId);
            if (swarm) {
              swarm.setHeading(message.x, message.y);
            }
          }
          break;
        case 'set-team-data':
          {
            this.teams = message.teams;
          }
          break;
        case 'dead':
          {
            this.isDead = true;
            this.options.onDied();
          }
          break;
        default:
          unreachable(message);
          break;
      }
    }
  }

  tick(duration: number) {
    if (!this.myTeamId) {
      return;
    }
    for (const emitter of this.emitters) {
      emitter.tick();
    }
    for (const swarm of this.swarms) {
      swarm.tick(duration);
    }
  }

  addNewEmitter(emitterId: number, x: number, y: number, power: number, teamId: string) {
    const dotEmitter = new ClientDotEmitter(this, x, y, power, emitterId, teamId);
    this.emitters.push(dotEmitter);
    return dotEmitter;
  }

  addNewSwarm(swarmId: number, x: number, y: number, ownerEmitterId: number | undefined, teamId: string) {
    const dotSwarm = new ClientDotSwarm(this, swarmId, x, y, ownerEmitterId, teamId);
    this.swarms.push(dotSwarm);
    return dotSwarm;
  }

  addNewDeadEmitter(emitterId: number, x: number, y: number, power: number) {
    this.emitters.push(new ClientDeadEmitter(this, x, y, power, emitterId));
  }

  removeSwarm(swarmId: number) {
    const index = this.swarms.findIndex(a => a.swarmId === swarmId);
    if (index === -1) {
      throw new Error('Bunko remove swarm');
    }
    this.swarms.splice(index, 1);
  }

  killEmitter(emitterId: number) {
    const emitterIndex = this.emitters.findIndex(a => a.emitterId === emitterId)!;
    if (emitterIndex === -1) {
      // debugger;
      throw new Error('Bunko kill emitter');
    }
    this.emitters.splice(emitterIndex, 1);
  }

  removeEmitter(emitterId: number) {
    const emitterIndex = this.emitters.findIndex(a => a.emitterId === emitterId)!;
    if (emitterIndex === -1) {
      // debugger;
      throw new Error('Bunko remove emitter');
    }
    this.emitters.splice(emitterIndex, 1);
  }
}
