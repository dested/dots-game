import {Heading} from '../models/heading';
import {AnimationUtils} from './animationUtils';

export class MathUtils {
  static randomItem<T>(item: T[]): T {
    return item[Math.floor(Math.random() * item.length)];
  }
  /*  static inEllipse(x: number, y: number, radiusX: number, radiusY: number, pointX: number, pointY: number) {
    return Math.pow(pointX - x, 2) / Math.pow(radiusX, 2) + Math.pow(pointY - y, 2) / Math.pow(radiusY, 2) <= 1;
  }*/

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
    return this.inSquare(point.x, point.y, box.x, box.y, box.width, box.height);
  }

  static inSquare(x: number, y: number, bx: number, by: number, bw: number, bh: number) {
    return x > bx && x < bx + bw && y > by && y < by + bh;
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
