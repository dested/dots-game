import WebSocket, {Server} from 'ws';
import {GameConstants} from '../../common/src/game/gameConstants';
import {ClientToServerMessage, ServerToClientMessage} from '../../common/src/models/messages';
import {ClientToServerMessageParser} from '../../common/src/parsers/clientToServerMessageParser';
import {ServerToClientMessageParser} from '../../common/src/parsers/serverToClientMessageParser';
import {uuid} from '../../common/src/utils/uuid';

export class ServerSocket implements IServerSocket {
  wss?: Server;
  connections: {connectionId: string; socket: WebSocket}[] = [];

  start(
    onJoin: (connectionId: string) => void,
    onLeave: (connectionId: string) => void,
    onMessage: (connectionId: string, message: ClientToServerMessage) => void
  ) {
    const port = parseInt(process.env.PORT || '8082');
    this.wss = new Server({port, perMessageDeflate: false});
    this.wss.on('error', (a: any, b: any) => {
      console.error('error', a, b);
    });

    this.wss.on('connection', (ws) => {
      ws.binaryType = 'arraybuffer';
      const me = {socket: ws as unknown as WebSocket, connectionId: uuid()};
      // console.log('new connection', me.connectionId);
      this.connections.push(me);

      ws.on('message', (message) => {
        if (GameConstants.binaryTransport) {
          this.totalBytesReceived += (message as ArrayBuffer).byteLength;
          onMessage(me.connectionId, ClientToServerMessageParser.toClientToServerMessage(message as ArrayBuffer));
        } else {
          onMessage(me.connectionId, JSON.parse(message as string));
        }
      });

      ws.onclose = () => {
        const ind = this.connections.findIndex((a) => a.connectionId === me.connectionId);
        if (ind === -1) {
          return;
        }
        this.connections.splice(ind, 1);
        onLeave(me.connectionId);
      };
      onJoin(me.connectionId);
    });
  }

  sendMessage(connectionId: string, messages: ServerToClientMessage[]) {
    const client = this.connections.find((a) => a.connectionId === connectionId);
    if (!client) {
      return;
    }
    if (GameConstants.binaryTransport) {
      const body = ServerToClientMessageParser.fromServerToClientMessages(messages);
      this.totalBytesSent += body.byteLength;
      client.socket.send(body);
    } else {
      const body = JSON.stringify(messages);
      this.totalBytesSent += body.length * 2 + 1;
      client.socket.send(body);
    }
  }
  totalBytesSent = 0;
  totalBytesReceived = 0;
}

export interface IServerSocket {
  start(
    onJoin: (connectionId: string) => void,
    onLeave: (connectionId: string) => void,
    onMessage: (connectionId: string, message: ClientToServerMessage) => void
  ): void;

  sendMessage(connectionId: string, messages: ServerToClientMessage[]): void;
}
