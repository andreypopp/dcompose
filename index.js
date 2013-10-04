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
function Compose(opts) {
  opts.extensions = ['.js'].concat(opts.extensions || []);

  this.entries = [].concat(opts.entries).map(function(m) {
    if (u.isString(m)) {
      return {unresolvedId: m, entry: true};
    } else {
      m.unresolvedId = m.id;
      return m;
    }
  });
  this.opts = opts || {};
  this.basedir = this.opts.basedir || process.cwd();
  this._expose = {}; // will be computed by Compose::resolveEntries

  this.createGraph = u.memoize(this.createGraph);
  this.processGraph = u.memoize(this.processGraph);
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
        new JSBundler(
            utils.indexToStream(indexes.js),
            {
              expose: this._expose,
              debug: opts.debug,
              prelude: this.prelude
            })
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

    this.processGraph()
      .then(function(indexes) {
        func(indexes, output);
      }.bind(this))
      .fail(onError);

    return output;
  },

  resolveEntries: function() {
    var parent = {filename: path.join(this.basedir, '_fake.js')},
        p = this.entries.map(function(m) {
          return utils.resolve(m.unresolvedId, parent).then(function(id) {
            m.id = id;
            return m;
          });
        });
    return q.all(p).then(function(entries) {
      for (var i = 0, length = entries.length; i < length; i++)
        if (this.entries[i].expose)
          this._expose[entries[i].id] = u.isBoolean(this.entries[i].expose) ?
            this.entries[i].unresolvedId : this.entries[i].expose;
      return entries;
    }.bind(this));
  },

  /**
   * Resolve entries and instantiate graph for them.
   * The returned value will be memorized.
   */
  createGraph: function() {

    return this.resolveEntries()
      .then(function(entries) {
        var graph = new DGraph(entries, {
            transform: [].concat(this.opts.transform, cssImportTr),
            extensions: this.opts.extensions,
            modules: builtins
          });
        if (this.opts.watch || this.opts.watchAll) {
          graph = dgraphlive(graph, {watchAll: this.opts.watchAll});
          graph.on('update', function() {
            this.processGraph.cache = {};
            this.emit('update');
          }.bind(this));
        }
        return graph;
      }.bind(this));
  },

  processGraph: function() {
    return this.createGraph()
      .then(function(graph) {return aggregate(graph.toStream())})
      .then(utils.buildIndex)
      .then(this.layoutGraph.bind(this)).end();
  },

  /**
   * Return a resolved graph as a set of indexes.
   * The returned value will be memorized.
   */
  layoutGraph: function(graph) {
    var css = utils.separateSubgraph(
      graph,
      utils.matcher(/\.(css|styl|scss|sass|less)/));
    return {
      css: utils.stubMissingDeps(css),
      js: utils.stubMissingDeps(graph)
    }
  }

});

module.exports = Compose;
