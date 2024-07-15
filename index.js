import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ask } from './src/commands/ask.js';
import { clear } from './src/commands/clear.js';
import { scan } from './src/commands/scan.js';

yargs(hideBin(process.argv))
    .command('ask', 'Ask Codebase', {}, ask)
    .command('scan', 'Scan files & create vector store', {}, scan)
    .command('clear', 'Clear the vector store', {}, clear)
    .demandCommand(1, 'You need to specify a command')
    .strict()
    .help()
    .argv;
