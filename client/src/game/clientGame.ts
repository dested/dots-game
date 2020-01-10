import {Manager, Pan, Press, Swipe, Tap} from 'hammerjs';
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

  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private startDragging: {x: number; y: number} | null = null;
  private currentDragging: {x: number; y: number} | null = null;
  private view: GameView;
  connectionId: string;
  private socket: ClientSocket;
  private isDead: boolean = false;

  constructor(private options: {onDied: () => void}) {
    this.connectionId = uuid();

    this.canvas = document.getElementById('game') as HTMLCanvasElement;
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
        this.sendMessageToServer({
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

    let time = +new Date();
    setInterval(() => {
      const now = +new Date();
      this.tick(now - time);
      time = +new Date();
    }, 1000 / 60);

    const requestNextFrame = () => {
      requestAnimationFrame(() => {
        this.draw();
        requestNextFrame();
      });
    };
    requestNextFrame();

    this.socket = new ClientSocket();
    this.socket.connect(
      () => {
        this.sendMessageToServer({type: 'join'});
      },
      messages => {
        this.processMessages(messages);
      }
    );
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

    const dragRect = this.dragRect();

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

      swarm.draw(context, dragRect);
    }

    if (!this.isDead && dragRect) {
      context.save();
      context.strokeStyle = 'white';
      context.lineWidth = 1;
      context.fillStyle = 'rgba(204,111,2,0.4)';
      CanvasUtils.rect(context, dragRect.x, dragRect.y, dragRect.width, dragRect.height);
      context.stroke();
      context.fill();
      context.restore();
    }
    context.restore();
  }

  dragRect() {
    if (this.startDragging && this.currentDragging) {
      return {
        x: this.startDragging.x < this.currentDragging.x ? this.startDragging.x : this.currentDragging.x,
        y: this.startDragging.y < this.currentDragging.y ? this.startDragging.y : this.currentDragging.y,
        width: Math.abs(this.currentDragging.x - this.startDragging.x),
        height: Math.abs(this.currentDragging.y - this.startDragging.y),
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

  addNewEmitter(emitterId: number, x: number, y: number, power: number, teamId: string) {
    const dotEmitter = new ClientDotEmitter(this, x, y, power, emitterId, teamId);
    this.emitters.push(dotEmitter);
    return dotEmitter;
  }

  addNewSwarm(swarmId: number, x: number, y: number, ownerEmitterId: number | null, teamId: string) {
    const dotSwarm = new ClientDotSwarm(this, swarmId, x, y, ownerEmitterId, teamId);
    this.swarms.push(dotSwarm);
    return dotSwarm;
  }

  addNewDeadEmitter(emitterId: number, x: number, y: number, power: number) {
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

    const dragRect = this.dragRect()!;
    for (const swarm of this.swarms) {
      if (swarm.teamId !== this.myTeamId) {
        continue;
      }
      for (const dot of swarm.dots) {
        if (
          MathUtils.inSquare(swarm.x + dot.x, swarm.y + dot.y, dragRect.x, dragRect.y, dragRect.width, dragRect.height)
        ) {
          dot.selected = true;
        }
      }
    }

    this.startDragging = null;
    this.currentDragging = null;
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
