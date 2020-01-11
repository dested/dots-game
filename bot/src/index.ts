import {w3cwebsocket} from 'websocket';
(global as any).WebSocket = w3cwebsocket;
import {ClientGame} from '../../client/src/game/clientGame';
import {Utils} from '../../common/src/utils/utils';

console.log('started');

async function main() {
  for (let i = 0; i < 500; i++) {
    const clientGame = new ClientGame({
      onDisconnect: () => {},
      onDied: () => {},
    });
    await Utils.timeout(140);
  }
}

/*
 * foreach emitters
 *  if enemy swarm is 4 radius away
 *    under attack=true
 *  else
 *    under attack=false
 *
 * if not under attack
 *   if i have 2x the min to eat planet
 *     send that percent off to eat planet
 *   else
 *     wait
 * else
 *   fortify around planet
 *
 * foreach non emitter swarm
 *  if moving
 *    check if enemy swarm is near
 *      attack
 *  else
 *    if enemy hive is closer than new planet
 *      do it
 *  */
main().catch(ex => console.error(ex));
