"use strict";

var EventEmitter  = require('events').EventEmitter,
    through       = require('through'),
    path          = require('path'),
    q             = require('kew'),
    combine       = require('stream-combiner'),
    utils         = require('lodash'),
    resolve       = require('browser-resolve'),
    builtins      = require('browser-builtins'),
    aggregate     = require('stream-aggregate-promise'),
    aggregateCb   = require('stream-aggregate'),
    DGraph        = require('dgraph').Graph,
    watchGraph    = require('dgraph-live'),
    cssImports    = require('dgraph-css-import'),
    xcss          = require('xcss').bundle,
    jsBundler     = require('./jsbundler'),
    cssModule     = require('./css-module'),
    common        = require('./common');

/**
 * Compose bundle
 *
 * @param {Array.<String|Module>} entries
 * @param {Options} opts
 */
function Composer(entries, opts) {
  opts = opts || {};
  opts.transform = []
    .concat(opts.transform)
    .filter(Boolean)
    .map(common.resolveTransform);
  opts.cssTransform = []
    .concat(opts.cssTransform)
    .filter(Boolean)
    .map(common.resolveTransform);
  opts.globalTransform = []
    .concat(opts.globalTransform)
    .filter(Boolean)
    .map(common.resolveTransform);

  this.opts = opts;
  this.basedir = opts.basedir || process.cwd();
  this.entries = [];

  [].concat(entries)
    .filter(Boolean)
    .forEach(this._addEntry.bind(this));

  this._graph = utils.memoize(this._graph);
  this._dependencies = this._makeGraph();
}

function makeBundler(func) {
  return function(cb) {
    var output = through();
    output.asPromise = function() { return aggregate(output); };
    this._graph()
      .then(func.bind(this))
      .then(function(stream) {
        stream
          .on('error', output.emit.bind(output, 'error'))
          .pipe(output);
      })
      .fail(output.emit.bind(output, 'error'))

    return cb ? aggregateCb(output, cb) : output;
  }
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
    this._graph.cache = {};
    this.emit('update', filename);
  },

  /**
   * Create a dependency graph
   *
   * @private
   */
  _makeGraph: function() {
    return q.all(this.entries.map(this._resolve.bind(this)))
      .then(function(entries) {
        var graph = new DGraph(entries, {
            transformKey: ["browserify", "transform"],
            transform: [].concat(this.opts.transform),
            globalTransform: [].concat(this.opts.globalTransform, cssImports),
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

  _graph: function() {
    return this._dependencies
      .then(function(deps) { return deps.toPromise(); })
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
    return combine(common.graphToStream(graph), xcss({
      debug: this.opts.debug,
      transform: this.opts.cssTransform
    }));
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
    var streams = this._graph().then(function(graph) {
      var bundles = {},
          name = path.basename(this.entries[0].id).replace(/\..*$/, '');
      bundles[name + '.bundle.css'] = this._bundleCSS(graph.css);
      bundles[name + '.bundle.js'] = this._bundleJS(graph.js);
      return bundles;
    }.bind(this));

    common.thenCallback(streams, cb);
    return streams;
  },

  bundle: makeBundler(function(graph) {
    return aggregate(this._bundleCSS(graph.css)).then(function(css) {
      graph = utils.clone(graph.js);
      return this._bundleJS(utils.assign({
        '__dcompose_styles__': {
          id: '__dcompose_styles__',
          source: cssModule(css),
          entry: true
        }
      }, graph));
    }.bind(this));
  }),

  bundleJS: makeBundler(function(graph) {
    return this._bundleJS(graph.js);
  }),

  bundleCSS: makeBundler(function(graph) {
    return this._bundleCSS(graph.css);
  })
});

module.exports = function(entries, opts) {
  return new Composer(entries, opts);
}
module.exports.Composer = Composer;
