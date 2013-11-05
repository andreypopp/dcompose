"use strict";

var entry = require('optimist')
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

function run(argv) {
  argv = argv || entry.argv;

  if (argv.help)
    return entry.showHelp();

  if (argv.version)
    return console.log(version);

  if (argv._.length === 0)
    error('provide bundle entry module as an argument', true);

  if (argv.watch && !argv.output)
    error('provide output via -o/--output option', true);

  var output = argv.output || argv.o;
  var transform = [].concat(argv.t).concat(argv.transform);
  var cssTransform = argv['css-transform'];
  var globalTransform = argv['global-transform'];

  var fs          = require('fs'),
      combine     = require('stream-combiner'),
      common      = require('./common'),
      version     = require('./package.json').version,
      dcompose    = require('./index');

  var composer = dcompose(argv._, {
    transform: transform,
    cssTransform: cssTransform,
    globalTransform: globalTransform,
    extensions: [].concat(argv.extension).filter(Boolean),
    debug: argv.debug,
    watch: argv.watch
  });

  if (argv.watch) {
    console.log('starting to watch for source changes');
    composer.on('update', function() {
      console.log('source change detected, rebuilding bundle');
      bundle();
    });
  }

  bundle();

  function bundle() {
    var out = output ? fs.createWriteStream(output) : process.stdout;
    if (argv.js)
      combine(composer.bundleJS(), out)
    else if (argv.css)
      combine(composer.bundleCSS(), out)
    else
      combine(composer.bundle(), out);
  }
}

function error(msg, showHelp) {
  if (showHelp) entry.showHelp();
  console.warn('error: ', msg);
  process.exit(1);
}

module.exports = {run: run, entry: entry};
