import {GameConstants} from '@common/game/gameConstants';
import {ClientToServerMessage, ServerToClientMessage} from '@common/models/messages';
import {ClientToServerMessageParser} from '@common/parsers/clientToServerMessageParser';
import {ServerToClientMessageParser} from '@common/parsers/serverToClientMessageParser';
import {Utils} from '@common/utils/utils';

export class ClientSocket implements IClientSocket {
  private socket?: WebSocket;
  connect(options: {
    onOpen: () => void;
    onMessage: (messages: ServerToClientMessage[]) => void;
    onDisconnect: () => void;
  }) {
    // this.socket = new WebSocket('wss://game.quickga.me');
    this.socket = new WebSocket('ws://localhost:8082');
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = () => {
      options.onOpen();
    };
    this.socket.onerror = (e) => {
      console.log(e);
      this.socket?.close();
      options.onDisconnect();
    };
    this.socket.onmessage = (e) => {
      if (GameConstants.binaryTransport) {
        options.onMessage(ServerToClientMessageParser.toServerToClientMessages(e.data));
      } else {
        options.onMessage(JSON.parse(e.data));
      }
    };
    this.socket.onclose = () => {
      options.onDisconnect();
    };
  }

  sendMessage(message: ClientToServerMessage) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    try {
      if (GameConstants.binaryTransport) {
        this.socket.send(ClientToServerMessageParser.fromClientToServerMessage(message));
      } else {
        this.socket.send(JSON.stringify(message));
      }
    } catch (ex) {
      console.error('disconnected??');
    }
  }

  disconnect() {
    this.socket?.close();
  }
}

export interface IClientSocket {
  connect(options: {
    onOpen: () => void;
    onMessage: (messages: ServerToClientMessage[]) => void;
    onDisconnect: () => void;
  }): void;

  sendMessage(message: ClientToServerMessage): void;

  disconnect(): void;
}
