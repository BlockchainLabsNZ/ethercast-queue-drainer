import QueueDrainer from '../src/queue-drainer';
import * as bunyan from 'bunyan';
import * as SQS from 'aws-sdk/clients/sqs';

describe('QueueDrainer', () => {
  const drainer = new QueueDrainer({
    getRemainingTime: () => 0,
    logger: bunyan.createLogger({ name: 'test-logger', level: 'fatal' }),
    handleMessage: async message => {

    },
    queueUrl: 'https://fake-queue-url.com',
    sqs: {
      receiveMessage: params => {

      },
      deleteMessageBatch: params => {

      }
    } as SQS
  });

  it('is constructed', () => {
    expect(drainer).toBeTruthy();
  });
});
