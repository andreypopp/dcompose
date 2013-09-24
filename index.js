"use strict";

var EventEmitter  = require('events').EventEmitter,
    utils         = require('lodash'),
    q             = require('kew'),
    through       = require('through'),
    asStream      = require('as-stream'),
    aggregate     = require('stream-aggregate-promise'),
    combine       = require('stream-combiner'),
    resolveCb     = require('browser-resolve'),
    builtins      = require('browser-builtins'),
    insertGlobals = require('insert-module-globals'),
    depsSort      = require('deps-sort'),
    cssPack       = require('css-pack'),
    DGraph        = require('dgraph').Graph,
    DGraphLive    = require('dgraph-live'),
    cssImportTr   = require('dgraph-css-import'),
    JSBundler     = require('dgraph-bundler').Bundler;

/**
 * @param entries {Array|String}
 * @param opts {Object}
 */
function Compose(entries, opts) {
  if (arguments.length === 1 && utils.isObject(entries)) {
    opts = entries;
    entries = opts.entries;
  }

  this.entries = [].concat(entries);
  this.opts = opts || {};
  this.basedir = this.opts.basedir || process.cwd();

  this._graph = utils.memoize(this._graph);
  this._indexes = utils.memoize(this._indexes);
}

utils.assign(Compose.prototype, EventEmitter.prototype, {

  /**
   * Return JS bundle as a stream.
   * @param {Object} opts
   */
  js: function(opts) {
    opts = opts || {};
    return this._createOutput(function(indexes, output) {
        combine(
          new JSBundler(indexes.js, {debug: opts.debug})
            .through(insertGlobals({basedir: this.basedir}))
            .toStream(),
          output);
    }.bind(this));
  },

  /**
   * Return CSS bundle as a stream.
   * @param {Object} opts
   */
  css: function(opts) {
    opts = opts || {};
    return this._createOutput(function(indexes, output) {
      combine(
        indexToStream(indexes.css),
        depsSort(),
        cssPack(),
        output);
    }.bind(this));
  },

  all: function(opts) {
    return {js: this.js(opts), css: this.css(opts)};
  },

  /**
   * Convenience to create and setup an output stream for an index
   */
  _createOutput: function(func) {
    var output = through(),
        onError = output.emit.bind(output, 'error');

    this._indexes()
      .then(function(indexes) {
        func(indexes, output);
      }.bind(this))
      .fail(onError);

    return output;
  },

  /**
   * Resolve entries and instantiate graph for them.
   * The returned value will be memorized.
   */
  _graph: function() {
    var parent = {filename: this.basedir},
        promises = this.entries.map(function(id) {return resolve(id, parent)}),
        entries = q.all(promises);

    return entries
      .then(function(entries) {
        var graphCls = this.opts.watch ? DGraphLive : DGraph,
            graph = new graphCls(entries, {
              transform: [].concat(this.opts.transform, cssImportTr),
              extensions: this.opts.extensions,
              modules: builtins
            });
        if (this.opts.watch) {
          graph.on('update', function() {
            this._indexes.cache = {};
            this.emit('update');
          }.bind(this));
        }
        return graph;
      }.bind(this));
  },

  /**
   * Return a resolved graph as a set of indexes.
   * The returned value will be memorized.
   */
  _indexes: function() {
    return this._graph()
      .then(function(graph) {
        return aggregate(graph.toStream());
      }.bind(this))
      .then(function(modules) {
        var js = {},
            css = {};
        modules.forEach(function(mod) {
          if (mod.id.match(/\.(css|styl|less|sass|scss)$/)) {
            css[mod.id] = mod;
          } else {
            js[mod.id] = mod;
          }
        });
        return {js: js, css: css};
      }.bind(this));
  },
});

function resolve(id, parent) {
  var promise = q.defer();
  resolveCb(id, parent, promise.makeNodeResolver());
  return promise;
}

function indexToStream(index) {
  return asStream.call(null, utils.values(index));
}

module.exports = Compose;
