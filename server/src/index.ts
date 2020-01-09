console.log('started1');
import {ServerGame} from './game/serverGame';
import {ServerSocket} from './serverSocket';
console.log('started2');
const serverSocket = new ServerSocket();
const serverGame = new ServerGame(serverSocket);
serverGame.init();
