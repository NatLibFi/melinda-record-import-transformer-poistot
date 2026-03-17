export function handleSIDs(record, libraryTag, expectedLocalId = false, skipLocalSidCheck = false) {
  const libraryTagVariations = [libraryTag.toLowerCase().slice(0, 5), libraryTag.slice(0, 5), libraryTag.toLowerCase(), libraryTag];

  if (!expectedLocalId || skipLocalSidCheck) {
    const fSIDs = libraryTagVariations.map(tag => record.getFields('SID', [{code: 'b', value: tag}])).flat();
    if (fSIDs.length < 1) {
      return [`No SID found for ${libraryTag}`];
    }

    record.removeFields(fSIDs);
    return fSIDs.map(field => `Removed SID ${getSIDfromField(field)} (No local id check)`);
  }

  const fSIDs = libraryTagVariations.map(tag => record.getFields('SID', [{code: 'b', value: tag}, {code: 'c', value: expectedLocalId}])).flat();

  record.removeFields(fSIDs);

  const fUnexpectedSIDs = libraryTagVariations.map(tag => record.getFields('SID', [{code: 'b', value: tag}])).flat();

  if (fUnexpectedSIDs.length > 0) {
    return fUnexpectedSIDs.map(field => `SID ${getSIDfromField(field)} found for ${libraryTag} and it does not match expected ${expectedLocalId}`);
  }

  if (fSIDs.length < 1) {
    return [`No SID found for ${libraryTag} and ${expectedLocalId}`];
  }

  return fSIDs.map(field => `Removed ${getSIDfromField(field)} (Local id check match)`);

  function getSIDfromField(field) {
    const [fSIDvalue] = field.subfields.filter(sub => sub.code === 'c').map(sub => sub.value);
    return fSIDvalue;
  }
}

export function handleLOWs(record, libraryTag) {
  const uppercaseLibraryTag = libraryTag.toUpperCase();
  const fLOWs = record.getFields('LOW', [{code: 'a', value: uppercaseLibraryTag}]);

  if (fLOWs.length < 1) {
    return [`No LOW tag found for ${uppercaseLibraryTag}`];
  }

  record.removeFields(fLOWs);

  return [`Removed LOW tag ${uppercaseLibraryTag}`];
}

// DEV
// Remove ALL fields that have sub $5 libraryTagUC if no other 5s
// await SubfieldExclusion([{tag: /^\d\d\d$/u, subfields: [{code: /5/u, value: new RegExp(`${libraryTagUC}`, 'u')}]}]),;
// Kun poistetaan tietokantatunnusta X, ja tietueessa on vaihtuvamittainen kenttä, jossa on osakenttä $5 sisältönään X,
// jos kyseisessä kentässä ei ole muita osakenttiä $5, poistetaan kyseinen kenttä kokonaan
// jos kentässä on muita osakenttä $5, poistetaan osakenttä $5 X;
export function handleTaggedFields(record, libraryTag) {
  const libraryTagVariations = [libraryTag.toUpperCase().slice(0, 5), libraryTag.slice(0, 5), libraryTag.toUpperCase(), libraryTag];
  const taggedFields = record.get(/\d\d\d/u)
    .filter(field => field.subfields && field.subfields
      .some(sub => sub.code === '5' && libraryTagVariations.includes(sub.value)));

  if (taggedFields.length < 1) {
    // console.log('No tagged fields found'); // eslint-disable-line
    return [`No tagged fields found for ${libraryTag}`];
  }
  // console.log('found tagged field'); // eslint-disable-line

  return taggedFields.map(field => {
    const newField = {...field};
    record.removeFields([field]);
    const sub5s = newField.subfields.filter(sub => sub.code === '5');

    if (sub5s.length === 1) {
      // console.log('Removed tagged field'); // eslint-disable-line
      return `Removed tagged field ${libraryTag}`;
    }

    // console.log('Removing tagged subfield'); // eslint-disable-line

    newField.subfields = newField.subfields.filter(sub => {
      const taggedSubfield = sub.code === '5' && libraryTagVariations.includes(sub.value);
      return !taggedSubfield;
    });
    record.insertField(newField);
    return `Dropped tagged subfield 5 ${libraryTag} from field`;
  });
}
