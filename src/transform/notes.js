export function removeLocalReference(record, opts) {

  const {libraryTag, expectedLocalId, skipLocalSidCheck, bypassSIDdeletion} = opts;

  if (libraryTag === undefined) {
    throw new Error('Mandatory option missing: libraryTag');
  }

  return new Promise((resolve, reject) => {
    const report = [];

    if (record.containsFieldWithValue('STA', [{code: 'a', value: 'DELETED'}])) {
      return reject(new Error('Tietue oli jo poistettu.'));
    }

    if (expectedLocalId && !validateLocalSid(record, libraryTag, expectedLocalId.toString())) {
      return reject(new Error('The record has unexpected SID c value.'));
    }

    removeSIDFields(record, report, libraryTag, expectedLocalId, skipLocalSidCheck, bypassSIDdeletion);
    removeLOWFields(record, report, libraryTag);

    cleanupRecord(record, report, libraryTag);

    return resolve({record, report});
  });
}

function validateLocalSid(record, libraryTag, expectedLocalId) {
  const lowercaseLibraryTag = libraryTag.toLowerCase();
  return record.getFields('SID', [{code: 'b', value: lowercaseLibraryTag}])
    .every(field => {
      const subfield_c = field.subfields.filter(subfield => subfield.code === 'c');
      return subfield_c.every(subfield => {
        if (subfield.value.startsWith('FCC')) {
          return true;
        }
        return subfield.value == expectedLocalId;
      });

    });
}

function removeSIDFields(record, report, libraryTag, expectedLocalId, skipLocalSidCheck, bypassSIDdeletion) {

  if (bypassSIDdeletion) {
    report.push('Mahdollinen SID säilytetty replikointia varten');
    return;
  }

  if (expectedLocalId === undefined && skipLocalSidCheck !== true) {
    return;
  }

  const fieldsToRemove = getSIDFieldsForRemoval(record, libraryTag, expectedLocalId, skipLocalSidCheck);

  fieldsToRemove.forEach(field => {
    const removedLibraryTag = getSubfieldValues(field, 'b').join(',');
    report.push(`Poistettu SID: ${removedLibraryTag}`);
  });

  record.fields = _.difference(record.fields, fieldsToRemove);

}

function getSIDFieldsForRemoval(record, libraryTag, expectedLocalId, skipLocalSidCheck) {

  const lowercaseLibraryTag = libraryTag.toLowerCase();

  if (skipLocalSidCheck) {
    return record.getFields('SID', [{code: 'b', value: lowercaseLibraryTag}]);
  } else {
    const normalizedExpectedLocalId = expectedLocalId.toString();
    return record.getFields('SID', [{code: 'b', value: lowercaseLibraryTag}, {code: 'c', value: normalizedExpectedLocalId}]);
  }
}

function removeLOWFields(record, report, libraryTag) {
  const uppercaseLibraryTag = libraryTag.toUpperCase();
  const fieldsToRemove = record.getFields('LOW', [{code: 'a', value: uppercaseLibraryTag}]);

  fieldsToRemove.forEach(field => {
    const removedLibraryTag = getSubfieldValues(field, 'a').join(',');
    report.push(`Poistettu LOW: ${removedLibraryTag}`);
  });

  if (fieldsToRemove.length === 0) {
    report.push('Tietueessa ei ollut LOW-kenttää.');
  }

  record.fields = _.difference(record.fields, fieldsToRemove);

}

function cleanupRecord(record, report, libraryTag) {

  record.getDatafields()
    .filter(withSubfield('5'))
    .forEach((field) => {
      const subfield5List = getSubfields(field, '5');

      if (subfield5List.length === 1) {
        if (subfield5List[0].value === libraryTag.toUpperCase()) {
          removeField(record, field);
          report.push(`Poistettu kenttä ${field.tag}`);
        }
      }

      if (subfield5List.length > 1) {
        subfield5List.filter(sub => sub.value === libraryTag.toUpperCase()).forEach(subfield => {
          removeSubfield(record, field, subfield);
          report.push(`Poistettu osakenttä $5 (${subfield.value}) kentästä ${field.tag}`);
        });
      }
    });

  record.getDatafields()
    .filter(withSubfield('9'))
    .forEach((field) => {
      const subfield9List = getSubfields(field, '9');

      subfield9List.filter(replicationCommandMatcher(libraryTag)).forEach(subfield => {
        removeSubfield(record, field, subfield);
        report.push(`Poistettu osakenttä $9 (${subfield.value}) kentästä ${field.tag}`);
      });

    });
}

function replicationCommandMatcher(libraryTag) {
  const ucTag = libraryTag.toUpperCase();
  const patterns = [`${ucTag} <KEEP>`, `${ucTag} <DROP>`];

  return function (subfield) {
    return patterns.some(pattern => pattern === subfield.value);
  };
}

function removeField(record, field) {
  record.removeFields([field]);
}
function removeSubfield(record, field, subfield) {
  field.subfields = _.without(field.subfields, subfield);
}

function withSubfield(code) {
  return function (field) {
    return field.subfields.some(sub => sub.code === code);
  };
}

function getSubfieldValues(field, code) {
  return getSubfields(field, code).map(sub => sub.value);
}

function getSubfields(field, code) {
  return field.subfields.filter(sub => sub.code === code);
}