import {v4} from 'uuid';

export const KINESIS_APP_NAME = 'dots-game';
export const KINESIS_ROLE_ARN = process.env.KINESIS_ROLE_ARN;
export const KINESIS_INSTANCE_ID = v4();
export const KINESIS_STAGE = process.env.NODE_ENV === 'development' ? 'test' : 'prod';
export const KINESIS_REGION = process.env.AWS_REGION || 'us-west-2';
