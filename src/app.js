import {createLogger} from '@natlibfi/melinda-backend-commons';
import {transformerBlobLogic, createMongoBlobsOperator, createAmqpOperator} from '@natlibfi/melinda-record-import-commons';
import createTransformHandler from './transform/index.js';
import amqplib from 'amqplib';

export async function startApp(config) {
  const logger = createLogger();
  const mongoOperator = await createMongoBlobsOperator(config.mongoUrl);
  const amqpOperator = await createAmqpOperator(amqplib, config.amqpUrl);
  const transformHandler = createTransformHandler(config);

  logger.info('Starting melinda record import removal transformer');
  try {
    await transformerBlobLogic(mongoOperator, amqpOperator, transformHandler, config);
  } catch (error) {
    logger.error(error);
  } finally {
    await amqpOperator.closeChannel();
    await amqpOperator.closeConnection();
    mongoOperator.closeClient();
  }
}
