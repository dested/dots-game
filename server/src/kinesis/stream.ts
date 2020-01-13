import {Kinesis, STS} from 'aws-sdk';

import {KINESIS_REGION, KINESIS_ROLE_ARN} from './constants';
import {buildIdHash, buildKinesisStreamName} from './helpers';

const stsClient = new STS({
  region: KINESIS_REGION,
});

const setUseKinesis = (use: boolean) => {
  (global as any).useKinesis = use;
};
if (!KINESIS_ROLE_ARN) {
  setUseKinesis(false);
} else {
  setUseKinesis(true);
}

export const useKinesis = () => (global as any).useKinesis;

const MAX_RETRIES = 5;
export default class KinesisClient {
  private retryCount = 0;
  private kinesisClient: Kinesis;

  private async buildClient() {
    try {
      const {AccessKeyId, Expiration, SecretAccessKey, SessionToken}: STS.Credentials = await new Promise(
        (resolve, reject) => {
          stsClient.assumeRole(
            {
              RoleArn: KINESIS_ROLE_ARN,
              RoleSessionName: `Kinesis_${Date.now()}`,
              DurationSeconds: 900,
            },
            (err, response) => {
              if (err) {
                return reject(err);
              }
              resolve(response.Credentials);
            }
          );
        }
      );

      this.kinesisClient = new Kinesis({
        credentials: {
          accessKeyId: AccessKeyId,
          expireTime: Expiration,
          secretAccessKey: SecretAccessKey,
          sessionToken: SessionToken,
        },
        maxRetries: 5,
        region: KINESIS_REGION,
      });
    } catch (error) {
      console.error(error);
      console.error('[buildClient] Turning off kinesis for now...');
      setUseKinesis(false);
    }
  }

  private retryWrapper = async <T>(name: string, asyncFn: () => Promise<T>): Promise<T> => {
    if (!useKinesis()) {
      return undefined;
    }

    if (!this.kinesisClient) {
      await this.buildClient();
    }

    try {
      console.log(`[${name}] Attempting function invocation.`);
      const result = await asyncFn();
      console.log(`[${name}] Successful:`, result);
      return result;
    } catch (err) {
      console.error(`[${name}] Function failed:`, err);
      this.kinesisClient = null;
      if (this.retryCount < MAX_RETRIES) {
        console.log(`[${name}] Retrying....`);
        return await this.retryWrapper(name, asyncFn);
      }
      console.log(`[${name}] Breached max retries... please diagnose failure.`);
    }
  };

  putRecord = async (messageType: string, messageId: string, message: any) => {
    if (!messageType || !messageId || !message) {
      throw new Error('messageType, messageId, and a message are all required.');
    }

    return await this.retryWrapper<string>('putRecord', async () => {
      const response: Kinesis.PutRecordOutput = await new Promise((resolve, reject) => {
        this.kinesisClient.putRecord(
          {
            Data: JSON.stringify(message),
            PartitionKey: buildIdHash(messageType, messageId),
            StreamName: buildKinesisStreamName(),
          },
          (err, output) => {
            if (err) {
              return reject(err);
            }
            resolve(output);
          }
        );
      });

      return response.SequenceNumber;
    });
  };
}
