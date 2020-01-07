import {Manager, Pan, Press, Swipe, Tap} from 'hammerjs';
import React, {useEffect} from 'react';
import './App.css';

const clientGames: ClientGame[] = [];

const App: React.FC<{id: string; width: number; height: number}> = props => {
  useEffect(() => {
    clientGames.push(new ClientGame(props.id));
  }, []);
  return (
    <div className="App">
      <canvas id={'game' + props.id} width={props.width} height={props.height} />
    </div>
  );
};

export default App;

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
    const color = randomColor();

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

export class ClientGame {
  emitters: ClientEmitter[] = [];
  swarms: ClientDotSwarm[] = [];
  myTeamId?: string;
  teams: {teamId: string; color: string}[] = [];

  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private startDragging: {x: number; y: number} | null = null;
  private currentDragging: {x: number; y: number} | null = null;
  private view: GameView;
  connectionId: string;

  constructor(gameId: string) {
    this.connectionId = uuid();

    this.canvas = document.getElementById('game' + gameId) as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d')!;

    const manager = new Manager(this.canvas);
    manager.add(new Press({time: 0}));
    manager.add(new Tap({event: 'doubletap', taps: 2})).recognizeWith(manager.get('press'));
    manager
      .add(new Tap({taps: 1}))
      .requireFailure('doubletap')
      .recognizeWith(manager.get('press'));
    manager.add(new Pan({direction: Hammer.DIRECTION_ALL, threshold: 5}));
    manager.add(new Swipe()).recognizeWith(manager.get('pan'));

    // manager.add(swipe);
    let startX = 0;
    let startY = 0;
    let startViewX = 0;
    let startViewY = 0;
    const swipeVelocity = {x: 0, y: 0};

    this.view = new GameView(this.canvas);

    window.addEventListener(
      'resize',
      () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.view.setBounds(window.innerWidth, window.innerHeight);
        this.draw();
      },
      true
    );

    let lastPress: Date = new Date();
    let doubleTap = false;
    manager.on('press', e => {
      doubleTap = +new Date() - +lastPress < 200;
      lastPress = new Date();
    });
    manager.on('pressup', e => {
      doubleTap = false;
    });

    manager.on('panmove', e => {
      if (e.velocity === 0) {
        return;
      }
      if (doubleTap) {
        this.dragMove(this.view.x + e.center.x, this.view.y + e.center.y);
      } else {
        this.view.setPosition(startViewX + (startX - e.center.x), startViewY + (startY - e.center.y));
      }
    });

    manager.on('panstart', e => {
      if (doubleTap) {
        this.startDragDown(this.view.x + e.center.x, this.view.y + e.center.y);
      } else {
        swipeVelocity.x = swipeVelocity.y = 0;
        startX = e.center.x;
        startY = e.center.y;
        startViewX = this.view.x;
        startViewY = this.view.y;
      }
    });

    manager.on('panend', e => {
      if (doubleTap) {
        this.dragDone();
      }
    });

    manager.on('swipe', (ev: {velocityX: number; velocityY: number}) => {
      swipeVelocity.x = ev.velocityX * 10;
      swipeVelocity.y = ev.velocityY * 10;
    });

    manager.on('tap', e => {
      swipeVelocity.x = swipeVelocity.y = 0;

      let selected = false;
      for (const swarm of this.swarms) {
        for (const dot of swarm.dots) {
          if (dot.selected) {
            selected = true;
            break;
          }
        }
      }
      if (selected) {
        sendMessageToServer(this.connectionId, {
          type: 'move-dots',
          x: this.view.x + e.center.x,
          y: this.view.y + e.center.y,
          swarms: this.swarms
            .filter(a => a.dots.some(d => d.selected))
            .map(swarm => {
              const selectedDots = MathUtils.sumC(swarm.dots, a => (a.selected ? 1 : 0));
              const percent = selectedDots / swarm.dots.length;

              return {
                swarmId: swarm.swarmId,
                percent,
              };
            }),
        });
      }
      for (const swarm of this.swarms) {
        for (const dot of swarm.dots) {
          dot.selected = false;
        }
      }
    });

    manager.on('doubletap', e => {
      swipeVelocity.x = swipeVelocity.y = 0;
      for (const swarm of this.swarms) {
        for (const dot of swarm.dots) {
          dot.selected = false;
        }
      }
    });

