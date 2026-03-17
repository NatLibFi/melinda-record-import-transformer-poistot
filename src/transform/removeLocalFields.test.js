import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';
import {MarcRecord} from '@natlibfi/marc-record';

import {handleSIDs, handleLOWs, handleTaggedFields} from './removeLocalFields.js';

generateTests({
  callback,
  path: [import.meta.dirname, '..', '..', 'test-fixtures', 'removeLocalFields'],
  recurse: true,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: true,
    reader: READERS.JSON
  }
});

function callback({
  getFixture,
  method,
  libraryTag,
  expectedLocalId = false,
  skipLocalSidCheck = false,
  expectToFail = false,
  expectedFailStatus = 200
}) {
  try {
    const record = new MarcRecord(getFixture('record.json'));
    const expectedResult = getFixture('expectedResult.json');
    const expectedRecordResult = new MarcRecord(getFixture('expectedRecordResult.json'));
    let result;

    if (method === 'handleSIDs') {
      result = handleSIDs(record, libraryTag, expectedLocalId, skipLocalSidCheck);
    }

    if (method === 'handleLOWs') {
      result = handleLOWs(record, libraryTag);
    }

    if (method === 'handleTaggedFields') {
      result = handleTaggedFields(record, libraryTag);
    }

    // console.log(JSON.stringify(record)); // eslint-disable-line
    assert.deepStrictEqual(record, expectedRecordResult);
    assert.deepStrictEqual(result, expectedResult);
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
