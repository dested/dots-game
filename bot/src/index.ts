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
main().catch(ex => console.error(ex));