    setInterval(() => {
      if (Math.abs(swipeVelocity.x) > 0) {
        const sign = MathUtils.mathSign(swipeVelocity.x);
        swipeVelocity.x += 0.7 * -sign;
        if (MathUtils.mathSign(swipeVelocity.x) !== sign) {
          swipeVelocity.x = 0;
        }
      }

      if (Math.abs(swipeVelocity.y) > 0) {
        const sign = MathUtils.mathSign(swipeVelocity.y);
        swipeVelocity.y += 0.7 * -sign;
        if (MathUtils.mathSign(swipeVelocity.y) !== sign) {
          swipeVelocity.y = 0;
        }
      }
      if (Math.abs(swipeVelocity.x) > 0 || Math.abs(swipeVelocity.y) > 0) {
        this.view.offsetPosition(-swipeVelocity.x, -swipeVelocity.y);
      }
    }, 1000 / 60);

    // this.context.globalAlpha = 0.7;

    setInterval(() => {
      this.tick(1000 / 60);
    }, 1000 / 60);

    const requestNextFrame = () => {
      requestAnimationFrame(() => {
        this.draw();
        requestNextFrame();
      });
    };
    requestNextFrame();

    setTimeout(() => {
      sendMessageToServer(this.connectionId, {
        type: 'join',
      });
    }, 1000 + Math.random() * 500);
  }

  fillGameData(gameConfig: GameConfig) {
    this.view.gameWidth = gameConfig.gameWidth;
    this.view.gameHeight = gameConfig.gameHeight;
    this.teams = gameConfig.teams;
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
    }
  }

  processMessages(messages: ServerToClientMessage[]) {
    for (const message of messages) {
      switch (message.type) {
        case 'joined':
          this.myTeamId = message.yourTeamId;
          this.view.moveToPoint(message.startingX, message.startingY);
          break;
        case 'game-data':
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
        default:
          unreachable(message);
          break;
      }
    }
  }

  draw() {
    const context = this.context;

    context.fillStyle = 'rgba(0,0,0,1)';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.myTeamId) {
      context.fillStyle = 'white';
      context.fillText('Connecting...', 100, 100);
      return;
    }

    const vBox = this.view.viewBox;

    context.save();
    context.translate(-this.view.x, -this.view.y);

    const dragEllipse = this.dragEllipse();

    for (const emitter of this.emitters) {
      if (!MathUtils.overlapSquare(emitter, vBox)) {
        continue;
      }
      emitter.draw(context);
    }
    for (const swarm of this.swarms) {
      if (!MathUtils.overlapSquare(swarm, vBox)) {
        continue;
      }

      swarm.draw(context, dragEllipse);
    }

    if (dragEllipse) {
      context.save();
      context.strokeStyle = 'white';
      context.lineWidth = 1;
      context.fillStyle = 'rgba(204,111,2,0.4)';
      CanvasUtils.ellipse(context, dragEllipse.x, dragEllipse.y, dragEllipse.radiusX, dragEllipse.radiusY);
      context.stroke();
      context.fill();
      context.restore();
    }
    context.restore();
  }

  dragEllipse() {
    if (this.startDragging && this.currentDragging) {
      return {
        x: this.startDragging.x + (this.currentDragging.x - this.startDragging.x) / 2,
        y: this.startDragging.y + (this.currentDragging.y - this.startDragging.y) / 2,
        radiusX: Math.abs((this.startDragging.x - this.currentDragging.x) / 2),
        radiusY: Math.abs((this.startDragging.y - this.currentDragging.y) / 2),
      };
    }
    return undefined;
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

  addNewEmitter(emitterId: string, x: number, y: number, power: number, teamId: string) {
    const dotEmitter = new ClientDotEmitter(this, x, y, power, emitterId, teamId);
    this.emitters.push(dotEmitter);
    return dotEmitter;
  }

  addNewSwarm(swarmId: string, x: number, y: number, ownerEmitterId: string | null, teamId: string) {
    const dotSwarm = new ClientDotSwarm(this, swarmId, x, y, ownerEmitterId, teamId);
    this.swarms.push(dotSwarm);
    return dotSwarm;
  }

  addNewDeadEmitter(emitterId: string, x: number, y: number, power: number) {
    this.emitters.push(new ClientDeadEmitter(this, x, y, power, emitterId));
  }

  startDragDown(clientX: number, clientY: number) {
    for (const swarm of this.swarms) {
      for (const dot of swarm.dots) {
        dot.selected = false;
      }
    }
    this.startDragging = {x: clientX, y: clientY};
    this.currentDragging = {x: clientX, y: clientY};
  }

  dragMove(clientX: number, clientY: number) {
    if (!this.currentDragging) {
      return;
    }
    this.currentDragging.x = clientX;
    this.currentDragging.y = clientY;
  }
  dragDone() {
    if (!this.currentDragging || !this.startDragging) {
      return;
    }

    const dragEllipse = this.dragEllipse()!;
    for (const swarm of this.swarms) {
      if (swarm.teamId !== this.myTeamId) {
        continue;
      }
      for (const dot of swarm.dots) {
        if (
          MathUtils.inEllipse(
            dragEllipse.x,
            dragEllipse.y,
            dragEllipse.radiusX,
            dragEllipse.radiusY,
            swarm.x + dot.x,
            swarm.y + dot.y
          )
        ) {
          dot.selected = true;
        }
      }
    }

    this.startDragging = null;
    this.currentDragging = null;
  }

  removeSwarm(swarmId: string) {
    const index = this.swarms.findIndex(a => a.swarmId === swarmId);
    if (index === -1) {
      throw new Error('Bunko remove swarm');
    }
    this.swarms.splice(index, 1);
  }

  killEmitter(emitterId: string) {
    const emitterIndex = this.emitters.findIndex(a => a.emitterId === emitterId)!;
    if (emitterIndex === -1) {
      // debugger;
      throw new Error('Bunko kill emitter');
    }
    this.emitters.splice(emitterIndex, 1);
  }

  removeEmitter(emitterId: string) {
    const emitterIndex = this.emitters.findIndex(a => a.emitterId === emitterId)!;
    if (emitterIndex === -1) {
      // debugger;
      throw new Error('Bunko remove emitter');
    }
    this.emitters.splice(emitterIndex, 1);
  }
}

