import {sendMessagesToClient} from '../../../client/src/utils/fake-socket';
import {ClientToServerMessage, ServerToClientMessage} from '../../../common/src/models/messages';
import {ColorUtils} from '../../../common/src/utils/colorUtils';
import {MathUtils} from '../../../common/src/utils/mathUtils';
import {unreachable} from '../../../common/src/utils/unreachable';
import {uuid} from '../../../common/src/utils/uuid';
import {ServerDeadEmitter} from './serverDeadEmitter';
import {ServerDotEmitter} from './serverDotEmitter';
import {ServerDotSwarm} from './serverDotSwarm';
import {ServerEmitter} from './serverEmitter';

export class ServerGame {
  emitters: ServerEmitter[] = [];
  swarms: ServerDotSwarm[] = [];
  gameWidth: number = 0;
  gameHeight: number = 0;

  clients: {connectionId: string; teamId: string; color: string}[] = [];

  constructor() {
    let serverTick = 0;
    setInterval(() => {
      this.serverTick(++serverTick, 1000 / 5);
    }, 1000 / 5);
  }

  init() {
    this.gameHeight = this.gameWidth = 1000;
    for (let i = 0; i < 10; i++) {
      const {x, y} = this.getSafePosition();
      this.addNewDeadEmitter(x, y, 2);
    }
  }

  getSafePosition() {
    while (true) {
      const x = Math.round(MathUtils.randomPad(this.gameWidth, 0.05));
      const y = Math.round(MathUtils.randomPad(this.gameHeight, 0.05));
      if (this.isSafePosition(x, y, 200)) {
        return {x, y};
      }
    }
  }

  clientJoin(connectionId: string) {
    const teamId = uuid();
    const color = ColorUtils.randomColor();

    const {x: startingX, y: startingY} = this.getSafePosition();

    this.clients.push({teamId, connectionId, color});
    this.sendMessageToClient(connectionId, {type: 'joined', yourTeamId: teamId, startingX, startingY});
    this.sendMessageToClient(connectionId, {
      type: 'game-data',
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      teams: this.clients.map(c => ({
        teamId: c.teamId,
        color: c.color,
      })),
      emitters: this.emitters.map(a =>
        this.switchServerEmitter(a, {
          dead: e => ({
            type: 'dead',
            life: e.life,
            emitterId: e.emitterId,
            x: e.x,
            y: e.y,
            power: e.power,
          }),
          dot: e => ({
            type: 'dot',
            teamId: e.teamId,
            emitterId: e.emitterId,
            x: e.x,
            y: e.y,
            power: e.power,
          }),
        })
      ),
      swarms: this.swarms.map(a => ({
        teamId: a.teamId,
        ownerEmitterId: a.ownerEmitterId,
        x: a.x,
        y: a.y,
        swarmId: a.swarmId,
        dotCount: a.dotCount,
      })),
    });

    const emitter = this.addNewEmitter(startingX, startingY, 2, teamId);
    this.addNewSwarm(startingX, startingY, 500, emitter.emitterId, teamId);
    this.sendMessageToClients({
      type: 'set-team-data',
      teams: this.clients.map(c => ({
        teamId: c.teamId,
        color: c.color,
      })),
    });
  }

  isSafePosition(x: number, y: number, distance: number) {
    const square = MathUtils.makeSquare(x - distance / 2, y - distance / 2, distance, distance);

    for (const emitter of this.emitters) {
      if (MathUtils.overlapSquare(emitter, square)) {
        return false;
      }
    }
    return true;
  }

  serverTick(tickIndex: number, duration: number) {
    for (const q of this.queuedMessages) {
      switch (q.message.type) {
        case 'join':
          this.clientJoin(q.connectionId);
          break;
        case 'move-dots':
          const client = this.clients.find(a => a.connectionId === q.connectionId);
          if (!client) {
            continue;
          }
          this.moveDots(q.message.x, q.message.y, client.teamId, q.message.swarms);
          break;
        default:
          unreachable(q.message);
      }
    }
    this.queuedMessages.length = 0;

    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const emitter = this.emitters[i];
      emitter.serverTick();
    }

    for (const swarm of this.swarms) {
      if (tickIndex % 5 === 0) {
        if (!swarm.ownerEmitterId) {
          swarm.augmentDotCount(
            -Math.max(swarm.depleter + Math.floor(swarm.dotCount / 300) + (swarm.move ? -1 : 1), 0)
          );
        }
      }
      swarm.battledThisTick.length = 0;
    }

    for (const swarm of this.swarms) {
      swarm.serverTick(duration);
    }

    for (let i = this.swarms.length - 1; i >= 0; i--) {
      const swarm = this.swarms[i];
      if (swarm.dotCount <= 0) {
        if (swarm.ownerEmitterId) {
          this.removeSwarm(swarm.swarmId);
          this.killEmitter(swarm.ownerEmitterId);
        } else {
          this.removeSwarm(swarm.swarmId);
        }
      }
    }

