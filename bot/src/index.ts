import {w3cwebsocket} from 'websocket';
(global as any).WebSocket = w3cwebsocket;
import {ClientGame} from '../../client/src/game/clientGame';
import {Utils} from '../../common/src/utils/utils';
import {BotClientGame} from './botClientGame';
import {ClientSocket} from '../../client/src/clientSocket';

console.log('started');

async function main() {
  /*  const clientGame = new BotClientGame(
    {
      onDisconnect: () => {},
      onDied: () => {},
    },
    new ClientSocket()
  );
  return;*/
  for (let i = 0; i < 500; i++) {
    const options = {
      onDisconnect: () => {
        new BotClientGame(options, new ClientSocket());
      },
      onDied: (me: ClientGame) => {
        me.disconnect();
        new BotClientGame(options, new ClientSocket());
      },
    };

    new BotClientGame(options, new ClientSocket());
    await Utils.timeout(100);
  }
}

main().catch((ex) => console.error(ex));