export interface Emitter {
  x: number;
  y: number;
  power: number;
  radius: number;
  emitterId: string;
}

export interface ClientEmitter extends Emitter {
  tick(): void;
  draw(context: CanvasRenderingContext2D): void;
}

export interface ServerEmitter extends Emitter {
  serverTick(): void;
}

export class ClientDotEmitter implements ClientEmitter {
  constructor(
    public game: ClientGame,
    public x: number,
    public y: number,
    public power: number,
    public emitterId: string,
    public teamId: string
  ) {}

  tick() {}

  get radius() {
    return this.game.swarms.find(a => a.ownerEmitterId === this.emitterId)!.radius;
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    const team = this.game.teams.find(t => t.teamId === this.teamId);
    if (!team) {
      // debugger;
      throw new Error('bunkop team' + this.teamId);
    }
    context.fillStyle = shade(team.color, 20) + 'aa';
    const swarm = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!swarm) {
      // debugger;
      throw new Error('bunkop');
    }

    CanvasUtils.circle(context, this.x, this.y, Math.max(swarm.radius, Constants.emitterRadius));
    context.stroke();
    context.fill();
    context.restore();
  }
}

export class ServerDotEmitter implements ServerEmitter {
  constructor(
    public game: ServerGame,
    public x: number,
    public y: number,
    public power: number,
    public emitterId: string,
    public teamId: string
  ) {}

  get radius() {
    return this.game.swarms.find(a => a.ownerEmitterId === this.emitterId)!.radius;
  }

  serverTick() {
    const find = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!find) {
      // debugger;
      throw new Error('bnunko');
    }
    find.augmentDotCount(Math.min(this.power, Constants.maxDotsPerSwarm - find.dotCount));
  }
}

export class BaseDeadEmitter implements Emitter {
  constructor(public x: number, public y: number, public power: number, public emitterId: string) {}
  get radius() {
    return Constants.emitterRadius;
  }
}

export class ServerDeadEmitter extends BaseDeadEmitter implements ServerEmitter {
  duration = Math.round(Math.random() * Constants.deadEmitterStartingDuration);
  life = Constants.deadEmitterStartingLife;

  constructor(public game: ServerGame, x: number, y: number, power: number, emitterId: string) {
    super(x, y, power, emitterId);
  }

  serverTick() {
    if (this.life < Constants.deadEmitterStartingLife) {
      this.setLife(this.life + 1);
    }
    this.setDuration(this.duration - 1);
    this.duration--;
    if (this.duration <= 0) {
      this.game.removeEmitter(this.emitterId);
      const {x, y} = this.game.getSafePosition();
      this.game.addNewDeadEmitter(x, y, this.power);
    }
  }

  attack(amount: number) {
    this.setLife(this.life - amount);
    this.setDuration(Constants.deadEmitterStartingDuration - amount);
    if (this.life <= 0) {
      return 'dead';
    }
    return 'alive';
  }

