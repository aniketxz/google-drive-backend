import amqplib, { Channel, ChannelModel } from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export const QUEUES = {
  THUMBNAIL_GENERATE: 'thumbnail.generate',
} as const;

/** Connect to RabbitMQ and assert all queues — called at server/worker startup */
export async function connectRabbitMQ(): Promise<Channel> {
  connection = await amqplib.connect(config.RABBITMQ_URL);
  channel = await connection.createChannel();

  // Assert durable queues so messages survive broker restarts
  await channel.assertQueue(QUEUES.THUMBNAIL_GENERATE, { durable: true });

  logger.info('RabbitMQ connected');

  connection.on('error', (err: Error) => logger.error({ err }, 'RabbitMQ connection error'));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));

  return channel;
}

/** Returns the active channel — null if not yet connected */
export function getChannel(): Channel | null {
  return channel;
}

/** Health check — returns true if channel is open */
export function isRabbitMQHealthy(): boolean {
  return channel !== null;
}

/** Graceful shutdown */
export async function closeRabbitMQ(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // ignore close errors on shutdown
  }
}
