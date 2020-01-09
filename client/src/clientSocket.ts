import {ClientToServerMessage, ServerToClientMessage} from '../../common/src/models/messages';

export class ClientSocket {
  private socket?: WebSocket;
  connect(onOpen: () => void, onMessage: (messages: ServerToClientMessage[]) => void) {
    this.socket = new WebSocket('wss://game.quickga.me');
    this.socket.onopen = () => {
      onOpen();
    };
    this.socket.onerror = e => {
      console.log(e);
    };
    this.socket.onmessage = e => {
      onMessage(JSON.parse(e.data));
    };
  }

  sendMessage(message: ClientToServerMessage) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.send(JSON.stringify(message));
  }
}
