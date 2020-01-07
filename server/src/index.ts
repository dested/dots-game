import {ServerGame} from './game/serverGame';
import {ServerSocket} from './serverSocket';

const serverSocket = new ServerSocket();
const serverGame = new ServerGame(serverSocket);
serverGame.init();
