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
import {ClientGame} from './clientGame';
import {GameView} from './gameView';

export class ClientGameUI extends ClientGame {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private startDragging: {x: number; y: number} | null = null;
  private currentDragging: {x: number; y: number} | null = null;
  view: GameView;

  constructor(options: {onDied: () => void; onDisconnect: () => void}) {
    super(options);
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d')!;
    this.view = new GameView(this.canvas);

    const manager = new Manager(this.canvas);
    manager.add(new Press({time: 0}));
    manager.add(new Tap({event: 'doubletap', taps: 2, interval: 500})).recognizeWith(manager.get('press'));
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
        this.dragMove(
          this.view.viewBox.x + this.view.transformPoint(e.center.x),
          this.view.viewBox.y + this.view.transformPoint(e.center.y)
        );
      } else {
        this.view.setPosition(
          startViewX + (startX - this.view.transformPoint(e.center.x)),
          startViewY + (startY - this.view.transformPoint(e.center.y))
        );
      }
    });

    manager.on('panstart', e => {
      if (doubleTap) {
        this.startDragDown(
          this.view.viewBox.x + this.view.transformPoint(e.center.x),
          this.view.viewBox.y + this.view.transformPoint(e.center.y)
        );
      } else {
        swipeVelocity.x = swipeVelocity.y = 0;
        startX = this.view.transformPoint(e.center.x);
        startY = this.view.transformPoint(e.center.y);
        startViewX = this.view.viewBox.x;
        startViewY = this.view.viewBox.y;
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

      const x = this.view.viewBox.x + this.view.transformPoint(e.center.x);
      const y = this.view.viewBox.y + this.view.transformPoint(e.center.y);

      for (const emitter of this.emitters) {
        if (MathUtils.inCircle(x, y, emitter.x, emitter.y, emitter.radius)) {
          if (selected) {
          } else {
            let foundSwarm = this.swarms.find(a => a.ownerEmitterId === emitter.emitterId);
            if (foundSwarm) {
              for (const dot of foundSwarm.dots) {
                dot.selected = true;
              }
              return;
            }
          }
        }
      }

      if (selected) {
        this.sendMove(
          x,
          y,
          this.swarms
            .filter(a => a.dots.some(d => d.selected))
            .map(swarm => {
              const selectedDots = MathUtils.sumC(swarm.dots, a => (a.selected ? 1 : 0));
              const percent = selectedDots / swarm.dots.length;

              return {
                swarmId: swarm.swarmId,
                percent,
              };
            })
        );
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

    const requestNextFrame = () => {
      requestAnimationFrame(() => {
        this.draw();
        requestNextFrame();
      });
    };
    requestNextFrame();
  }

  processMessages(messages: ServerToClientMessage[]) {
    super.processMessages(messages);
    for (const message of messages) {
      switch (message.type) {
        case 'joined':
          this.view.moveToPoint(message.startingX, message.startingY);
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

    const outerBox = this.view.outerViewBox;
    const box = this.view.viewBox;
    context.save();
    context.fillStyle = 'white';
    context.scale(this.view.scale, this.view.scale);
    context.translate(-box.x, -box.y);

    const dragRect = this.dragRect();

    for (const emitter of this.emitters) {
      if (!MathUtils.overlapSquare(emitter, outerBox)) {
        continue;
      }
      emitter.draw(context);
    }
    for (const swarm of this.swarms) {
      if (!MathUtils.overlapSquare(swarm, outerBox)) {
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

  fillGameData(gameConfig: GameConfig) {
    super.fillGameData(gameConfig);
    this.view.gameWidth = gameConfig.gameWidth;
    this.view.gameHeight = gameConfig.gameHeight;
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
}
