import {Manager, Pan, Press, Swipe, Tap} from 'hammerjs';
import React, {useEffect} from 'react';
import './App.css';

const App: React.FC = () => {
  let game: Game;
  useEffect(() => {
    game = new Game({
      gameWidth: 10000,
      gameHeight: 10000,
    });
  }, []);

  /*



  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.shiftKey) {
      game.moveDots(clientX, clientY);
      return;
  }
*/

  return (
    <div className="App">
      <canvas id={'game'} width={window.innerWidth} height={window.innerHeight} />
    </div>
  );
};

export default App;

interface GameConfig {
  gameWidth: number;
  gameHeight: number;
}

export class Game {
  emitters: Emitter[] = [];
  swarms: DotSwarm[] = [];
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private startDragging: {x: number; y: number} | null = null;
  private currentDragging: {x: number; y: number} | null = null;
  private view: GameView;

  constructor(gameConfig: GameConfig) {
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

    this.view = new GameView(this.canvas, gameConfig.gameWidth, gameConfig.gameHeight);

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
        this.moveDots(this.view.x + e.center.x, this.view.y + e.center.y);
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

    /*
    for (const emitter of gameConfig.emitters) {
    }
*/

    // this.context.globalAlpha = 0.7;
    for (let i = 0; i < 10; i++) {
      const emitter = this.addNewEmitter(
        (Math.random() * window.innerWidth) | 0,
        (Math.random() * window.innerHeight) | 0,
        MathUtils.randomItem([1, 2]),
        MathUtils.randomItem(['a', 'b', 'c'])
      );
      this.addNewSwarm(emitter.x, emitter.y, 5, emitter.emitterId, emitter.teamId);
    }

    let serverTick = 0;
    setInterval(() => {
      this.serverTick(++serverTick);
    }, 200);

    const requestNextFrame = () => {
      requestAnimationFrame(() => {
        this.tick();
        this.draw();
        requestNextFrame();
      });
    };
    requestNextFrame();
  }

  serverTick(tickIndex: number) {
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
      swarm.serverTick();
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
  }

  draw() {
    const context = this.context;

    const vBox = this.view.viewBox;

    context.save();
    context.fillStyle = 'rgba(0,0,0,1)';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

      if (false && !swarm.ownerEmitterId) {
        context.save();
        context.fillStyle = 'rgba(160,109,175,0.7)';
        CanvasUtils.circle(context, swarm.x, swarm.y, swarm.radius);
        context.fill();
        context.restore();
      }
      context.save();
      context.translate(swarm.x, swarm.y);
      for (const dot of swarm.dots) {
        context.save();
        if (
          dot.selected ||
          (dragEllipse &&
            swarm.teamId === myTeamId &&
            MathUtils.inEllipse(
              dragEllipse.x,
              dragEllipse.y,
              dragEllipse.radiusX,
              dragEllipse.radiusY,
              swarm.x + dot.x,
              swarm.y + dot.y
            ))
        ) {
          context.fillStyle = 'white';
        } else {
          context.strokeStyle = 'white';
          context.fillStyle = shade(colors[swarm.teamId], 10);
        }
        context.lineWidth = 1;
        CanvasUtils.circle(context, dot.x, dot.y, 1 + dot.value);
        context.stroke();
        context.fill();
        context.restore();
      }
      // this.context.fillText(swarm.dotCount + ' ' + MathUtils.sum(swarm.dots.map(a => a.value)), 0, 0);
      context.restore();
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

    this.context.fillStyle = 'white';
    this.context.fillText(this.view.x + ' ' + this.view.y, 100, 100);
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
  }

  tick() {
    for (const emitter of this.emitters) {
      emitter.tick();
    }
    for (const swarm of this.swarms) {
      swarm.tick();
    }
  }

  addNewEmitter(x: number, y: number, power: number, teamId: string) {
    const emitterId = uuid();

    const dotEmitter = new DotEmitter(this, x, y, power, emitterId, teamId);
    this.emitters.push(dotEmitter);

    return dotEmitter;
  }

  addNewSwarm(x: number, y: number, dotCount: number, emitterId: string | null, teamId: string) {
    const swarmId = uuid();
    const dotSwarm = new DotSwarm(this, swarmId, x, y, emitterId, teamId);
    dotSwarm.augmentDotCount(dotCount);
    this.swarms.push(dotSwarm);
    return swarmId;
  }

