import {BaseDotSwarm} from '../../../common/src/game/baseDotSwarm';
import {GameConstants} from '../../../common/src/game/gameConstants';
import {MathUtils} from '../../../common/src/utils/mathUtils';
import {RNode} from '../rbush';
import {ServerDeadEmitter} from './serverDeadEmitter';
import {ServerGame} from './serverGame';

export class ServerDotSwarm extends BaseDotSwarm {
  private bushNode: RNode<ServerDotSwarm>;
  constructor(
    public game: ServerGame,
    swarmId: number,
    x: number,
    y: number,
    ownerEmitterId: number | null,
    teamId: string
  ) {
    super(swarmId, x, y, ownerEmitterId, teamId);
    this.bushNode = {
      minX: x - GameConstants.maxSwarmRadius,
      minY: y - GameConstants.maxSwarmRadius,
      maxX: x + GameConstants.maxSwarmRadius,
      maxY: y + GameConstants.maxSwarmRadius,
      item: this,
    };
    game.swarmBush.insert(this.bushNode);
  }

  battledThisTick: number[] = [];

  augmentDotCount(dotCount: number) {
    if (dotCount === 0) {
      return;
    }
    let remainder = 0;
    if (dotCount > 0 && this.dotCount + dotCount > GameConstants.maxDotsPerSwarm) {
      const newDotCount = GameConstants.maxDotsPerSwarm - this.dotCount;
      remainder = dotCount - newDotCount;
      this.dotCount = GameConstants.maxDotsPerSwarm;
      dotCount = newDotCount;
    } else {
      this.dotCount = this.dotCount + dotCount;
    }
    if (dotCount !== 0) {
      this.game.sendMessageToClients({
        type: 'augment-dot-count',
        swarmId: this.swarmId,
        dotCount,
      });
    }
    return remainder;
  }

  serverTick(duration: number) {
    if (this.move) {
      this.x = this.x + this.move.directionX * (this.move.speed * (duration / 1000));
      this.y = this.y + this.move.directionY * (this.move.speed * (duration / 1000));

      this.game.swarmBush.remove(this.bushNode);

      if (MathUtils.distance(this.x, this.y, this.move.startingX, this.move.startingY) > this.move.distance) {
        this.x = this.move.headingX;
        this.y = this.move.headingY;
        this.move = undefined;
        this.game.tryMergeSwarm(this.swarmId);
      }
      if (this.game.swarms.indexOf(this) !== -1) {
        this.bushNode.minX = this.x - GameConstants.maxSwarmRadius;
        this.bushNode.minY = this.y - GameConstants.maxSwarmRadius;
        this.bushNode.maxX = this.x + GameConstants.maxSwarmRadius;
        this.bushNode.maxY = this.y + GameConstants.maxSwarmRadius;

        this.game.swarmBush.insert(this.bushNode);
      }
    }

    const foundSwarms = this.game.swarmBush.search(this.bushNode);

    for (const {item: swarm} of foundSwarms) {
      if (swarm.teamId !== this.teamId) {
        if (swarm.battledThisTick.includes(this.swarmId)) {
          continue;
        }
        if (MathUtils.overlapCircles(this, swarm)) {
          if (swarm.dotCount <= 0) {
            continue;
          }
          const power = Math.min(
            Math.max(Math.ceil(this.dotCount / 9), Math.ceil(swarm.dotCount / 9)),
            swarm.dotCount,
            this.dotCount
          );
          this.augmentDotCount(-power);
          swarm.augmentDotCount(-power);
          swarm.battledThisTick.push(this.swarmId);
          this.battledThisTick.push(swarm.swarmId);
          if (this.dotCount <= 0) {
            break;
          }
        }
      }
    }

    if (!this.move) {
      const foundEmitters = this.game.emitterBush.search(this.bushNode);

      for (let i = foundEmitters.length - 1; i >= 0; i--) {
        const emitter = foundEmitters[i].item;
        if (!(emitter instanceof ServerDeadEmitter)) {
          continue;
        }

        if (MathUtils.overlapCircles(this, emitter)) {
          const power = Math.min(Math.max(Math.ceil(this.dotCount / 9)), this.dotCount, emitter.life);
          this.augmentDotCount(-power);
          const attackResult = emitter.attack(power);

          if (attackResult === 'dead') {
            this.game.removeEmitter(emitter.emitterId);
            const newEmitter = this.game.addNewEmitter(emitter.x, emitter.y, emitter.power, this.teamId, false);
            this.game.addNewSwarm(newEmitter.x, newEmitter.y, this.dotCount, newEmitter.emitterId, this.teamId);
            this.augmentDotCount(-this.dotCount);
          }
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