  setLife(life: number) {
    this.life = life;
    this.game.sendMessageToClients({
      type: 'set-dead-emitter-life',
      emitterId: this.emitterId,
      life,
    });
  }
  setDuration(duration: number) {
    this.duration = duration;
  }
}

export class ClientDeadEmitter extends BaseDeadEmitter implements ClientEmitter {
  life: number = Constants.deadEmitterStartingLife;
  constructor(public game: ClientGame, x: number, y: number, power: number, emitterId: string) {
    super(x, y, power, emitterId);
  }

  tick() {}

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.fillStyle = shade('#d4d4d4', 50) + 'aa';

    CanvasUtils.circle(
      context,
      this.x,
      this.y,
      Constants.emitterRadius * (this.life / Constants.deadEmitterStartingLife)
    );
    context.stroke();
    context.fill();
    context.restore();
  }

  setLife(life: number) {
    this.life = life;
  }
}

export class BaseDotSwarm {
  dotCount: number = 0;
  move?: MoveDirection;

  constructor(
    public swarmId: string,
    public x: number,
    public y: number,
    public ownerEmitterId: string | null,
    public teamId: string
  ) {}

  get radius(): number {
    return Math.min((this.ownerEmitterId ? Constants.emitterRadius : 20) + this.dotCount / 5, 80);
  }

  randomPosition() {
    const a = Math.random() * 2 * Math.PI;
    const r = this.radius * Math.sqrt(Math.random());

    const x = r * Math.cos(a);
    const y = r * Math.sin(a);

    return {x, y};
  }

  setHeading(x: number, y: number) {
    const distance = MathUtils.distance(x, y, this.x, this.y);
    const directionX = (x - this.x) / distance;
    const directionY = (y - this.y) / distance;
    this.move = {
      startingX: this.x,
      startingY: this.y,
      headingX: x,
      headingY: y,
      distance,
      directionX,
      directionY,
      speed: 50,
    };
  }
}

export class ClientDotSwarm extends BaseDotSwarm {
  dots: {
    selected: boolean;
    x: number;
    y: number;
    heading: Heading;
    value: number;
  }[] = [];

  constructor(
    public game: ClientGame,
    swarmId: string,
    x: number,
    y: number,
    ownerEmitterId: string | null,
    teamId: string
  ) {
    super(swarmId, x, y, ownerEmitterId, teamId);
  }

