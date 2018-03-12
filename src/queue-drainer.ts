import * as Logger from 'bunyan';
import * as SQS from 'aws-sdk/clients/sqs';

export type Message = SQS.Types.Message;
export type MessageHandler = (message: Message) => Promise<void>;
export type ShouldContinueFunction = () => boolean;
export type BatchSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface QueueDrainerConstructorOptions {
  logger: Logger;
  sqs: SQS;
  queueUrl: string;
  handleMessage: MessageHandler;
  shouldContinue: ShouldContinueFunction;
  batchSize?: BatchSize;
  stopWhenEmpty?: boolean;
  waitTimeSeconds?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export default class QueueDrainer {
  private logger: Logger;
  private sqs: SQS;
  private queueUrl: string;
  private handleMessage: MessageHandler;
  private shouldContinue: ShouldContinueFunction;
  private batchSize: BatchSize;
  private stopWhenEmpty: boolean;
  private waitTimeSeconds: number;

  public constructor({ logger, sqs, queueUrl, handleMessage, shouldContinue, batchSize = 10, stopWhenEmpty = true, waitTimeSeconds = 0 }: QueueDrainerConstructorOptions) {
    this.logger = logger;
    this.sqs = sqs;
    this.queueUrl = queueUrl;
    this.handleMessage = handleMessage;
    this.shouldContinue = shouldContinue;
    this.batchSize = batchSize;
    this.stopWhenEmpty = stopWhenEmpty;
    this.waitTimeSeconds = waitTimeSeconds;
  }

  private deleteMessages = async (messages: Message[]) => {
    if (messages.length === 0) {
      return;
    }

    this.logger.debug({ messageCount: messages.length }, 'deleting messages');

    const Entries = messages
      .map(
        ({ MessageId, ReceiptHandle }) => {
          if (!MessageId || !ReceiptHandle) {
            this.logger.error({ MessageId, ReceiptHandle }, 'missing message id or receipt handle');
            throw new Error('missing message id or receipt handle');
          }

          return {
            Id: MessageId,
            ReceiptHandle
          };
        }
      );

    await this.sqs.deleteMessageBatch({
      QueueUrl: this.queueUrl,
      Entries
    }).promise();

    this.logger.debug({ messageCount: messages.length }, 'deleted messages');
  };

  private processMessages = async (messages: Message[]) => {
    this.logger.debug({ messageCount: messages.length }, `processing messages`);

    for (let i = 0; i < messages.length; i++) {
      await this.handleMessage(messages[ i ]);
    }
  };

  public async drain() {
    let processedMessageCount = 0;
    let pollCount = 0;

    // while we should continue
    while (this.shouldContinue()) {
      if (pollCount % 5 === 0) {
        this.logger.info({ pollCount, processedMessageCount }, 'polling...');
      } else {
        this.logger.debug({ pollCount, processedMessageCount }, 'polling...');
      }

      const messages = await this.poll();

      processedMessageCount += messages.length;
      pollCount++;

      if (messages.length === 0) {
        if (this.stopWhenEmpty) {
          this.logger.info({ processedMessageCount, pollCount }, 'queue is empty, ending drain');
          break;
        } else {
          this.logger.info('queue is empty, continuing');
          await sleep(1000);
        }
      } else {
        await this.processMessages(messages);

        await this.deleteMessages(messages);
      }
    }

    this.logger.debug({ processedMessageCount, pollCount }, 'finished');
  }

  private async poll(): Promise<Message[]> {
    const { Messages } = await this.sqs.receiveMessage({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: this.batchSize,
      WaitTimeSeconds: this.waitTimeSeconds
    }).promise();

    if (!Messages) {
      return [];
    }

    return Messages;
  }
}
