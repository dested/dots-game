import {BaseDeadEmitter} from '../../../common/src/game/baseDeadEmitter';
import {GameConstants} from '../../../common/src/game/gameConstants';
import {ServerEmitter} from './serverEmitter';
import {ServerGame} from './serverGame';

export class ServerDeadEmitter extends BaseDeadEmitter implements ServerEmitter {
  duration = Math.round(Math.random() * GameConstants.deadEmitterStartingDuration);
  life = GameConstants.deadEmitterStartingLife;

  constructor(public game: ServerGame, x: number, y: number, power: number, emitterId: string) {
    super(x, y, power, emitterId);
  }

  serverTick() {
    if (this.life < GameConstants.deadEmitterStartingLife) {
      this.setLife(this.life + 1);
    }
    this.setDuration(this.duration - 1);
    this.duration--;
    if (this.duration <= 0) {
      this.game.removeEmitter(this.emitterId);
      const {x, y} = this.game.getSafePosition();
      this.game.addNewDeadEmitter(x, y, this.power);
    }
  }

  attack(amount: number) {
    this.setLife(this.life - amount);
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
  }
}
