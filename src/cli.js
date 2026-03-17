import fs from 'fs';
import yargs from 'yargs';
import transformFactory from './transform/index.js';
import moment from 'moment';
import {transformerCliLogic} from '@natlibfi/melinda-record-import-commons';
import * as config from './config.js';

cli();

async function cli() {
  const args = yargs(process.argv.slice(2))
    .scriptName('melinda-record-import-removal')
    .epilog('Copyright (C) 2018-2022 University Of Helsinki (The National Library Of Finland)')
    .usage('$0 <file> [options] and env variable info in README')
    .showHelpOnFail(true)
    .example([
      ['$ node $0/dist/cli.js file.json -rfv true -d transformed/'],
      ['$ node $0/dist/cli.js file.json -rv true -f false -d transformed/'],
      ['$ node $0/dist/cli.js  -r true -d transformed/ file.json']
    ])
    .env('TRANSFORM_REMOVAL')
    .positional('file', {type: 'string', describe: 'File to transform'})
    .options({
      v: {type: 'boolean', default: false, alias: 'validate', describe: 'Validate records'},
      f: {type: 'boolean', default: false, alias: 'fix', describe: 'Validate & fix records'},
      r: {type: 'boolean', default: false, alias: 'recordsOnly', describe: 'Write only record data to output (Invalid records are excluded)'},
      d: {type: 'string', alias: 'outputDirectory', describe: 'Output directory where each record file is written (Applicable only with `recordsOnly`'}
    })
    .check((args) => {
      const [file] = args._;
      if (file === undefined) {
        throw new Error('No file argument given');
      }

      if (!fs.existsSync(file)) {
        throw new Error(`File ${file} does not exist`);
      }

      return true;
    })
    .parseSync();

  const transform = transformFactory({...config, moment});
  await transformerCliLogic(args, transform);
}
