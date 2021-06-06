import {GameConstants} from '../../../common/src/game/gameConstants';
import {ClientToServerMessage, ServerToClientMessage} from '../../../common/src/models/messages';
import {ColorUtils} from '../../../common/src/utils/colorUtils';
import {MathUtils} from '../../../common/src/utils/mathUtils';
import {unreachable} from '../../../common/src/utils/unreachable';
import {Utils} from '../../../common/src/utils/utils';
import {nextId, uuid} from '../../../common/src/utils/uuid';
import {RBush} from '../rbush';
import {IServerSocket, ServerSocket} from '../serverSocket';
import {ServerDeadEmitter} from './serverDeadEmitter';
import {ServerDotEmitter} from './serverDotEmitter';
import {ServerDotSwarm} from './serverDotSwarm';
import {ServerEmitter} from './serverEmitter';
import {switchServerEmitter} from './utils';

export class ServerGame {
  emitters: ServerEmitter[] = [];
  swarms: ServerDotSwarm[] = [];
  gameWidth: number = 0;
  gameHeight: number = 0;

  teams: {connectionId: string; teamId: string; color: string}[] = [];
  swarmBush: RBush<ServerDotSwarm>;
  emitterBush: RBush<ServerEmitter>;

  constructor(private serverSocket: IServerSocket) {
    this.swarmBush = new RBush();
    this.emitterBush = new RBush();

    serverSocket.start(
      (connectionId) => {},
      (connectionId) => {
        this.clientLeave(connectionId);
      },
      (connectionId, message) => {
        this.processMessage(connectionId, message);
      }
    );
  }

  init() {
    this.gameHeight = this.gameWidth = GameConstants.gameSize;
    for (let i = 0; i < GameConstants.numberOfDeadEmitters; i++) {
      const {x, y} = this.getSafePosition();
      this.addNewDeadEmitter(x, y, 2);
    }

    let serverTick = 0;
    let time = +new Date();
    let tickTime = 0;
    const processTick = () => {
      try {
        const now = +new Date();
        const duration = now - time;
        if (duration > 220) {
          console.log(duration);
        }
        time = +new Date();
        // console.time('server tick');
        const newTickTime = +new Date();
        this.serverTick(++serverTick, duration, tickTime);
        tickTime = +new Date() - newTickTime;
        // console.timeEnd('server tick');
        // console.time('gc');
        // global.gc();
        // console.timeEnd('gc');
        setTimeout(() => {
          processTick();
        }, Math.max(Math.min(200, 200 - tickTime), 1));
      } catch (ex) {
        console.error(ex);
      }
    };
    setTimeout(() => {
      processTick();
    }, 1000 / 5);
  }

  getSafePosition() {
    while (true) {
      const x = Math.round(MathUtils.randomPad(this.gameWidth, 0.05));
      const y = Math.round(MathUtils.randomPad(this.gameHeight, 0.05));
      if (this.isSafePosition(x, y, 300)) {
        return {x, y};
      }
    }
  }

