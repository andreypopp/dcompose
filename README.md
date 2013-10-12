# dcompose

CommonJS bundler for a browser.

## Installation

    % npm install -g dcompose

## Usage

    % dcompose --help
    Usage: dcompose [options] entry

    Options:
      -h, --help       Show this message and exit
      -v, --version    Show version and exit
      -q, --quite      Suppress progress and warning messages
      --verbose        Show debug messages
      --no-color       No color output

      -d, --debug      Emit source maps
      -o, --output     Set output directory
      -w, --watch      Watch for changes and rebuild bundles
                       (-o/--output must be supplied)

      -t, --transform  Apply transform
      --extension      File extensions to treat as modules (default: .js)

      --bundle-js      Produce bundle of JS dependency graph only
                       (this is the default behaviour)
      --bundle-css     Produce bundle of CSS dependency graph only
      --bundle-all     Produce bundle of both CSS and JS dependency graphs
                       (-o/--output must be supplied)

      --splitted       Produce splitted bundle (-o/--output must be supplied)

## Usage examples

Bundle JS dependencies:

    % dcompose ./app.js > ./app.bundle.js
    progress: bundling JS dependencies

If there are CSS dependencies in the bundle then the warning will be issued:

    % dcompose ./app.js > ./app.bundle.js
    warning: CSS dependencies detected, bundle them with "dcompose --bundle-css"
    progress: bundling JS dependencies

You can bundle CSS dependencies subgraph using --bundle-css option:

    % dcompose --bundle-css ./app.js > ./app.bundle.css
    progress: bundling CSS dependencies

Or you can bundle both JS and CSS dependencies, by default bundles will be
created in the current directory:

    % dcompose --bundle-all ./app.js
    bundling JS dependencies into: ./app.bundle.js
    bundling CSS dependencies into: ./app.bundle.css

You can override the output directory with --output option:

    % dcompose --bundle-all --option ./build ./app.js
    bundling JS dependencies into: ./build/app.bundle.js
    bundling CSS dependencies into: ./build/app.bundle.css

## API

*dcompose(entries, opts)*

  * *enrties* a single module specification or an array or those
  * *opts* an object of options
