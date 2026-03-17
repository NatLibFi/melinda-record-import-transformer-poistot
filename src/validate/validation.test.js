import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';
import {MarcRecord} from '@natlibfi/marc-record';

import createValidator from './index.js';

describe('Validation spec', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'validation'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    }
  });

  async function callback({
    getFixture,
    libraryTag,
    expectToFail = false,
    expectedFailStatus = 200
  }) {
    try {
      const record = new MarcRecord(getFixture('record.json'));
      const expectedResult = getFixture('expectedResult.json');
      const validator = await createValidator(libraryTag.toUpperCase());

      const {failed, messages} = await validator(record, true, true);

      // console.log(JSON.stringify(record)); // eslint-disable-line
      assert.deepStrictEqual({failed, messages}, expectedResult);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      // console.log(error);  // eslint-disable-line
      assert.equal(expectToFail, true, 'This is expected to fail');
      assert(error instanceof ApiError);
      assert.equal(error.status, expectedFailStatus);
    }
  }
});

