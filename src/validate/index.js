import validateFactory from '@natlibfi/marc-record-validate';
import {
  SubfieldExclusion
} from '@natlibfi/marc-record-validators-melinda';

export default async (libraryTagUC) => {
  const validate = validateFactory([
    await SubfieldExclusion([
      {tag: /^\d[1-9]\d$/u, subfields: [{code: /9/u, value: new RegExp(`${libraryTagUC}<KEEP>`, 'u')}]},
      {tag: /^\d[1-9]\d$/u, subfields: [{code: /9/u, value: new RegExp(`${libraryTagUC} <KEEP>`, 'u')}]}
    ]),
    await SubfieldExclusion([
      {tag: /^\d[1-9]\d$/u, subfields: [{code: /9/u, value: new RegExp(`${libraryTagUC}<DROP>`, 'u')}]},
      {tag: /^\d[1-9]\d$/u, subfields: [{code: /9/u, value: new RegExp(`${libraryTagUC} <DROP>`, 'u')}]}
    ])
  ]);

  return async (record, fix, validateFixes) => {
    const opts = fix ? {fix, validateFixes} : {fix};
    const result = await validate(record, opts);
    return {
      record: result.record,
      failed: result.valid === false,
      messages: result.report
    };
  };
};
