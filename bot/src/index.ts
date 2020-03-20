import {w3cwebsocket} from 'websocket';
(global as any).WebSocket = w3cwebsocket;
import {ClientGame} from '../../client/src/game/clientGame';
import {Utils} from '../../common/src/utils/utils';
import {BotClientGame} from './botClientGame';

console.log('started');

async function main() {
  /*  const clientGame = new BotClientGame({
    onDisconnect: () => {},
    onDied: () => {},
  });
  return;*/
  for (let i = 0; i < 300; i++) {
    const options = {
      onDisconnect: () => {
        new BotClientGame(options);
      },
      onDied: (me: ClientGame) => {
        me.disconnect();
        new BotClientGame(options);
      },
    };

    new BotClientGame(options);
    await Utils.timeout(100);
  }
}

main().catch(ex => console.error(ex));
