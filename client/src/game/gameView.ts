import {AnimationUtils} from '../../../common/src/utils/animationUtils';

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
