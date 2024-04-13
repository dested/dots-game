import {BaseDotSwarm} from '@common/game/baseDotSwarm';
import {GameConstants} from '@common/game/gameConstants';
import {Heading} from '@common/models/heading';
import {ColorUtils} from '@common/utils/colorUtils';
import {MathUtils} from '@common/utils/mathUtils';
import {CanvasUtils} from '../utils/canvasUtils';
import {ClientGame} from './clientGame';
import {ClientGameUI} from './clientGameUI';

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
    swarmId: number,
    x: number,
    y: number,
    ownerEmitterId: number | undefined,
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
      if (this.dotCount < GameConstants.maxRenderedDotsPerSwarm) {
        this.dots.splice(this.dotCount, this.dots.length - this.dotCount);
      }
    }

    for (let i = this.dots.length; i < Math.min(GameConstants.maxRenderedDotsPerSwarm, this.dotCount); i++) {
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

    if (this.dots.length > GameConstants.maxRenderedDotsPerSwarm) {
      this.dots.splice(GameConstants.maxRenderedDotsPerSwarm, this.dots.length);
    }

    const numItems = this.dotCount;
    const itemsPerBucket = Math.floor(numItems / Math.min(this.dots.length, GameConstants.maxRenderedDotsPerSwarm));
    const remainingItems = Math.floor(numItems % Math.min(this.dots.length, GameConstants.maxRenderedDotsPerSwarm));
    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];
      const extra = i < remainingItems ? 1 : 0;
      dot.value = itemsPerBucket + extra;
    }
    this.dots = this.dots.filter((a) => a.value > 0);
    if (this.dotCount !== MathUtils.sum(this.dots.map((a) => a.value))) {
      throw new Error(`miscount ${this.dotCount} ${MathUtils.sum(this.dots.map((a) => a.value))}`);
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

  draw(context: CanvasRenderingContext2D, dragRect?: {x: number; y: number; width: number; height: number}) {
    const color = this.game.teams.find((t) => t.teamId === this.teamId)!.color;

    if ((this.game as ClientGameUI).view.scale < 0.5) {
      context.save();
      context.fillStyle = color;
      CanvasUtils.circle(context, this.x, this.y, this.radius);
      context.fill();
      context.restore();
      return;
    }

    context.save();
    context.translate(this.x, this.y);
    for (const dot of this.dots) {
      context.save();
      if (
        dot.selected ||
        (dragRect &&
          this.teamId === this.game.myTeamId &&
          MathUtils.inSquare(this.x + dot.x, this.y + dot.y, dragRect.x, dragRect.y, dragRect.width, dragRect.height))
      ) {
        context.fillStyle = 'white';
      } else {
        context.fillStyle = color + 'aa';
      }
      CanvasUtils.circle(context, dot.x, dot.y, Math.min(1 + dot.value, 50));
      context.fill();
      context.restore();
    }
    if (GameConstants.debugDraw) {
      context.font = '30px bold';
      context.fillStyle = 'yellow';
      context.fillText(this.dotCount.toString(), 0, 0);
    }
    // this.context.fillText(this.dotCount + ' ' + MathUtils.sum(this.dots.map(a => a.value)), 0, 0);
    context.restore();
  }
}
