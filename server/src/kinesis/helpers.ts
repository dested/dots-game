import * as constants from './constants';

export const buildKinesisStreamName = () =>
  `${constants.KINESIS_STAGE}-${constants.KINESIS_APP_NAME}-${constants.KINESIS_REGION}-stream`;

export const buildIdHash = (type: string, id: string) => `${type}_${constants.KINESIS_INSTANCE_ID}_${id}`;