  augmentDotCount(dotCount: number) {
    if (dotCount === 0) {
      return;
    }
    this.dotCount = this.dotCount + dotCount;

    if (this.dotCount <= 0) {
      this.dots.length = 0;
      return;
    }

    if (dotCount < 0) {
      if (this.dotCount < Constants.maxRenderedDotsPerSwarm) {
        this.dots.splice(this.dotCount, this.dots.length - this.dotCount);
      }
    }

    for (let i = this.dots.length; i < Math.min(Constants.maxRenderedDotsPerSwarm, this.dotCount); i++) {
      const {x, y} = this.randomPosition();
      const {x: headingX, y: headingY} = this.randomPosition();
      this.dots.push({
        x,
        y,
        heading: {
          startingX: x,
          startingY: y,
          headingX,
          headingY,
          timing: Math.random(),
          timingAddition: 0.04,
        },
        selected: false,
        value: 1,
      });
    }

    if (this.dots.length > Constants.maxRenderedDotsPerSwarm) {
      this.dots.splice(Constants.maxRenderedDotsPerSwarm, this.dots.length);
    }

    const numItems = this.dotCount;
    const itemsPerBucket = Math.floor(numItems / Math.min(this.dots.length, Constants.maxRenderedDotsPerSwarm));
    const remainingItems = Math.floor(numItems % Math.min(this.dots.length, Constants.maxRenderedDotsPerSwarm));
    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];
      const extra = i < remainingItems ? 1 : 0;
      dot.value = itemsPerBucket + extra;
    }
    this.dots = this.dots.filter(a => a.value > 0);
    if (this.dotCount !== MathUtils.sum(this.dots.map(a => a.value))) {
      throw new Error(`miscount ${this.dotCount} ${MathUtils.sum(this.dots.map(a => a.value))}`);
    }
  }

  tick(duration: number) {
    if (this.move) {
      this.x = this.x + this.move.directionX * (this.move.speed * (duration / 1000));
      this.y = this.y + this.move.directionY * (this.move.speed * (duration / 1000));
      if (MathUtils.distance(this.x, this.y, this.move.startingX, this.move.startingY) > this.move.distance) {
        this.x = this.move.headingX;
        this.y = this.move.headingY;
        this.move = undefined;
      }
    }

    for (const dot of this.dots) {
      dot.x = MathUtils.headingX(dot.heading);
      dot.y = MathUtils.headingY(dot.heading);
      dot.heading.timing += dot.heading.timingAddition;

      if (dot.heading.timing >= 1) {
        dot.x = dot.heading.headingX;
        dot.y = dot.heading.headingY;

        const {x: headingX, y: headingY} = this.randomPosition();
        dot.heading = {
          startingX: dot.x,
          startingY: dot.y,
          headingX,
          headingY,
          timing: 0,
          timingAddition: 0.04,
        };
      }
    }
  }

  draw(context: CanvasRenderingContext2D, dragEllipse?: {x: number; y: number; radiusX: number; radiusY: number}) {
    if (false && !this.ownerEmitterId) {
      context.save();
      context.fillStyle = 'rgba(160,109,175,0.7)';
      CanvasUtils.circle(context, this.x, this.y, this.radius);
      context.fill();
      context.restore();
    }
    context.save();
    context.translate(this.x, this.y);
    for (const dot of this.dots) {
      context.save();
      if (
        dot.selected ||
        (dragEllipse &&
          this.teamId === this.game.myTeamId &&
          MathUtils.inEllipse(
            dragEllipse.x,
            dragEllipse.y,
            dragEllipse.radiusX,
            dragEllipse.radiusY,
            this.x + dot.x,
            this.y + dot.y
          ))
      ) {
        context.fillStyle = 'white';
      } else {
        context.strokeStyle = 'white';
        context.fillStyle = shade(this.game.teams.find(t => t.teamId === this.teamId)!.color, 10);
      }
      context.lineWidth = 1;
      CanvasUtils.circle(context, dot.x, dot.y, 1 + dot.value);
      context.stroke();
      context.fill();
      context.restore();
    }
    // this.context.fillText(this.dotCount + ' ' + MathUtils.sum(this.dots.map(a => a.value)), 0, 0);
    context.restore();
  }
}

export class ServerDotSwarm extends BaseDotSwarm {
  constructor(
    public game: ServerGame,
    swarmId: string,
    x: number,
    y: number,
    ownerEmitterId: string | null,
    teamId: string
  ) {
    super(swarmId, x, y, ownerEmitterId, teamId);
  }

  depleter: number = 1;
  battledThisTick: string[] = [];

  augmentDotCount(dotCount: number) {
    if (dotCount === 0) {
      return;
    }
    this.dotCount = this.dotCount + dotCount;
    this.game.sendMessageToClients({
      type: 'augment-dot-count',
      swarmId: this.swarmId,
      dotCount,
    });
  }

  serverTick(duration: number) {
    if (this.move) {
      this.x = this.x + this.move.directionX * (this.move.speed * (duration / 1000));
      this.y = this.y + this.move.directionY * (this.move.speed * (duration / 1000));

      if (MathUtils.distance(this.x, this.y, this.move.startingX, this.move.startingY) > this.move.distance) {
        this.x = this.move.headingX;
        this.y = this.move.headingY;
        this.move = undefined;
        this.game.tryMergeSwarm(this.swarmId);
      }
    }

    for (const swarm of this.game.swarms) {
      if (this.dotCount <= 0 || swarm.dotCount <= 0) {
        continue;
      }
      if (swarm.teamId !== this.teamId) {
        if (swarm.battledThisTick.includes(this.swarmId)) {
          continue;
        }
        if (MathUtils.overlapCircles(this, swarm)) {
          const power = Math.min(
            Math.max(Math.ceil(this.dotCount / 9), Math.ceil(swarm.dotCount / 9)),
            swarm.dotCount,
            this.dotCount
          );
          this.augmentDotCount(-power);
          swarm.augmentDotCount(-power);
          swarm.battledThisTick.push(this.swarmId);
          this.battledThisTick.push(swarm.swarmId);
        }
      }
    }

    for (let i = this.game.emitters.length - 1; i >= 0; i--) {
      const emitter = this.game.emitters[i];
      if (!(emitter instanceof ServerDeadEmitter)) {
        continue;
      }

      if (MathUtils.overlapCircles(this, emitter)) {
        const power = Math.min(Math.max(Math.ceil(this.dotCount / 9)), this.dotCount, emitter.life);
        this.augmentDotCount(-power);
        const attackResult = emitter.attack(power);

        if (attackResult === 'dead') {
          this.game.removeEmitter(emitter.emitterId);
          const newEmitter = this.game.addNewEmitter(emitter.x, emitter.y, emitter.power, this.teamId);
          this.game.addNewSwarm(newEmitter.x, newEmitter.y, this.dotCount, newEmitter.emitterId, this.teamId);
          this.augmentDotCount(-this.dotCount);
        }
      }
    }
  }

