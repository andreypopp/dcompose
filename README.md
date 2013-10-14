# dcompose

CommonJS bundler for a browser.

## Installation

    % npm install -g dcompose

## Usage

    % dcompose --help
    Usage: dcompose [options] entry

    Options:
      -h, --help       Show this message and exit

      -o, --output     Set output directory
      -w, --watch      Watch for changes and rebuild bundles
                       (-o/--output must be supplied)

      -d, --debug      Produce bundle with source maps
      --graph          Produce only dependency graph and pring it on stdout

      -t, --transform  Apply transform
      --extension      File extensions to treat as modules [default: .js]

      --js             Produce bundle of JS dependency graph only
                       (this is the default behaviour)
      --css            Produce bundle of CSS dependency graph only
      --all            Produce bundle of both CSS and JS dependency graphs
                       (-o/--output must be supplied)

      --splitted       Produce splitted bundle (-o/--output must be supplied)

## Usage examples

Bundle JS dependencies:

    % dcompose ./app.js > ./app.bundle.js
    progress: bundling JS dependencies

If there are CSS dependencies in the bundle then the warning will be issued:

    % dcompose ./app.js > ./app.bundle.js
    warning: CSS dependencies detected, bundle them with "dcompose --css"
    progress: bundling JS dependencies

You can bundle CSS dependencies subgraph using --css option:

    % dcompose --css ./app.js > ./app.bundle.css
    progress: bundling CSS dependencies

Or you can bundle both JS and CSS dependencies, by default bundles will be
created in the current directory:

    % dcompose --all ./app.js
    bundling JS dependencies into: ./app.bundle.js
    bundling CSS dependencies into: ./app.bundle.css

You can override the output directory with --output option:

    % dcompose --all --output ./build ./app.js
    bundling JS dependencies into: ./build/app.bundle.js
    bundling CSS dependencies into: ./build/app.bundle.css

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

  * transform
  * extensions

#### Events

Composer object is an EventEmitter and emits the following events during
lifecycle:

  * `dep` — when any dependency encountered whild dependency resolution process
  * `graphReady` — when dependency graph is ready

#### dcompose.graph([cb])

Produce dependency graph.

#### dcompose.js([cb])

Produce bundle of JS dependencies.

#### dcompose.css([cb])

Produce bundle of CSS dependencies.

#### dcompose.all([cb])

Produce bundle of JS and CSS dependencies.