  addNewDeadEmitter(x: number, y: number, power: number) {
    const emitterId = uuid();
    this.emitters.push(new DeadEmitter(this, x, y, power, emitterId));
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
      if (swarm.teamId !== myTeamId) {
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

  moveDots(x: number, y: number) {
    for (let i = this.swarms.length - 1; i >= 0; i--) {
      const swarm = this.swarms[i];
      const selectedDots = swarm.dots.filter(a => a.selected);
      if (selectedDots.length === 0) {
        continue;
      }
      const percent = selectedDots.length / swarm.dots.length;

      if (selectedDots.length === swarm.dots.length && !swarm.ownerEmitterId) {
        swarm.setHeading(x, y);
      } else {
        const dotCount = MathUtils.sum(selectedDots.map(a => a.value));

        const newSwarm = new DotSwarm(this, uuid(), swarm.x, swarm.y, null, swarm.teamId);
        newSwarm.augmentDotCount(dotCount);
        newSwarm.setHeading(x, y);
        swarm.augmentDotCount(-dotCount);
        this.swarms.push(newSwarm);
      }
      for (const selectedDot of selectedDots) {
        selectedDot.selected = false;
      }
    }
  }

  tryMergeSwarm(mergableSwarmId: string): 'removed' | 'not-removed' {
    let mergableSwarm = this.swarms.find(a => a.swarmId === mergableSwarmId)!;
    let removed: 'removed' | 'not-removed' = 'not-removed';
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
            this.swarms.splice(this.swarms.indexOf(mergableSwarm), 1);
            mergableSwarm = swarm;
            removed = 'removed';
          } else {
            if (swarm.ownerEmitterId) {
              continue;
            }
            mergableSwarm.augmentDotCount(swarm.dotCount);
            this.swarms.splice(this.swarms.indexOf(swarm), 1);
          }
          merged = true;
          break;
        }
      }
      if (!merged) {
        break;
      }
    }
    return removed;
  }

  removeSwarm(swarmId: string) {
    this.swarms.splice(
      this.swarms.findIndex(a => a.swarmId === swarmId),
      1
    );
  }

  killEmitter(emitterId: string) {
    const emitter = this.emitters.find(a => a.emitterId === emitterId)!;
    if (!emitter) {
      // debugger;
      throw new Error('Bunko');
    }
    this.emitters.splice(this.emitters.indexOf(emitter), 1);
    this.addNewDeadEmitter(emitter.x, emitter.y, emitter.power);
  }

  removeEmitter(emitterId: string) {
    const emitter = this.emitters.find(a => a.emitterId === emitterId)!;
    this.emitters.splice(this.emitters.indexOf(emitter), 1);
  }
}

export interface Emitter {
  game: Game;
  x: number;
  y: number;
  power: number;
  radius: number;
  emitterId: string;
  tick(): void;
  serverTick(): void;

  draw(context: CanvasRenderingContext2D): void;
}

export class DotEmitter implements Emitter {
  constructor(
    public game: Game,
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

  serverTick() {
    const find = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!find) {
      // debugger;
      throw new Error('bnunko');
    }
    find.augmentDotCount(Math.min(this.power, Constants.maxDotsPerSwarm - find.dotCount));
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.fillStyle = shade(colors[this.teamId], 50) + 'aa';
    const swarm = this.game.swarms.find(a => a.ownerEmitterId === this.emitterId);
    if (!swarm) {
      debugger;
      throw new Error('bunkop');
    }

    CanvasUtils.circle(context, this.x, this.y, Math.max(swarm.radius, Constants.emitterRadius));
    context.stroke();
    context.fill();
    context.restore();
  }
}

export class DeadEmitter implements Emitter {
  duration = Constants.deadEmitterStartingDuration;
  life = Constants.deadEmitterStartingLife;

  constructor(public game: Game, public x: number, public y: number, public power: number, public emitterId: string) {}

  tick() {}

  get radius() {
    return Constants.emitterRadius;
  }

  serverTick() {
    if (this.life < Constants.deadEmitterStartingLife) {
      this.life++;
    }
    this.duration--;
    if (this.duration <= 0) {
      this.game.removeEmitter(this.emitterId);
    }
  }

  attack(amount: number) {
    this.life -= amount;
    this.duration = Constants.deadEmitterStartingDuration;
    if (this.life <= 0) {
      return 'dead';
    }
    return 'alive';
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.fillStyle = shade(colors.NONE, 50) + 'aa';

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
}

export class DotSwarm {
  dotCount: number = 0;
  dots: {
    selected: boolean;
    x: number;
    y: number;
    heading: Heading;
    value: number;
  }[] = [];
  move?: MoveDirection;

  depleter: number = 1;
  battledThisTick: string[] = [];

  constructor(
    public game: Game,
    public swarmId: string,
    public x: number,
    public y: number,
    public ownerEmitterId: string | null,
    public teamId: string
  ) {}

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

  tick() {
    if (this.move) {
      this.x += this.move.directionX * this.move.speed * 0.016;
      this.y += this.move.directionY * this.move.speed * 0.016;
      if (MathUtils.distance(this.x, this.y, this.move.startingX, this.move.startingY) > this.move.distance) {
        this.x = this.move.headingX;
        this.y = this.move.headingY;
        this.move = undefined;
        this.game.tryMergeSwarm(this.swarmId); // todo this needs to be inservertick
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
      speed: 100,
    };
  }

  serverTick() {
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
      if (!(emitter instanceof DeadEmitter)) {
        continue;
      }

      if (MathUtils.overlapCircles(this, emitter)) {
        const power = Math.min(Math.max(Math.ceil(this.dotCount / 9)), this.dotCount, emitter.life);
        this.augmentDotCount(-power);
        const attackResult = emitter.attack(power);

        if (attackResult === 'dead') {
          this.game.removeEmitter(emitter.emitterId);
          const newEmitter = this.game.addNewEmitter(emitter.x, emitter.y, emitter.power, this.teamId);
          this.game.addNewSwarm(newEmitter.x, newEmitter.y, this.dotCount, emitter.emitterId, this.teamId);
          this.augmentDotCount(-this.dotCount);
        }
      }
    }
  }
}

export class Constants {
  static emitterRadius = 30;
  static maxRenderedDotsPerSwarm = 50;
  static maxDotsPerSwarm = 500;
  static deadEmitterStartingDuration = 100;
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

  static mathSign(f: number) {
    if (f < 0) {
      return -1;
    } else if (f > 0) {
      return 1;
    }
    return 0;
  }
}

export class GameView {
  x: number;
  y: number;
  width: number;
  height: number;

  scale: number;

  constructor(private canvas: HTMLCanvasElement, private gameWidth: number, private gameHeight: number) {
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

const colors: {[key: string]: string} = {
  a: '#ba0506',
  b: '#18ba00',
  c: '#0016ba',
  NONE: '#d4d4d4',
};

const myTeamId = 'a';

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
