import React, {useEffect} from 'react';
import './App.css';

const App: React.FC = () => {
  let game: Game;
  useEffect(() => {
    game = new Game();
  }, []);

  let dragging = false;
  function pointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const {clientX, clientY} = e;
    if (e.ctrlKey) {
      game.addNewEmitter(clientX, clientY, 40, myTeamId);
    } else {
      game.dragDone();
    }
    dragging = false;
  }

  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const {clientX, clientY} = e;
    if (e.ctrlKey) {
      return;
    }
    if (e.shiftKey) {
      game.moveDots(clientX, clientY);
      return;
    }
    game.startDragDown(clientX, clientY);
    dragging = true;
  }

  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) {
      return;
    }
    const {clientX, clientY} = e;
    if (e.ctrlKey) {
      return;
    }
    game.dragMove(clientX, clientY);
  }

  return (
    <div className="App">
      <canvas
        id={'game'}
        width={window.innerWidth}
        height={window.innerHeight}
        onPointerUp={pointerUp}
        onPointerMove={pointerMove}
        onPointerDown={pointerDown}
      />
    </div>
  );
};

export default App;

export class Game {
  emitters: Emitter[] = [];
  swarms: DotSwarm[] = [];
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private startDragging: {x: number; y: number} | null = null;
  private currentDragging: {x: number; y: number} | null = null;
  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d')!;
    this.context.globalAlpha = 0.7;
    for (let i = 0; i < 10; i++) {
      this.addNewEmitter(
        (Math.random() * window.innerWidth) | 0,
        (Math.random() * window.innerHeight) | 0,
        MathUtils.randomItem([1, 2]),
        MathUtils.randomItem(['a', 'b', 'c'])
      );
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
    for (const emitter of this.emitters) {
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
  }

  draw() {
    this.context.fillStyle = 'rgba(0,0,0,.2)';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const dragEllipse = this.dragEllipse();

    for (const emitter of this.emitters) {
      emitter.draw(this.context);
    }
    for (const swarm of this.swarms) {
      if (false && !swarm.ownerEmitterId) {
        this.context.save();
        this.context.fillStyle = 'rgba(160,109,175,0.7)';
        CanvasUtils.circle(this.context, swarm.x, swarm.y, swarm.radius);
        this.context.fill();
        this.context.restore();
      }
      this.context.save();
      this.context.translate(swarm.x, swarm.y);
      for (const dot of swarm.dots) {
        this.context.save();
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
          this.context.fillStyle = 'white';
        } else {
          this.context.strokeStyle = 'white';
          this.context.fillStyle = shade(colors[swarm.teamId], 10);
        }
        this.context.lineWidth = 1;
        CanvasUtils.circle(this.context, dot.x, dot.y, 1 + dot.value);
        this.context.stroke();
        this.context.fill();
        this.context.restore();
      }
      // this.context.fillText(swarm.dotCount + ' ' + MathUtils.sum(swarm.dots.map(a => a.value)), 0, 0);
      this.context.restore();
    }

    if (dragEllipse) {
      this.context.save();
      this.context.strokeStyle = 'white';
      this.context.lineWidth = 1;
      this.context.fillStyle = 'rgba(204,111,2,0.4)';
      CanvasUtils.ellipse(this.context, dragEllipse.x, dragEllipse.y, dragEllipse.radiusX, dragEllipse.radiusY);
      this.context.stroke();
      this.context.fill();
      this.context.restore();
    }
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
    const swarmId = uuid();
    const emitterId = uuid();

    this.emitters.push(new DotEmitter(this, x, y, power, emitterId, teamId));

    const dotSwarm = new DotSwarm(this, swarmId, x, y, emitterId, teamId);
    dotSwarm.augmentDotCount(5);

    this.swarms.push(dotSwarm);
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
    if (find.dotCount + this.power < Constants.maxDotsPerSwarm) {
      find.augmentDotCount(this.power);
    } else {
      find.augmentDotCount(Constants.maxDotsPerSwarm - find.dotCount);
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.fillStyle = shade(colors[this.teamId], 50) + 'aa';
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
      if (this.ownerEmitterId) {
        this.dots.length = 0;
      } else {
        this.game.removeSwarm(this.swarmId);
      }
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
    for (let i = this.game.swarms.length - 1; i >= 0; i--) {
      const swarm = this.game.swarms[i];
      if (swarm.teamId !== this.teamId) {
        if (swarm.battledThisTick.includes(this.swarmId)) {
          continue;
        }
        if (MathUtils.overlapCircles(this, swarm)) {
          if (swarm.dotCount > 0) {
            const power = Math.min(
              Math.max(Math.ceil(this.dotCount / 9), Math.ceil(swarm.dotCount / 9)),
              swarm.dotCount,
              this.dotCount
            );
            this.augmentDotCount(-power);
            swarm.augmentDotCount(-power);
            swarm.battledThisTick.push(this.swarmId);
            this.battledThisTick.push(swarm.swarmId);
            if (swarm.dotCount <= 0 && swarm.ownerEmitterId) {
              this.game.removeSwarm(swarm.swarmId);
              this.game.killEmitter(swarm.ownerEmitterId);
            }
            if (this.dotCount <= 0 && this.ownerEmitterId) {
              this.game.removeSwarm(this.swarmId);
              this.game.killEmitter(this.ownerEmitterId);
            }
          } else {
            if (swarm.ownerEmitterId) {
              this.game.removeSwarm(swarm.swarmId);
              this.game.killEmitter(swarm.ownerEmitterId);
            }
          }
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
          this.game.addNewEmitter(emitter.x, emitter.y, emitter.power, this.teamId);
          if (this.game.tryMergeSwarm(this.swarmId) === 'removed') {
            break;
          }
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
    const p = EasingFunctions.linear(heading.timing);
    return heading.startingX + (heading.headingX - heading.startingX) * p;
  }
  static headingY(heading: Heading) {
    const p = EasingFunctions.linear(heading.timing);
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

const EasingFunctions = {
  // no easing, no acceleration
  linear: (t: number) => t,
  // accelerating from zero velocity
  easeInQuad: (t: number) => t * t,
  // decelerating to zero velocity
  easeOutQuad: (t: number) => t * (2 - t),
  // acceleration until halfway, then deceleration
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  // accelerating from zero velocity
  easeInCubic: (t: number) => t * t * t,
  // decelerating to zero velocity
  easeOutCubic: (t: number) => --t * t * t + 1,
  // acceleration until halfway, then deceleration
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  // accelerating from zero velocity
  easeInQuart: (t: number) => t * t * t * t,
  // decelerating to zero velocity
  easeOutQuart: (t: number) => 1 - --t * t * t * t,
  // acceleration until halfway, then deceleration
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),
  // accelerating from zero velocity
  easeInQuint: (t: number) => t * t * t * t * t,
  // decelerating to zero velocity
  easeOutQuint: (t: number) => 1 + --t * t * t * t * t,
  // acceleration until halfway, then deceleration
  easeInOutQuint: (t: number) => (t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t),
};

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
