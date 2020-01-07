import {ClientToServerMessage, ServerToClientMessage} from '../../../common/src/models/messages';
import {ServerGame} from '../../../server/src/game/serverGame';
import {ClientGame} from '../game/clientGame';
export const clientGames: ClientGame[] = [];
export let serverGame: ServerGame;

export function setServerGame(s: ServerGame) {
  serverGame = s;
}
export function sendMessageToServer(connectionId: string, message: ClientToServerMessage) {
  serverGame.processMessage(connectionId, message);
  // console.log('to server', JSON.stringify(message));
}
export function sendMessagesToClient(connectionId: string, messages: ServerToClientMessage[]) {
  clientGames.find(a => a.connectionId === connectionId)!.processMessages(messages);
  // console.log('to client', JSON.stringify(messages));
}
