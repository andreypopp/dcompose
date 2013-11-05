module.exports = require('optimist')
    .usage('Usage: dcompose [options] entry')
    .option('h', {
      alias: 'help',
      boolean: true,
      describe: 'Show this message and exit'
    })
    .option('v', {
      alias: 'version',
      boolean: true,
      describe: 'Print dcompose version and exit'
    })
    .option('d', {
      alias: 'debug',
      boolean: true,
      describe: 'Emit source maps'
    })
    .option('w', {
      alias: 'watch',
      boolean: true,
      describe: 'Watch for changes and rebuild (-o/--output is required)'
    })
    .option('o', {
      alias: 'output',
      describe: 'Set output directory'
    })
    .option('js', {
      describe: 'Bundle JS dependencies only',
      boolean: true
    })
    .option('css', {
      boolean: true,
      describe: 'Bundle CSS dependencies only'
    })
    .option('t', {
      alias: 'transform',
      describe: 'Apply transform'
    })
    .option('css-transform', {
      describe: 'Apply CSS transform'
    })
    .option('global-transform', {
      describe: 'Apply global transform'
    })
    .option('extension', {
      describe: 'File extensions to treat as modules [default: .js]'
    });