    const messages: ServerToClientMessage[] = [];
    for (const c of this.clients) {
      for (const q of this.queuedMessagesToSend) {
        if (q.connectionId === null || q.connectionId === c.connectionId) {
          messages.push(q.message);
        }
      }
      if (messages.length > 0) {
        sendMessagesToClient(c.connectionId, messages);
      }
      messages.length = 0;
    }
    this.queuedMessagesToSend.length = 0;
  }

  addNewEmitter(x: number, y: number, power: number, teamId: string) {
    const emitterId = uuid();
    const dotEmitter = new ServerDotEmitter(this, x, y, power, emitterId, teamId);
    this.emitters.push(dotEmitter);
    this.sendMessageToClients({type: 'new-emitter', x, y, power, emitterId, teamId});
    return dotEmitter;
  }

  addNewSwarm(x: number, y: number, dotCount: number, ownerEmitterId: string | null, teamId: string) {
    const swarmId = uuid();
    const dotSwarm = new ServerDotSwarm(this, swarmId, x, y, ownerEmitterId, teamId);
    this.sendMessageToClients({type: 'new-swarm', x, y, swarmId, ownerEmitterId, teamId});
    dotSwarm.augmentDotCount(dotCount);
    this.swarms.push(dotSwarm);
    return dotSwarm;
  }

  addNewDeadEmitter(x: number, y: number, power: number) {
    const emitterId = uuid();
    this.emitters.push(new ServerDeadEmitter(this, x, y, power, emitterId));
    this.sendMessageToClients({type: 'new-dead-emitter', x, y, power, emitterId});
  }

  moveDots(x: number, y: number, teamId: string, swarms: {swarmId: string; percent: number}[]) {
    for (let i = this.swarms.length - 1; i >= 0; i--) {
      const swarm = this.swarms[i];
      const swarmMove = swarms.find(a => swarm.swarmId === a.swarmId);
      if (teamId !== swarm.teamId || !swarmMove) {
        continue;
      }

      const percent = swarmMove.percent;

      if (percent === 1 && !swarm.ownerEmitterId) {
        swarm.setHeading(x, y);
      } else {
        const dotCount = Math.round(swarm.dotCount * percent);

        const newSwarm = this.addNewSwarm(swarm.x, swarm.y, dotCount, null, swarm.teamId);
        newSwarm.setHeading(x, y);
        swarm.augmentDotCount(-dotCount);
      }
    }
  }

  tryMergeSwarm(mergableSwarmId: string) {
    let mergableSwarm = this.swarms.find(a => a.swarmId === mergableSwarmId)!;
    while (true) {
      let merged = false;
      for (const swarm of this.swarms) {
        if (swarm.teamId !== mergableSwarm.teamId) {
          continue;
        }
        if (swarm === mergableSwarm || swarm.move) {
          continue;
        }
        if (MathUtils.overlapCircles(swarm, mergableSwarm, 0)) {
          if ((swarm.dotCount > mergableSwarm.dotCount || swarm.ownerEmitterId) && !mergableSwarm.ownerEmitterId) {
            swarm.augmentDotCount(mergableSwarm.dotCount);
            this.removeSwarm(mergableSwarm.swarmId);
            mergableSwarm = swarm;
          } else {
            if (swarm.ownerEmitterId) {
              continue;
            }
            mergableSwarm.augmentDotCount(swarm.dotCount);
            this.removeSwarm(swarm.swarmId);
          }
          merged = true;
          break;
        }
      }
      if (!merged) {
        break;
      }
    }
  }

  removeSwarm(swarmId: string) {
    const index = this.swarms.findIndex(a => a.swarmId === swarmId);
    if (index === -1) {
      throw new Error('Bunko remove swarm');
    }

    this.swarms.splice(index, 1);
    this.sendMessageToClients({
      type: 'remove-swarm',
      swarmId,
    });
  }

  killEmitter(emitterId: string) {
    const emitter = this.emitters.find(a => a.emitterId === emitterId)!;
    if (!emitter) {
      // debugger;
      throw new Error('Bunko');
    }
    this.emitters.splice(this.emitters.indexOf(emitter), 1);
    this.sendMessageToClients({
      type: 'kill-emitter',
      emitterId,
    });
    this.addNewDeadEmitter(emitter.x, emitter.y, emitter.power);
  }

  removeEmitter(emitterId: string) {
    const emitterIndex = this.emitters.findIndex(a => a.emitterId === emitterId)!;
    if (emitterIndex === -1) {
      throw new Error('Bunko remove emitter');
    }
    this.emitters.splice(emitterIndex, 1);
    this.sendMessageToClients({
      type: 'remove-emitter',
      emitterId,
    });
  }

  queuedMessages: {connectionId: string; message: ClientToServerMessage}[] = [];
  queuedMessagesToSend: {connectionId: string | null; message: ServerToClientMessage}[] = [];

  sendMessageToClient(connectionId: string, message: ServerToClientMessage) {
    this.queuedMessagesToSend.push({connectionId, message});
  }
  sendMessageToClients(message: ServerToClientMessage) {
    this.queuedMessagesToSend.push({connectionId: null, message});
  }

  processMessage(connectionId: string, message: ClientToServerMessage) {
    this.queuedMessages.push({connectionId, message});
  }

  private switchServerEmitter<T1, T2>(
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
}
