import * as WebServer from 'ws';
import {ClientToServerMessage, ServerToClientMessage} from '../../common/src/models/messages';
import {uuid} from '../../common/src/utils/uuid';

export class ServerSocket {
  wss?: WebServer.Server;
  connections: {connectionId: string; socket: WebServer.WebSocket}[] = [];

  start(
    onJoin: (connectionId: string) => void,
    onLeave: (connectionId: string) => void,
    onMessage: (connectionId: string, message: ClientToServerMessage) => void
  ) {
    const port = parseInt(process.env.PORT || '3120');
    console.log(port, 'port');
    this.wss = new WebServer.Server({port});
    this.wss.on('error', (a: any, b: any) => {
      console.error('error', a, b);
    });
    this.wss.on('listening', (a: any, b: any) => {
      console.error('listen', a, b);
    });

    this.wss.on('headers', (a: any, b: any) => {
      console.error('headers', a, b);
    });

    this.wss.on('connection', ws => {
      const me = {socket: ws, connectionId: uuid()};
      console.log('new connection', me.connectionId);
      this.connections.push(me);

      ws.on('message', message => {
        onMessage(me.connectionId, JSON.parse(message as string));
      });

      ws.onclose = () => {
        const ind = this.connections.findIndex(a => a.connectionId === me.connectionId);
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
    const client = this.connections.find(a => a.connectionId === connectionId);
    if (!client) {
      return;
    }
    client.socket.send(JSON.stringify(messages));
  }
}