  setHeading(x: number, y: number) {
    super.setHeading(x, y);
    this.game.sendMessageToClients({
      type: 'set-swarm-heading',
      swarmId: this.swarmId,
      x,
      y,
    });
  }
}

export class Constants {
  static emitterRadius = 30;
  static maxRenderedDotsPerSwarm = 50;
  static maxDotsPerSwarm = 500;
  static deadEmitterStartingDuration = 1000;
  static deadEmitterStartingLife = 100;
}

export class MathUtils {
  static randomItem<T>(item: T[]): T {
    return item[Math.floor(Math.random() * item.length)];
  }
  static inEllipse(x: number, y: number, radiusX: number, radiusY: number, pointX: number, pointY: number) {
    return Math.pow(pointX - x, 2) / Math.pow(radiusX, 2) + Math.pow(pointY - y, 2) / Math.pow(radiusY, 2) <= 1;
  }

  static headingX(heading: Heading) {
    const p = AnimationUtils.easings.linear(heading.timing);
    return heading.startingX + (heading.headingX - heading.startingX) * p;
  }
  static headingY(heading: Heading) {
    const p = AnimationUtils.easings.linear(heading.timing);
    return heading.startingY + (heading.headingY - heading.startingY) * p;
  }

  static randomPad(len: number, paddingPercent: number) {
    const padding = len * paddingPercent;
    return Math.random() * (len - padding * 2) + padding;
  }

  static overlapCircles(
    left: {x: number; y: number; radius: number},
    right: {x: number; y: number; radius: number},
    additionalRadius: number = 0
  ) {
    const distSq = (left.x - right.x) * (left.x - right.x) + (left.y - right.y) * (left.y - right.y);
    const radSumSq =
      (left.radius + additionalRadius + (right.radius + additionalRadius)) *
      (left.radius + additionalRadius + (right.radius + additionalRadius));
    return distSq === radSumSq || distSq <= radSumSq;
  }
  static overlapSquare(point: {x: number; y: number}, box: {x: number; y: number; width: number; height: number}) {
    return point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;
  }

  static distance(x1: number, y1: number, x2: number, y2: number) {
    const a = x1 - x2;
    const b = y1 - y2;

    return Math.sqrt(a * a + b * b);
  }

  static sum(numbers: number[]) {
    let sum = 0;
    for (const n of numbers) {
      sum += n;
    }
    return sum;
  }
  static sumC<T>(numbers: T[], callback: (t: T) => number) {
    let sum = 0;
    for (const n of numbers) {
      sum += callback(n);
    }
    return sum;
  }

  static mathSign(f: number) {
    if (f < 0) {
      return -1;
    } else if (f > 0) {
      return 1;
    }
    return 0;
  }

  static makeSquare(x: number, y: number, width: number, height: number) {
    return {x, y, width, height};
  }
}

export class GameView {
  x: number;
  y: number;
  width: number;
  height: number;

  scale: number;

  gameWidth: number = 0;
  gameHeight: number = 0;

  constructor(private canvas: HTMLCanvasElement) {
    if (localStorage.getItem('view-x' + canvas.id)) {
      this.x = parseInt(localStorage.getItem('view-x' + canvas.id)!);
    } else {
      this.x = 0;
    }
    if (localStorage.getItem('view-y' + canvas.id)) {
      this.y = parseInt(localStorage.getItem('view-y' + canvas.id)!);
    } else {
      this.y = 0;
    }

    this.width = canvas.width;
    this.height = canvas.height;
    this.scale = 1;
  }

  get xSlop(): number {
    return this.x - this.viewSlop;
  }

  get ySlop(): number {
    return this.y - this.viewSlop;
  }

  get widthSlop(): number {
    return this.width + this.viewSlop * 2;
  }

  get heightSlop(): number {
    return this.height + this.viewSlop * 2;
  }

  get viewBox() {
    const vx = Math.round(this.xSlop);
    const vy = Math.round(this.ySlop);
    const vwidth = Math.round(this.widthSlop);
    const vheight = Math.round(this.heightSlop);
    return {
      x: vx,
      y: vy,
      width: vwidth,
      height: vheight,
    };
  }

