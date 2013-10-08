"use strict";

var EventEmitter  = require('events').EventEmitter,
    path          = require('path'),
    q             = require('kew'),
    utils         = require('lodash'),
    resolve       = require('browser-resolve'),
    builtins      = require('browser-builtins'),
    aggregate     = require('stream-aggregate-promise'),
    DGraph        = require('dgraph').Graph,
    watchGraph    = require('dgraph-live'),
    cssImportTr   = require('dgraph-css-import'),
    cssBundler    = require('./bundlers/css'),
    jsBundler     = require('./bundlers/js'),
    common        = require('./common');

/**
 * Compose bundle
 *
 * @param {Array.<String|Module>} entries
 * @param {Options} opts
 */
function Composer(entries, opts) {
  opts = opts || {};

  this.entries = [];

  this.opts = opts;
  this.basedir = opts.basedir || process.cwd();

  this._entries = utils.memoize(this._entries);
  this._graph = utils.memoize(this._graph);
  this._graphIndex = utils.memoize(this._graphIndex);

  [].concat(entries)
    .filter(Boolean)
    .forEach(this._addEntry.bind(this));
}

utils.assign(Composer.prototype, EventEmitter.prototype, {

  /**
   * Add entry
   *
   * @param {Module|String} entry
   * @private
   */
  _addEntry: function(entry) {
    if (utils.isString(entry))
      entry = {id: entry};

    if (utils.isBoolean(entry.expose))
      entry.expose = entry.id;

    this.entries.push(entry);
  },

  /**
   * Resolve single module
   *
   * @private
   */
  _resolve: function(mod) {
    var promise = q.defer(),
        parent = {filename: path.join(mod.basedir || this.basedir, '_fake.js')};
    resolve(mod.id, parent, promise.makeNodeResolver());
    return promise.then(function(id) {
      return utils.assign(mod, {id: id});
    });
  },

  /**
   * Get resolved entries
   *
   * @private
   */
  _entries: function() {
    return q.all(this.entries.map(this._resolve.bind(this)));
  },

  /**
   * Mark composer as updated
   *
   * @private
   */
  _updated: function() {
    this._graphIndex.cache = {};
    this.emit('update');
  },

  /**
   * Create a set of entries into a dependency graph
   *
   * @private
   */
  _graph: function() {
    return this._entries().then(function(entries) {
      var graph = new DGraph(entries, {
          transform: [].concat(this.opts.transform, cssImportTr),
          extensions: this.opts.extensions,
          modules: builtins
        });

      if (this.opts.debug) {
        graph = watchGraph(graph);
        graph.on('update', this._updated.bind(this));
      }

      return graph;
    }.bind(this));
  },

  /**
   * @private
   */
  _graphIndex: function() {
    return this._graph()
      .then(function(graph) { return aggregate(graph.toStream()); })
      .then(common.buildIndex);
  },

  /**
   * Bundle
   */
  bundle: function() {
    return this._graphIndex().then(function(js) {
      var css = common.separateSubgraph(
            js,
            common.matcher(/\.(css|styl|scss|sass|less)/));

      css = common.stubMissingDeps(css);
      js = common.stubMissingDeps(js);
      js[common.dummyModule.id] = common.dummyModule;

      return {
        'bundle.css': cssBundler(css),
        'bundle.js': jsBundler(js, {
          debug: this.opts.debug,
          expose: exposeMap(this.entries)
        })
      }
    }.bind(this));
  }
});

function exposeMap(modules) {
  var expose = {};
  expose[common.dummyModule.id] = common.dummyModule.id;
  modules.forEach(function(mod) {
    if (mod.expose) expose[mod.id] = mod.expose;
  });
  return expose;
}

module.exports = function(entries, opts) {
  return new Composer(entries, opts);
}
module.exports.Composer = Composer;
