import {ClientDeadEmitter} from '@client/game/clientDeadEmitter';
import {ClientDotEmitter} from '@client/game/clientDotEmitter';
import {ClientDotSwarm} from '@client/game/clientDotSwarm';
import {ClientEmitter} from '@client/game/clientEmitter';
import {ClientGame} from '@client/game/clientGame';
import {GameConstants} from '@common/game/gameConstants';
import {MathUtils} from '@common/utils/mathUtils';
import {IClientSocket} from '@client/clientSocket';

export class BotClientGame extends ClientGame {
  constructor(
    options: {onDied: (me: ClientGame) => void; onDisconnect: (me: ClientGame) => void},
    socket: IClientSocket
  ) {
    super(options, socket);

    const int = setInterval(() => {
      if (this.isDead) {
        clearInterval(int);
        return;
      }
      this.tryNextMoves();
    }, 1000);
  }

  sendMove(x: number, y: number, swarms: {swarmId: number; percent: number}[]) {
    this.sendMessageToServer({
      type: 'move-dots',
      x,
      y,
      swarms,
    });
  }

  private sentToEmitter: {[emitterId: number]: {emitterId: number; time: number}[]} = {};

  private tryNextMoves() {
    const myEmitters = this.emitters
      .filter((emitter) => emitter instanceof ClientDotEmitter && emitter.teamId === this.myTeamId)
      .map((a) => a as ClientDotEmitter);
    if (myEmitters.length === 0) {
      console.log('dead');
    }
    const deadEmitters = this.emitters
      .filter((emitter) => emitter instanceof ClientDeadEmitter)
      .map((a) => a as ClientDeadEmitter);

    const mySwarms = this.swarms.filter((swarm) => swarm.teamId === this.myTeamId);
    const myRovingSwarms = mySwarms.filter((swarm) => swarm.ownerEmitterId === undefined);

    const enemySwarms = this.swarms.filter((swarm) => swarm.teamId !== this.myTeamId);
    const enemyEmitters = this.emitters
      .filter((emitter) => emitter instanceof ClientDotEmitter && emitter.teamId !== this.myTeamId)
      .map((a) => a as ClientDotEmitter);

    let underAttack = false;

    emitters: for (const emitter of myEmitters) {
      if (!this.sentToEmitter[emitter.emitterId]) {
        this.sentToEmitter[emitter.emitterId] = [];
      }
      for (let i = this.sentToEmitter[emitter.emitterId].length - 1; i >= 0; i--) {
        const sentToDeadEmitterElementElement = this.sentToEmitter[emitter.emitterId][i];
        if (sentToDeadEmitterElementElement.time + 60 * 1000 < +new Date()) {
          this.sentToEmitter[emitter.emitterId].splice(i, 1);
        }
      }

      const myEmitterSwarm = mySwarms.find((a) => a.ownerEmitterId === emitter.emitterId)!;
      for (const enemySwarm of enemySwarms) {
        if (MathUtils.overlapCircles(emitter, enemySwarm, GameConstants.emitterRadius * 4)) {
          underAttack = true;
        } else {
          underAttack = false;
        }
      }
      if (!underAttack) {
        const aroundMe: {emitter: ClientEmitter; distance: number}[] = [];

        for (const deadEmitter of deadEmitters) {
          if (myEmitterSwarm.dotCount > deadEmitter.life * 2) {
            const distance = MathUtils.distanceObj(emitter, deadEmitter);
            if (distance < GameConstants.emitterRadius * 50) {
              if (this.sentToEmitter[emitter.emitterId].find((a) => a.emitterId === deadEmitter.emitterId)) {
                continue;
              }
              aroundMe.push({emitter: deadEmitter, distance});
            }
          }
        }
        if (aroundMe.length > 0) {
          const closest = aroundMe.sort((a, b) => a.distance - b.distance)[0];
          // console.log('sending to dead emitter from emitter');
          this.sentToEmitter[emitter.emitterId].push({
            emitterId: closest.emitter.emitterId,
            time: +new Date(),
          });
          this.sendMove(closest.emitter.x, closest.emitter.y, [
            {
              swarmId: myEmitterSwarm.swarmId,
              percent: ((closest.emitter as ClientDeadEmitter).life * 2) / myEmitterSwarm.dotCount,
            },
          ]);
          continue emitters;
        }

        if (myEmitterSwarm.dotCount > 150) {
          aroundMe.length = 0;
          for (const enemyEmitter of enemyEmitters) {
            const distance = MathUtils.distanceObj(emitter, enemyEmitter);
            if (distance < GameConstants.emitterRadius * 50) {
              if (this.sentToEmitter[emitter.emitterId].find((a) => a.emitterId === enemyEmitter.emitterId)) {
                continue;
              }
              aroundMe.push({emitter: enemyEmitter, distance});
            }
          }
          if (aroundMe.length > 0) {
            const closest = aroundMe.sort((a, b) => a.distance - b.distance)[0];
            // console.log('sending to dead emitter from emitter');
            this.sentToEmitter[emitter.emitterId].push({
              emitterId: closest.emitter.emitterId,
              time: +new Date(),
            });
            this.sendMove(closest.emitter.x, closest.emitter.y, [{swarmId: myEmitterSwarm.swarmId, percent: 0.8}]);
            continue emitters;
          }
        }
      } else {
        // todo fortify from other nearby bases
      }
    }

    swarm: for (const myRovingSwarm of myRovingSwarms) {
      if (myRovingSwarm.move) {
        for (const enemySwarm of enemySwarms) {
          if (MathUtils.overlapCircles(myRovingSwarm, enemySwarm, GameConstants.emitterRadius * 6)) {
            if (myRovingSwarm.dotCount > enemySwarm.dotCount * 1.2) {
              // console.log('sending to enemy swarm');
              this.sendMove(enemySwarm.x, enemySwarm.y, [{swarmId: myRovingSwarm.swarmId, percent: 1}]);
              continue swarm;
            }
          }
        }
        for (const enemyEmitter of enemyEmitters) {
          if (MathUtils.overlapCircles(myRovingSwarm, enemyEmitter, GameConstants.emitterRadius * 6)) {
            const enemyEmitterSwarm = this.swarms.find((a) => a.ownerEmitterId === enemyEmitter.emitterId)!;
            if (myRovingSwarm.dotCount > enemyEmitterSwarm.dotCount * 1.2) {
              // console.log('sending to enemy emitter');
              this.sendMove(enemyEmitter.x, enemyEmitter.y, [{swarmId: myRovingSwarm.swarmId, percent: 1}]);
              continue swarm;
            }
          }
        }
      } else {
        const aroundMe: {emitter: ClientDeadEmitter; distance: number}[] = [];

        for (const deadEmitter of deadEmitters) {
          // if (myRovingSwarm.dotCount > deadEmitter.life * 2) {
          const distance = MathUtils.distanceObj(myRovingSwarm, deadEmitter);
          if (distance < GameConstants.emitterRadius * 500) {
            aroundMe.push({emitter: deadEmitter, distance});
          }
          // }
        }
        if (aroundMe.length > 0) {
          const closest = aroundMe.sort((a, b) => a.distance - b.distance)[0];
          // console.log('sending to swarm to dead emitter');
          this.sendMove(closest.emitter.x, closest.emitter.y, [
            {swarmId: myRovingSwarm.swarmId, percent: (closest.emitter.life * 2) / myRovingSwarm.dotCount},
          ]);
          continue swarm;
        }
      }
    }

    /*
     * foreach non emitter swarm
     *  if moving
     *    check if enemy swarm is near
     *      attack
     *  else
     *    if enemy hive is closer than new planet
     *      do it
     *  */
  }
}