  private viewSlop = 100;

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.clamp();

    localStorage.setItem('view-x' + this.canvas.id, this.x.toString());
    localStorage.setItem('view-y' + this.canvas.id, this.y.toString());
  }

  offsetPosition(x: number, y: number) {
    this.setPosition(this.x + x, this.y + y);
  }

  private clamp() {
    const gutter = 0.2;
    const reverseGutter = 1 - gutter;

    if (this.x < -this.width * gutter) {
      this.x = -this.width * gutter;
    }
    if (this.y < -this.height * gutter) {
      this.y = -this.height * gutter;
    }

    if (this.x > this.gameWidth - this.width * reverseGutter) {
      this.x = this.gameWidth - this.width * reverseGutter;
    }

    if (this.y > this.gameHeight - this.height * reverseGutter) {
      this.y = this.gameHeight - this.height * reverseGutter;
    }
  }

  setBounds(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.clamp();
  }

  zoom(scale: number) {
    AnimationUtils.start({
      start: this.scale,
      finish: scale,
      duration: 250,
      easing: AnimationUtils.easings.easeInCubic,
      callback: c => {
        this.scale = c;
      },
    });
  }

  moveToPoint(x: number, y: number) {
    const startX = this.x;
    const endX = this.x + (x - (this.x + this.width / 2));

    const startY = this.y;
    const endY = this.y + (y - (this.y + this.height / 2));

    AnimationUtils.start({
      start: 0,
      finish: 1,
      duration: 250,
      easing: AnimationUtils.easings.easeInCubic,
      callback: c => {
        this.setPosition(AnimationUtils.lerp(startX, endX, c), AnimationUtils.lerp(startY, endY, c));
      },
    });
    AnimationUtils.start({
      start: this.scale,
      finish: 2,
      duration: 250,
      easing: AnimationUtils.easings.easeInCubic,
      callback: c => {
        this.scale = c;
      },
    });
  }
}

