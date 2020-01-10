import {GameConstants} from '../../common/src/game/gameConstants';
import {ClientToServerMessage, ServerToClientMessage} from '../../common/src/models/messages';
import {ClientToServerMessageParser} from '../../common/src/parsers/clientToServerMessageParser';
import {ServerToClientMessageParser} from '../../common/src/parsers/serverToClientMessageParser';

export class ClientSocket {
  private socket?: WebSocket;
  connect(onOpen: () => void, onMessage: (messages: ServerToClientMessage[]) => void) {
    // this.socket = new WebSocket('wss://game.quickga.me');
    this.socket = new WebSocket('ws://localhost:8081');
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = () => {
      onOpen();
    };
    this.socket.onerror = e => {
      console.log(e);
    };
    this.socket.onmessage = e => {
      if (GameConstants.binaryTransport) {
        onMessage(ServerToClientMessageParser.toServerToClientMessages(e.data));
      } else {
        onMessage(JSON.parse(e.data));
      }
    };
  }

  sendMessage(message: ClientToServerMessage) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    if (GameConstants.binaryTransport) {
      this.socket.send(ClientToServerMessageParser.fromClientToServerMessage(message));
    } else {
      this.socket.send(JSON.stringify(message));
    }
  }
}
