import {w3cwebsocket} from 'websocket';
(global as any).WebSocket = w3cwebsocket;
import {ClientGame} from '../../client/src/game/clientGame';

console.log('started');
const clientGame = new ClientGame(
  {
    onDisconnect: () => {},
    onDied: () => {},
  },
  1000,
  1000
);