export class CanvasUtils {
  static circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
  }
  static ellipse(context: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number) {
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, 0, 0, 2 * Math.PI);
  }
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function randomColor() {
  return HSLToRGB(360 * Math.random(), 25 + 70 * Math.random(), 85 + 10 * Math.random());
}
function HSLToRGB(h: number, s: number, l: number) {
  // Must be fractions of 1
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  function rgbToHex(rgb: number) {
    let hex = Number(rgb).toString(16);
    if (hex.length < 2) {
      hex = '0' + hex;
    }
    return hex;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  const s1 = `#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`;

  return s1;
}

interface Heading {
  startingX: number;
  startingY: number;
  headingX: number;
  headingY: number;
  timing: number;
  timingAddition: number;
}
interface MoveDirection {
  startingX: number;
  startingY: number;
  headingX: number;
  headingY: number;
  distance: number;
  directionX: number;
  directionY: number;
  speed: number;
}

const shade = (col: string, amt: number) => {
  const n = +('0x' + col.replace('#', '')) + amt * 0x010101;
  const s = n.toString(16);
  const s1 = s.padStart(6, '0');
  return '#' + s1;
};

export class AnimationUtils {
  static animations: AnimationInstance[] = [];

  static stopAnimations() {
    for (const animation of AnimationUtils.animations) {
      animation.stop = true;
    }
    AnimationUtils.animations.length = 0;
  }

  static lerp(start: number, end: number, amt: number): number {
    return start + (end - start) * amt;
  }

  static start(options: {
    start: number;
    finish: number;
    callback: (current: number) => void;
    duration: number;
    easing: (percent: number) => number;
    complete?: (finish: number) => void;
  }): void {
    if (options.start === options.finish) {
      options.callback(options.finish);
      options.complete && options.complete(options.finish);
      return;
    }

    const startTime = +new Date();
    const animationInstance = new AnimationInstance();
    AnimationUtils.animations.push(animationInstance);

    function next() {
      if (animationInstance.stop) {
        options.callback(options.finish);
        options.complete && options.complete(options.finish);
        return;
      }
      if (animationInstance.cancel) {
        return;
      }
      const curTime = +new Date();
      const percent = Math.max(Math.min((curTime - startTime) / options.duration, 1), 0);
      const j = options.easing(percent);
      options.callback(options.start + (options.finish - options.start) * j);
      if (percent >= 1) {
        AnimationUtils.animations.splice(AnimationUtils.animations.indexOf(animationInstance), 1);
        options.complete && options.complete(options.finish);
      } else {
        requestAnimationFrame(next);
      }
    }

    requestAnimationFrame(next);
  }

  static lightenDarkenColor(col: string, amount: number) {
    let usePound = false;
    if (col[0] === '#') {
      col = col.slice(1);
      usePound = true;
    }
    const num = (parseInt as any)(col, 16);
    let r = (num >> 16) + amount;

    if (r > 255) {
      r = 255;
    } else if (r < 0) {
      r = 0;
    }

    let b = ((num >> 8) & 0x00ff) + amount;

    if (b > 255) {
      b = 255;
    } else if (b < 0) {
      b = 0;
    }

    let g = (num & 0x0000ff) + amount;

    if (g > 255) {
      g = 255;
    } else if (g < 0) {
      g = 0;
    }

    return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
  }

  static easings = {
    // no easing, no acceleration
    linear(t: number): number {
      return t;
    },
    // accelerating from zero velocity
    easeInQuad(t: number): number {
      return t * t;
    },
    // decelerating to zero velocity
    easeOutQuad(t: number): number {
      return t * (2 - t);
    },
    // acceleration until halfway, then deceleration
    easeInOutQuad(t: number): number {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    // accelerating from zero velocity
    easeInCubic(t: number): number {
      return t * t * t;
    },
    // decelerating to zero velocity
    easeOutCubic(t: number): number {
      return --t * t * t + 1;
    },
    // acceleration until halfway, then deceleration
    easeInOutCubic(t: number): number {
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },
    // accelerating from zero velocity
    easeInQuart(t: number): number {
      return t * t * t * t;
    },
    // decelerating to zero velocity
    easeOutQuart(t: number): number {
      return 1 - --t * t * t * t;
    },
    // acceleration until halfway, then deceleration
    easeInOutQuart(t: number): number {
      return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
    },
    // accelerating from zero velocity
    easeInQuint(t: number): number {
      return t * t * t * t * t;
    },
    // decelerating to zero velocity
    easeOutQuint(t: number): number {
      return 1 + --t * t * t * t * t;
    },
    // acceleration until halfway, then deceleration
    easeInOutQuint(t: number): number {
      return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
    },
  };
}

export class AnimationInstance {
  stop: boolean = false;
  cancel: boolean = false;
}

const serverGame = new ServerGame();
serverGame.init();

function sendMessageToServer(connectionId: string, message: ClientToServerMessage) {
  serverGame.processMessage(connectionId, message);
  // console.log('to server', JSON.stringify(message));
}
function sendMessagesToClient(connectionId: string, messages: ServerToClientMessage[]) {
  clientGames.find(a => a.connectionId === connectionId)!.processMessages(messages);
  // console.log('to client', JSON.stringify(messages));
}

type ClientToServerMessage =
  | {
      type: 'join';
    }
  | {
      type: 'move-dots';
      x: number;
      y: number;
      swarms: {swarmId: string; percent: number}[];
    };

type ServerToClientMessage =
  | {
      type: 'joined';
      yourTeamId: string;
      startingX: number;
      startingY: number;
    }
  | ({
      type: 'game-data';
    } & GameConfig)
  | {type: 'new-emitter'; x: number; y: number; power: number; emitterId: string; teamId: string}
  | {type: 'new-dead-emitter'; x: number; y: number; power: number; emitterId: string}
  | {type: 'set-dead-emitter-life'; life: number; emitterId: string}
  | {type: 'remove-swarm'; swarmId: string}
  | {type: 'kill-emitter'; emitterId: string}
  | {type: 'remove-emitter'; emitterId: string}
  | {type: 'augment-dot-count'; swarmId: string; dotCount: number}
  | {type: 'set-team-data'; teams: {teamId: string; color: string}[]}
  | {
      type: 'new-swarm';
      x: number;
      y: number;
      swarmId: string;
      ownerEmitterId: string | null;
      teamId: string;
    }
  | {
      type: 'set-swarm-heading';
      swarmId: string;
      x: number;
      y: number;
    };

function unreachable(t: never) {}

interface GameConfig {
  emitters: (
    | {
        type: 'dot';
        teamId: string;
        x: number;
        y: number;
        emitterId: string;
        power: number;
      }
    | {
        type: 'dead';
        x: number;
        y: number;
        emitterId: string;
        life: number;
        power: number;
      }
  )[];
  swarms: {teamId: string; x: number; y: number; ownerEmitterId: string | null; swarmId: string; dotCount: number}[];
  teams: {teamId: string; color: string}[];
  gameWidth: number;
  gameHeight: number;
}
