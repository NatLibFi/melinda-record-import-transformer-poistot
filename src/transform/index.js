
import {promisify} from 'util';
import {EventEmitter} from 'events';

import {MarcRecord} from '@natlibfi/marc-record';
import {createLogger} from '@natlibfi/melinda-backend-commons';

import createValidator from '../validate/index.js';
import {createSruOperator} from './sruOperator.js';
import {handleLOWs, handleSIDs, handleTaggedFields} from './removeLocalFields.js';

class TransformEmitter extends EventEmitter { }

export default ({sruUrl}) => (stream, validationOptions = {validate: true, fix: true}) => {
  const logger = createLogger();
  const setTimeoutPromise = promisify(setTimeout);
  MarcRecord.setValidationOptions({subfieldValues: false});
  const Emitter = new TransformEmitter();

  logger.debug('Starting to send recordEvents');

  readStream(stream);
  return Emitter;

  async function readStream(stream) {
    const {getRecord} = await createSruOperator(sruUrl);
    try {
      new Promise((res, rej) => {
        try {

          let streamData = '';
          stream.on('data', chunk => streamData += chunk)
            .on('end', async () => {
              await setTimeoutPromise(50);
              //console.log(streamData); // eslint-disable-line

              const dataJson = returnParsedJson(streamData);
              const {data, settings, email, cataloger} = dataJson;
              //console.log(dataJson.email); // eslint-disable-line
              //console.log(dataJson.cataloger); // eslint-disable-line
              //console.log(dataJson.settings); // eslint-disable-line
              // "settings": {"libraryTag": "FIKKA", "replicateToLocalDB": false, "removeEmptyRecord": false, "handleSubRecords": false;}
              //console.log(dataJson.data); // eslint-disable-line

              Emitter.emit('cataloger', settings.replicateToLocalDB ? `${cataloger}`.toUpperCase() : `LOAD-${settings.libraryTag}`.toUpperCase());
              await setTimeoutPromise(50);

              Emitter.emit('notificationEmail', email ? email : '');
              await setTimeoutPromise(50);

              await handleDataTransformation(data, settings, validationOptions);

              Emitter.emit('end', data.length);
              res();

              function returnParsedJson(value) {
                const parsed = JSON.parse(value);

                if (typeof parsed === 'object') {
                  return parsed;
                }

                return returnParsedJson(parsed);
              }
            });
        } catch (error) {
          logger.log('error', 'Unexpected transformation error in the end');
          Emitter.emit('error', err);
          rej(error);
        }
      });
    } catch (err) {
      logger.log('error', 'Unexpected stream transformation error');
      Emitter.emit('error', err);
    }

    async function handleDataTransformation(data, settings, validationOptions) {
      const [dataSet, ...rest] = data;

      if (dataSet === undefined) {
        return;
      }

      // DATA = {"localId":"1184996","recordIds":["001173048"],"raw":"1184996 FCC001173048","row":13}
      const {localId, recordIds} = dataSet;
      // Get Records SRU
      const records = await sruPump(recordIds);
      const transformedRecords = await transformationPump(records, localId, settings);


      const validator = await createValidator(settings.libraryTag.toUpperCase());
      await validationPump(transformedRecords, validationOptions);

      return handleDataTransformation(rest, settings, validationOptions);

      async function sruPump(recordIds, records = [], wait = false) {
        // wait to slow down DoS
        if (wait) {
          await setTimeoutPromise(50);
        }

        const [id, ...rest] = recordIds;

        if (id === undefined) {
          return records;
        }

        try {
          const record = await getRecord(id);
          return sruPump(rest, [...records, record], true);
        } catch (error) {
          logger.error('SRU pump error');
          // console.log(error); // eslint-disable-line

          if (error.payload) {
            logger.error(error.payload);
            Emitter.emit('record', {failed: true, record: id, messages: [error.payload]});
            return sruPump(rest, records, true);
          }

          return sruPump(rest, records, true);
        }
      }

      function transformationPump(records, expectedLocalId, settings, transformedRecords = []) {
        const [record, ...rest] = records;

        if (record === undefined) {
          return transformedRecords;
        }

        //logger.debug('Handling record'); // eslint-disable-line
        //logger.debug(JSON.stringify(record)); // eslint-disable-line

        if (record.containsFieldWithValue('STA', [{code: 'a', value: 'DELETED'}])) {
          Emitter.emit('record', {failed: true, record, messages: [{description: 'Record is already deleted', state: 'invalid'}]});
          return transformationPump(rest, expectedLocalId, settings, transformedRecords);
        }

        const {libraryTag, removeEmptyRecord, handleSubRecords} = settings;

        // Do changes
        const messages = [
          handleSIDs(record, libraryTag, expectedLocalId, settings.kvpUser),
          handleLOWs(record, libraryTag),
          handleTaggedFields(record, libraryTag)
        ].flat();

        logger.debug(JSON.stringify(messages));

        if (messages.some(message => (/SID found for \w+ and it does not match expected \d+/ui).test(message))) {
          Emitter.emit('record', {failed: true, record, messages: [...messages, {description: 'The record has unexpected SIDc value.', state: 'invalid'}]});
          return transformationPump(rest, expectedLocalId, settings, transformedRecords);
        }

        if (removeEmptyRecord && record.get('LOW').length < 1) {
          setRecordDeleted(record);
          return transformationPump(rest, expectedLocalId, settings, [...transformedRecords, record]);
        }

        return transformationPump(rest, expectedLocalId, settings, [...transformedRecords, record]);

        function setRecordDeleted(record) {
          // get leader => char 05 => set d
          var tempLeader = [...record.leader];
          tempLeader[5] = 'd';
          record.leader = tempLeader.join('');
          // insert field STA $a DELETED
          record.insertField({tag: 'STA', subfields: [{code: 'a', value: 'DELETED'}]});
        }
      }

      async function validationPump(records, validationOptions) {
        const [record, ...rest] = records;

        if (record === undefined) {
          return;
        }

        const {validate, fix} = validationOptions;

        try {
          if (validate === true || fix === true) {
            const validationResult = await validator(record, validate, fix);
            // validationResult.record.insertFields(generate884(marcRecord, testRun));
            Emitter.emit('record', validationResult);
            return validationPump(rest, validationOptions);
          }
        } catch (error) {
          logger.info('Unexpected validation error');
          logger.error(error);
          Emitter.emit('record', {failed: true, record, messages: [error]});
          return validationPump(rest, validationOptions);
        }

        Emitter.emit('record', {failed: false, record});

        return validationPump(rest, validationOptions);
      }
    }
  }
};
