"use strict";

var path          = require('path'),
    EventEmitter  = require('events').EventEmitter,
    u             = require('lodash'),
    q             = require('kew'),
    through       = require('through'),
    aggregate     = require('stream-aggregate-promise'),
    combine       = require('stream-combiner'),
    builtins      = require('browser-builtins'),
    insertGlobals = require('insert-module-globals'),
    depsSort      = require('deps-sort'),
    cssPack       = require('css-pack'),
    DGraph        = require('dgraph').Graph,
    dgraphlive    = require('dgraph-live'),
    cssImportTr   = require('dgraph-css-import'),
    JSBundler     = require('dgraph-bundler').Bundler,
    utils         = require('./utils');

/**
 * @param entries {Array|String}
 * @param opts {Object}
 */
function Compose(entries, opts) {
  if (arguments.length === 1 && u.isObject(entries)) {
    opts = entries;
    entries = opts.entries;
  }

  opts.extensions = ['.js'].concat(opts.extensions || []);

  this.entries = [].concat(entries);
  this.opts = opts || {};
  this.basedir = this.opts.basedir || process.cwd();
  this._expose = {}; // will be computed by Compose::_entries

  this._entries = u.memoize(this._entries);
  this._graph = u.memoize(this._graph);
  this._indexes = u.memoize(this._indexes);
}

u.assign(Compose.prototype, EventEmitter.prototype, {

  /**
   * Return JS bundle as a stream.
   * @param {Object} opts
   */
  js: function(opts) {
    opts = opts || {};
    return this._createOutput(function(indexes, output) {
      combine(
        new JSBundler(utils.indexToStream(indexes.js), {
            expose: this._expose, debug: opts.debug})
          .through(insertGlobals({basedir: this.basedir}))
          .inject(utils.dummyModule, {expose: true})
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
        utils.indexToStream(indexes.css),
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
        onError = function(err) { output.emit('error', err); };

    this._indexes()
      .then(function(indexes) {
        func(indexes, output);
      }.bind(this))
      .fail(onError);

    return output;
  },

  _entries: function() {
    var parent = {filename: path.join(this.basedir, '_fake.js')},
        p = this.entries.map(function(m) {return utils.resolve(m.id || m, parent);});
    return q.all(p).then(function(entries) {
      for (var i = 0, length = entries.length; i < length; i++)
        if (this.entries[i].expose)
          this._expose[entries[i]] = u.isBoolean(this.entries[i].expose) ?
            this.entries[i].id : this.entries[i].expose;
      return entries;
    }.bind(this));
  },

  /**
   * Resolve entries and instantiate graph for them.
   * The returned value will be memorized.
   */
  _graph: function() {

    return this._entries()
      .then(function(entries) {
        var graph = new DGraph(entries, {
            transform: [].concat(this.opts.transform, cssImportTr),
            extensions: this.opts.extensions,
            modules: builtins
          });
        if (this.opts.watch) {
          graph = dgraphlive(graph);
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
        var graph = utils.buildIndex(modules),
            css = utils.separateSubgraph(graph, utils.matcher(/\.(css|styl|scss|sass|less)/));
        return {
          css: utils.stubMissingDeps(css),
          js: utils.stubMissingDeps(graph)
        }
      }.bind(this));
  },
});

module.exports = Compose;
