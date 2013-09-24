"use strict";

var path          = require('path'),
    EventEmitter  = require('events').EventEmitter,
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
  this._expose = {}; // will be computed by Compose::_entries

  this._entries = utils.memoize(this._entries);
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
        new JSBundler(indexToStream(indexes.js), {
            expose: this._expose, debug: opts.debug})
          .through(insertGlobals({basedir: this.basedir}))
          .inject({id: '__dummy__', source: ''}, {expose: true})
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
        p = this.entries.map(function(m) {return resolve(m.id || m, parent);});
    return q.all(p).then(function(entries) {
      for (var i = 0, length = entries.length; i < length; i++)
        if (this.entries[i].expose)
          this._expose[entries[i]] = utils.isBoolean(this.entries[i].expose) ?
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
        var graph = buildIndex(modules),
            css = separateSubgraph(graph, matcher(/\.(css|styl|scss|sass|less)/));
        return {
          css: stubMissedDependencies(css),
          js: stubMissedDependencies(graph)
        }
      }.bind(this));
  },
});

function matcher(regexp) {
  return regexp.exec.bind(regexp);
}

function stubMissedDependencies(graph) {
  for (var id in graph)
    for (var dep in graph[id].deps)
      if (!graph[graph[id].deps[dep]])
        graph[id].deps[dep] = '__dummy__';
  return graph;
}

function separateSubgraph(graph, predicate) {
  var subgraph = {};
  for (var id in graph)
    if (predicate(id)) {
      subgraph[id] = graph[id];
      delete graph[id];
    }
  return subgraph;
}

function buildIndex(modules) {
  var graph = {};
  for (var i = 0, length = modules.length; i < length; i++)
    graph[modules[i].id] = utils.cloneDeep(modules[i]);
  return graph;
}

function resolve(id, parent) {
  var promise = q.defer();
  resolveCb(id, parent, promise.makeNodeResolver());
  return promise;
}

function indexToStream(index) {
  return asStream.apply(null, utils.values(index));
}

module.exports = Compose;
