import {MoveDirection} from '../models/heading';
import {MathUtils} from '../utils/mathUtils';
import {GameConstants} from './gameConstants';

export class BaseDotSwarm {
  dotCount: number = 0;
  move?: MoveDirection;

  constructor(
    public swarmId: number,
    public x: number,
    public y: number,
    public ownerEmitterId: number | undefined,
    public teamId: string
  ) {}

  get radius(): number {
    return Math.min((this.ownerEmitterId ? GameConstants.emitterRadius : 20) + this.dotCount / 5, GameConstants.maxSwarmRadius);
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
      speed: GameConstants.debug ? 200 : 50,
    };
  }
}
