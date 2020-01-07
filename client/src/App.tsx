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
      game.addNewEmitter(clientX, clientY, 1, myTeamId);
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
  emitters: DotEmitter[] = [];
  swarms: DotSwarm[] = [];
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private startDragging: {x: number; y: number} | null = null;
  private currentDragging: {x: number; y: number} | null = null;
  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d')!;

    for (let i = 0; i < 10; i++) {
      this.addNewEmitter(
        (Math.random() * window.innerWidth) | 0,
        (Math.random() * window.innerHeight) | 0,
        MathUtils.randomItem([1, 2]),
        MathUtils.randomItem(['a', 'b', 'c'])
      );
    }

    /*
    for (let i = 0; i < 30; i++) {
      const dotSwarm = new DotSwarm(
        this,
        uuid(),
        (Math.random() * window.innerWidth) | 0,
        (Math.random() * window.innerHeight) | 0,
        false,
        MathUtils.randomItem(['a', 'b', 'c'])
      );
      dotSwarm.augmentDotCount((Math.random() * 100) | 0);
      this.swarms.push(dotSwarm);
      this.tryMergeSwarm(dotSwarm);
    }
*/

    setInterval(() => {
      this.serverTick();
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

  serverTick() {
    for (const emitter of this.emitters) {
      emitter.serverTick();
    }
    for (const swarm of this.swarms) {
      swarm.serverTick();
    }
  }

  draw() {
    this.context.fillStyle = 'black';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const dragEllipse = this.dragEllipse();

    for (const emitter of this.emitters) {
      this.context.save();
      this.context.strokeStyle = 'white';
      this.context.lineWidth = 3;
      this.context.fillStyle = shade(colors[emitter.teamId], 50) + 'aa';
      const swarm = this.swarms.find(a => a.swarmId === emitter.swarmId);
      if (!swarm) {
        // debugger;
        throw new Error('bunkop');
      }

      CanvasUtils.circle(this.context, emitter.x, emitter.y, Math.max(swarm.radius, Constants.emitterRadius));
      this.context.stroke();
      this.context.fill();
      this.context.restore();
    }
    for (const swarm of this.swarms) {
      if (false && !swarm.emitterSwarm) {
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

    this.emitters.push(new DotEmitter(this, x, y, power, swarmId, teamId));

    const dotSwarm = new DotSwarm(this, swarmId, x, y, true, teamId);
    dotSwarm.augmentDotCount(5);

    this.swarms.push(dotSwarm);
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

      if (selectedDots.length === swarm.dots.length && !swarm.emitterSwarm) {
        swarm.setHeading(x, y);
      } else {
        const newSwarm = new DotSwarm(this, uuid(), swarm.x, swarm.y, false, swarm.teamId);
        const dotCount = MathUtils.sum(selectedDots.map(a => a.value));
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

  tryMergeSwarm(mergableSwarm: DotSwarm) {
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
          if ((swarm.dotCount > mergableSwarm.dotCount || swarm.emitterSwarm) && !mergableSwarm.emitterSwarm) {
            swarm.augmentDotCount(mergableSwarm.dotCount);
            this.swarms.splice(this.swarms.indexOf(mergableSwarm), 1);
            mergableSwarm = swarm;
          } else {
            if (swarm.emitterSwarm) {
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
  }

  removeSwarm(swarmId: string) {
    this.swarms.splice(
      this.swarms.findIndex(a => a.swarmId === swarmId),
      1
    );
  }
}

export class DotEmitter {
  constructor(
    public game: Game,
    public x: number,
    public y: number,
    public power: number,
    public swarmId: string,
    public teamId: string
  ) {}

  tick() {}

  serverTick() {
    const find = this.game.swarms.find(a => a.swarmId === this.swarmId);
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

  constructor(
    public game: Game,
    public swarmId: string,
    public x: number,
    public y: number,
    public emitterSwarm: boolean,
    public teamId: string
  ) {}

  augmentDotCount(dotCount: number) {
    if (dotCount === 0) {
      return;
    }
    this.dotCount = this.dotCount + dotCount;

    if (this.dotCount <= 0) {
      if (this.emitterSwarm) {
        this.dots.length = 0;
      } else {
        this.game.removeSwarm(this.swarmId);
      }
      return;
    }

    if (dotCount < 0) {
      if (this.dotCount < Constants.maxRenderedDotsPerSwarm) {
        this.dots.splice(0, this.dotCount);
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
    return Math.min((this.emitterSwarm ? Constants.emitterRadius : 20) + this.dotCount / 5, 80);
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
        this.game.tryMergeSwarm(this);
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
      if (swarm.teamId !== this.teamId) {
        if (MathUtils.overlapCircles(this, swarm)) {
          if (swarm.dotCount > 0) {
            const power = Math.min(Math.ceil(this.dotCount / 15), swarm.dotCount);
            this.augmentDotCount(-power);
            swarm.augmentDotCount(-power);
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
};

const myTeamId = 'a';