  clientLeave(connectionId: string) {
    const client = this.teams.find((c) => c.connectionId === connectionId);
    if (!client) {
      return;
    }
    this.teams.splice(this.teams.indexOf(client), 1);
    for (let i = this.swarms.length - 1; i >= 0; i--) {
      const swarm = this.swarms[i];
      if (swarm.teamId === client.teamId) {
        this.removeSwarm(swarm.swarmId);
      }
    }
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const emitter = this.emitters[i];
      if (emitter instanceof ServerDotEmitter && emitter.teamId === client.teamId) {
        this.removeEmitter(emitter.emitterId);
        if (!emitter.isRootEmitter) {
          this.addNewDeadEmitter(emitter.x, emitter.y, emitter.power);
        }
      }
    }
    this.sendTeams();
  }

  clientJoin(connectionId: string) {
    const teamId = uuid();
    const color = ColorUtils.randomColor();

    const {x: startingX, y: startingY} = this.getSafePosition();

    this.teams.push({teamId, connectionId, color});
    this.sendMessageToClient(connectionId, {type: 'joined', yourTeamId: teamId, startingX, startingY});

    this.sendGameData(connectionId);

    const emitter = this.addNewEmitter(startingX, startingY, 3, teamId, true);
    this.addNewSwarm(
      startingX,
      startingY,
      GameConstants.debug ? GameConstants.emitterDotCap : 110,
      emitter.emitterId,
      teamId
    );
    this.sendTeams();
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

  serverTick(tickIndex: number, duration: number, tickTime: number) {
    console.log(
      `tick: ${tickIndex}, Teams: ${this.teams.length}, Messages:${this.queuedMessages.length}, Swarms: ${this.swarms.length}, Emitters: ${this.emitters.length}, Duration: ${tickTime}`
    );

    const time = +new Date();
    let stopped = false;
    for (let i = 0; i < this.queuedMessages.length; i++) {
      if (time + 500 < +new Date()) {
        console.log('stopped');
        stopped = true;
        this.queuedMessages.splice(0, i);
        break;
      }
      const q = this.queuedMessages[i];
      switch (q.message.type) {
        case 'join':
          this.clientJoin(q.connectionId);
          break;
        case 'move-dots':
          const client = this.teams.find((a) => a.connectionId === q.connectionId);
          if (!client) {
            continue;
          }
          this.moveDots(q.message.x, q.message.y, client.teamId, q.message.swarms);
          break;
        case 'resync':
          this.sendGameData(q.connectionId);
          break;
        default:
          unreachable(q.message);
      }
    }
    if (!stopped) {
      this.queuedMessages.length = 0;
    } else {
      console.log(this.queuedMessages.length, 'remaining');
    }

    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const emitter = this.emitters[i];
      emitter.serverTick(tickIndex);
    }

    for (const swarm of this.swarms) {
      if (tickIndex % 5 === 0 && swarm.battledThisTick.length === 0) {
        if (!swarm.ownerEmitterId) {
          swarm.augmentDotCount(Math.min(-Math.ceil(swarm.dotCount * GameConstants.depleterRatio), 0));
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

    const deadTeams = Utils.toDictionary(this.teams, (a) => a.teamId);

    for (const swarm of this.swarms) {
      delete deadTeams[swarm.teamId];
    }
    for (const emitter of this.emitters) {
      if (emitter instanceof ServerDotEmitter) {
        delete deadTeams[emitter.teamId];
      }
    }
    for (const teamId of Object.keys(deadTeams)) {
      console.log('died', teamId);
      const team = this.teams.find((a) => a.teamId === teamId)!;
      this.sendMessageToClient(team.connectionId, {
        type: 'dead',
      });
      this.teams.splice(this.teams.indexOf(team), 1);
      const messages: ServerToClientMessage[] = [];
      for (const q of this.queuedMessagesToSend) {
        if (q.connectionId === null || q.connectionId === team.connectionId) {
          messages.push(q.message);
        }
      }
      if (messages.length > 0) {
        this.serverSocket.sendMessage(team.connectionId, messages);
      }
    }
    if (Object.keys(deadTeams).length > 0) {
      this.sendTeams();
    }

    for (const c of this.teams) {
      const messages: ServerToClientMessage[] = [];
      for (const q of this.queuedMessagesToSend) {
        if (q.connectionId === null || q.connectionId === c.connectionId) {
          messages.push(q.message);
        }
      }
      if (messages.length > 0) {
        this.serverSocket.sendMessage(c.connectionId, messages);
      }
    }
    this.queuedMessagesToSend.length = 0;
  }

  addNewEmitter(x: number, y: number, power: number, teamId: string, isRootEmitter: boolean) {
    if (GameConstants.debug) {
      power *= 5;
    }
    const emitterId = nextId();
    const dotEmitter = new ServerDotEmitter(this, x, y, power, emitterId, teamId, isRootEmitter);
    this.emitters.push(dotEmitter);
    this.sendMessageToClients({type: 'new-emitter', x, y, power, emitterId, teamId});
    return dotEmitter;
  }

  addNewSwarm(x: number, y: number, dotCount: number, ownerEmitterId: number | undefined, teamId: string) {
    const swarmId = nextId();
    const dotSwarm = new ServerDotSwarm(this, swarmId, x, y, ownerEmitterId, teamId);
    this.sendMessageToClients({type: 'new-swarm', x, y, swarmId, ownerEmitterId, teamId});
    dotSwarm.augmentDotCount(dotCount);
    this.swarms.push(dotSwarm);
    return dotSwarm;
  }

  addNewDeadEmitter(x: number, y: number, power: number) {
    const emitterId = nextId();
    const serverDeadEmitter = new ServerDeadEmitter(this, x, y, power, emitterId);
    this.emitters.push(serverDeadEmitter);
    this.sendMessageToClients({
      type: 'new-dead-emitter',
      x,
      y,
      power,
      emitterId,
      duration: serverDeadEmitter.duration,
      life: serverDeadEmitter.life,
    });
  }

  moveDots(x: number, y: number, teamId: string, swarms: {swarmId: number; percent: number}[]) {
    for (let i = this.swarms.length - 1; i >= 0; i--) {
      const swarm = this.swarms[i];
      const swarmMove = swarms.find((a) => swarm.swarmId === a.swarmId);
      if (teamId !== swarm.teamId || !swarmMove) {
        continue;
      }

      const percent = swarmMove.percent;

      if (percent === 1 && !swarm.ownerEmitterId) {
        swarm.setHeading(x, y);
      } else {
        const dotCount = Math.round(swarm.dotCount * percent);

        const newSwarm = this.addNewSwarm(swarm.x, swarm.y, dotCount, undefined, swarm.teamId);
        newSwarm.setHeading(x, y);
        swarm.augmentDotCount(-dotCount);
      }
    }
  }

  tryMergeSwarm(mergableSwarmId: number) {
    let mergableSwarm = this.swarms.find((a) => a.swarmId === mergableSwarmId)!;
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
            // console.log('try merge1', swarm.swarmId, mergableSwarm.dotCount);
            const remainder = swarm.augmentDotCount(mergableSwarm.dotCount);
            if (remainder > 0) {
              // console.log('try merge2', swarm.swarmId, mergableSwarm.dotCount);
              mergableSwarm.augmentDotCount(remainder - mergableSwarm.dotCount);
            } else {
              this.removeSwarm(mergableSwarm.swarmId);
              mergableSwarm = swarm;
              merged = true;
            }
          } else {
            if (swarm.ownerEmitterId) {
              continue;
            }
            // console.log('try merge3', mergableSwarm.swarmId, swarm.dotCount);
            const remainder = mergableSwarm.augmentDotCount(swarm.dotCount);
            if (remainder > 0) {
              // console.log('try merge4', swarm.swarmId, remainder - swarm.dotCount);
              swarm.augmentDotCount(remainder - swarm.dotCount);
            } else {
              this.removeSwarm(swarm.swarmId);
              merged = true;
            }
          }
          break;
        }
      }
      if (!merged) {
        break;
      }
    }
  }

  removeSwarm(swarmId: number) {
    const index = this.swarms.findIndex((a) => a.swarmId === swarmId);
    if (index === -1) {
      throw new Error('Bunko remove swarm');
    }

    this.swarms[index].remove();
    this.swarms.splice(index, 1);
    this.sendMessageToClients({
      type: 'remove-swarm',
      swarmId,
    });
  }

  killEmitter(emitterId: number) {
    const emitter = this.emitters.find((a) => a.emitterId === emitterId)!;
    if (!emitter) {
      // debugger;
      throw new Error('Bunko');
    }
    emitter.remove();
    this.emitters.splice(this.emitters.indexOf(emitter), 1);
    this.sendMessageToClients({
      type: 'kill-emitter',
      emitterId,
    });
    this.addNewDeadEmitter(emitter.x, emitter.y, emitter.power);
  }

  removeEmitter(emitterId: number) {
    const emitterIndex = this.emitters.findIndex((a) => a.emitterId === emitterId)!;
    if (emitterIndex === -1) {
      throw new Error('Bunko remove emitter');
    }
    this.emitters[emitterIndex].remove();
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

  private sendTeams() {
    this.sendMessageToClients({
      type: 'set-team-data',
      teams: this.teams.map((c) => ({
        teamId: c.teamId,
        color: c.color,
      })),
    });
  }

  private sendGameData(connectionId: string) {
    this.sendMessageToClient(connectionId, {
      type: 'game-data',
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      teams: this.teams.map((c) => ({
        teamId: c.teamId,
        color: c.color,
      })),
      emitters: this.emitters.map((a) =>
        switchServerEmitter(a, {
          dead: (e) => ({
            type: 'dead',
            life: e.life,
            duration: e.duration,
            emitterId: e.emitterId,
            x: e.x,
            y: e.y,
            power: e.power,
          }),
          dot: (e) => ({
            type: 'dot',
            teamId: e.teamId,
            emitterId: e.emitterId,
            x: e.x,
            y: e.y,
            power: e.power,
          }),
        })
      ),
      swarms: this.swarms.map((a) => ({
        teamId: a.teamId,
        ownerEmitterId: a.ownerEmitterId,
        x: a.x,
        y: a.y,
        swarmId: a.swarmId,
        dotCount: a.dotCount,
        headingX: a.move?.headingX,
        headingY: a.move?.headingY,
      })),
    });
  }
}
