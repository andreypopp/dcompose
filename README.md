# dcompose

CommonJS bundler for a browser.

## Installation

    % npm install -g dcompose

## Usage

    % dcompose --help
    Usage: dcompose [options] entry

    Options:
      -h, --help       Show this message and exit
      -d, --debug      Emit source maps
      -o, --output     Set output directory
      -t, --transform  Apply transform
      --extension      File extensions to treat as modules (default: .js)

## API

*dcompose(entries, opts)*

  * *enrties* a single module specification or an array or those
  * *opts* an object of options
