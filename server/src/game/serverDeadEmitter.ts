import {BaseDeadEmitter} from '@common/game/baseDeadEmitter';
import {GameConstants} from '@common/game/gameConstants';
import {RNode} from '../rbush';
import {ServerEmitter} from './serverEmitter';
import {ServerGame} from './serverGame';

export class ServerDeadEmitter extends BaseDeadEmitter implements ServerEmitter {
  duration!: number;
  life!: number;
  lastAttack = 0;
  private bushNode: RNode<ServerDeadEmitter>;

  constructor(public game: ServerGame, x: number, y: number, power: number, emitterId: number) {
    super(x, y, power, emitterId);

    this.bushNode = {
      minX: x - GameConstants.maxSwarmRadius,
      minY: y - GameConstants.maxSwarmRadius,
      maxX: x + GameConstants.maxSwarmRadius,
      maxY: y + GameConstants.maxSwarmRadius,
      item: this,
      children: null!,
    };
    game.emitterBush.insert(this.bushNode);

    this.setDuration(Math.round(Math.random() * GameConstants.deadEmitterStartingDuration));
    this.setLife(GameConstants.deadEmitterStartingLife);
  }

  serverTick(tickIndex: number) {
    if (this.lastAttack > 0) {
      this.lastAttack--;
    }

    if (tickIndex % 5 === 0) {
      if (this.lastAttack <= 0 && this.life < GameConstants.deadEmitterStartingLife) {
        this.setLife(this.life + 1);
      }

      this.setDuration(this.duration - 1);
    }
    this.duration--;
    if (this.duration <= 0) {
      this.game.removeEmitter(this.emitterId);
      const {x, y} = this.game.getSafePosition();
      this.game.addNewDeadEmitter(x, y, this.power);
    }
  }

  remove(): void {
    this.game.emitterBush.remove(this.bushNode);
  }

  attack(amount: number) {
    this.setLife(this.life - amount);
    this.lastAttack = 10;
    this.setDuration(GameConstants.deadEmitterStartingDuration - amount);
    if (this.life <= 0) {
      return 'dead';
    }
    return 'alive';
  }

  setLife(life: number) {
    this.life = life;
    this.game.sendMessageToClients({
      type: 'set-dead-emitter-life',
      emitterId: this.emitterId,
      life,
    });
  }

  setDuration(duration: number) {
    this.duration = duration;
    this.game.sendMessageToClients({
      type: 'set-dead-emitter-duration',
      emitterId: this.emitterId,
      duration,
    });
  }
}
