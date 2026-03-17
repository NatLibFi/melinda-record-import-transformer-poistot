import {Error as TransformationError} from '@natlibfi/melinda-commons';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import createSruClient from '@natlibfi/sru-client';
import {createLogger} from '@natlibfi/melinda-backend-commons';

export async function createSruOperator(url, recordSchema = 'marcxml') {
  const logger = createLogger();
  const sruClient = await createSruClient({url, recordSchema});

  return {getRecord};

  function getRecord(id) {
    logger.info(`Reading record ${id}`);
    logger.verbose(`Reading record ${id} from sru`);

    return new Promise((resolve, reject) => {
      validateRequestId(id);
      let promise;

      sruClient.searchRetrieve(`melinda.melindaId=${id}`)
        .on('record', xmlString => {
          promise = MARCXML.from(xmlString, {subfieldValues: false});
        })
        .on('end', async () => {
          if (promise) {
            try {
              const record = await promise;
              resolve(record);
            } catch (err) {
              reject(err);
            }

            return;
          }

          resolve();
        })
        .on('error', err => reject(err));
    });
  }

  function validateRequestId(id) {
    logger.debug(`Validating requestId '${id}'`);

    if (id.length !== 9) {
      throw new TransformationError(400, `Invalid request id ${id} (Length)`);
    }

    if (!(/^[0-9]{9}$/u).test(id)) {
      throw new TransformationError(400, `Invalid request id ${id} (Value)`);
    }

    return;
  }
}

