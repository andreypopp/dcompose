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
    cssImports    = require('dgraph-css-import'),
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

  this._graph = utils.memoize(this._graph);
  this._graphs = utils.memoize(this._graphs);

  [].concat(entries)
    .filter(Boolean)
    .forEach(this._addEntry.bind(this));
}

utils.assign(Composer.prototype, EventEmitter.prototype, {

  /**
   * Add an entry module
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
   * Resolve a single module
   *
   * @param {Module} mod
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
   * Mark composer as updated
   *
   * @private
   */
  _updated: function(filename) {
    this._graphs.cache = {};
    this.emit('update', filename);
  },

  /**
   * Create a dependency graph
   *
   * @private
   */
  _graph: function() {
    return q.all(this.entries.map(this._resolve.bind(this)))
      .then(function(entries) {
        var graph = new DGraph(entries, {
            transformKey: ["browserify", "transform"],
            transform: [].concat(this.opts.transform, cssImports),
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
   * Separate graph into JS and CSS subgraphs
   *
   * @private
   */
  _graphs: function(graph) {
    return this._graph()
      .then(function(graph) { return aggregate(graph.toStream()); })
      .then(common.buildIndex)
      .then(function(graph) {
        var js = utils.clone(graph),
            css = common.separateSubgraph(js, common.isCSS);
        return {
          js: common.stubMissingDeps(js),
          css: common.stubMissingDeps(css)
        };
      }.bind(this));
  },

  _bundleCSS: function(graph) {
    return cssBundler(graph);
  },

  _bundleJS: function(graph) {
    return jsBundler(graph, {
      debug: this.opts.debug,
      expose: common.exposeMap(this.entries)
    });
  },

  /**
   * Bundle
   */
  all: function(cb) {
    var streams = this._graphs().then(function(graph) {
      var bundles = {},
          name = path.basename(this.entries[0].id).replace(/\..*$/, '');
      bundles[name + '.bundle.css'] = this._bundleCSS(graph.css);
      bundles[name + '.bundle.js'] = this._bundleJS(graph.js);
      return bundles;
    }.bind(this));

    common.thenCallback(streams, cb);
    return streams;
  },

  js: function(cb) {
    var stream = this._graphs().then(function(graph) {
      return this._bundleJS(graph.js);
    }.bind(this));

    common.thenCallback(stream, cb);

    return stream;
  },

  css: function(cb) {
    var stream = this._graphs().then(function(graph) {
      return this._bundleCSS(graph.css);
    }.bind(this));

    common.thenCallback(stream, cb);

    return stream;
  }
});

module.exports = function(entries, opts) {
  return new Composer(entries, opts);
}
module.exports.Composer = Composer;
