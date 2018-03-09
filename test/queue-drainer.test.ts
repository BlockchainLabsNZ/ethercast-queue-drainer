import QueueDrainer from '../src/queue-drainer';
import * as bunyan from 'bunyan';
import * as SQS from 'aws-sdk/clients/sqs';

describe('QueueDrainer', () => {
  let called: boolean = false;

  const drainer = new QueueDrainer({
    shouldContinue: () => false,
    logger: bunyan.createLogger({ name: 'test-logger', level: 'fatal' }),
    handleMessage: async message => {
      called = true;
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
