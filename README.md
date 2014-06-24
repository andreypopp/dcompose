# dcompose

**WARNING:** dcompose is deprecated, use [webpack](http://webpack.github.io) instead.

CommonJS bundler for javascript and CSS.

What does it mean? It means you can write code which requires other code and...
stylesheets:

    var styles = require('./button.css');
    var dependency = require('./button.js');

    ...

## Installation

    % npm install -g dcompose

## Usage

There is a command line utility `dcompose`:

    % dcompose --help
    Usage: dcompose [options] entry

    Options:
      -h, --help          Show this message and exit
      -v, --version       Print dcompose version
      -d, --debug         Emit source maps
      -w, --watch         Watch for changes and rebuild (--output should be passed)
      -o, --output        Set output directory
      --js                Bundle JS dependencies only
      --css               Bundle CSS dependencies only
      -t, --transform     Apply transform
      --css-transform     Apply CSS transform
      --global-transform  Apply global transform
      --extension         File extensions to treat as modules [default: .js]

Usage from Node.js is also possible:

    var dcompose = require('dcompose');

    dcompose('./entry.js', {debug: true})
      .bundleJS(function(err, bundle) {
        console.log(bundle);
      });

## Usage examples

Produce a bundle:

    % dcompose ./app.js > ./app.bundle.js

You can bundle CSS dependencies separately:

    % dcompose --css ./app.js > ./app.bundle.css

You can bundle JS dependencies separately:

    % dcompose --js ./app.js > ./app.bundle.js

Produce a bundle with source map information (debug mode):

    % dcompose --debug ./app.js > ./app.bundle.js

Produce a bundle and start watching on changes:

    % dcompose --watch --output ./app.bundle.js ./app.js

## Handling CSS dependencies

Regarding javascript dependencies this works exactly like browserify. Regarding
stylesheet dependencies there are two strategies supported by dcompose:

By default CSS dependencies will be wrapped into CommonJS module which will
append stylesheet to a DOM when executed first time. This is not superefficient
but will provide a quick start for prototyping.

Another approach is to bundle CSS dependencies separately, for that there's
`--css` option which will bundle only CSS dependencies from a dependency graph:

    % dcompose --css ./app.js > ./app.bundle.css

After that you can include `app.bundle.css` like you normally would in `<link>`
element.

## API

#### dcompose(entries, opts)

Create a new composer object with the following arguments:

  * `enrties` is a single module specification or an array or those
  * `opts` is an options object

##### Module specification

You can specify a module name which will be resolved using Node modules
resolving mechanism, so "jquery", "./React" or "./lib/router.js" would be
fine.

Alternative you can specify an object of the following shape

    {
      id: string,
      expose: boolean | string,
      entry: boolean,
      source: string | buffer,
      deps: {
        <local module id>: <absolute path to module source>,
        ...
      }
    }

All fields except `id` are optional:

  * `expose` — if `true` when module will be exposed using its `id`, if it's a
    string then it will be used as a public module identifier instead of its
    `id`

  * `entry` — if module should be executed when bundle is loaded (by default
    `true` for all modules in `entries` argument)

  * `source` — module source, if it's specified then module dependencies should
    be also specified

  * `deps` — an object which defined module dependencies in the format of
    mapping from local module ids (those use in `require(...)` calls to absolute
    filenames pointing to the deps' sources

##### Options

  * `transform` — a single transform or an array of transforms, transform is a
    module id which exports transform function or transform function itself.
    Browserify and dgraph transform are supported.

  * `cssTransform` — a single CSS transform or an array of CSS transforms,
    transform is a module id which exports transform function or transform
    function itself. xcss transforms are supported.

  * `extensions` — an array of extensions to use then resolving a `require` with
    no extension provided, by default only `.js` files a re considered.

  * `debug` — emit source maps (works both from CSS and JS)

  * `watch` — start watching for source changes and emit `update` event

#### Events

Composer object is an EventEmitter and emits the following events during
lifecycle:

  * `update` — when an update to code in dependency graph occurs.

#### dcompose.bundle([cb])

Produce bundle of JS and CSS dependencies.

#### dcompose.bundleJS([cb])

Produce bundle of JS dependencies.

#### dcompose.bundleCSS([cb])

Produce bundle of CSS dependencies.
