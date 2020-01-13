import {ClientToServerMessage} from '../../../common/src/models/messages';
import {ServerSocket} from '../serverSocket';

import KinesisClient, { useKinesis } from './stream';

export interface KinesisSocketOptions {
  onJoin: (connectionId: string) => void;
  onLeave: (connectionId: string) => void;
  onMessage: (connectionId: string, message: ClientToServerMessage) => void;
}

const startWithKinesis = (serverSocket: ServerSocket, options: KinesisSocketOptions) => {
  const kinesisClient = new KinesisClient();
  serverSocket.start(
    (connectionId: string) => {
      kinesisClient.putRecord('join', connectionId, {type: 'joined'});
      options.onJoin(connectionId);
    },
    (connectionId: string) => {
      kinesisClient.putRecord('leave', connectionId, {type: 'left'});
      options.onLeave(connectionId);
    },
    (connectionId: string, message: ClientToServerMessage) => {
      kinesisClient.putRecord(message.type, connectionId, message);
    }
  );
  console.log('Socket server has started with kinesis:', useKinesis());
};

export default startWithKinesis;
