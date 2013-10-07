var utils         = require('lodash'),
    browserPack   = require('browser-pack'),
    through       = require('through'),
    insertGlobals = require('insert-module-globals'),
    depsSort      = require('deps-sort'),
    combine       = require('stream-combiner'),
    common        = require('../common');

/**
 * Bundle graph of javascript dependencies
 *
 * @param {Graph} graph
 * @param {Options} opts
 *  @property {Boolean} debug
 *  @property {Object} expose
 *  @property {String} prelude
 */
module.exports = function(graph, opts) {
  var pipeline = [common.graphToStream(graph)];

  if (opts.debug)
    pipeline.push(insertDebugInfo());

  pipeline = pipeline.concat([
    mangleModuleNames(opts.expose),
    depsSort(),
    browserPack({raw: true, prelude: opts.prelude}),
    wrapBundle()
  ]);

  return combine.apply(null, pipeline);
}

function wrapBundle() {
  var seen = false;
  return through(
    function(chunk) {
      if (!seen) {
        seen = true;
        this.queue('require = ');
      }
      this.queue(chunk);
    },
    function() {
      if (!seen) {
        seen = true;
        this.queue('require = ');
      }
      this.queue('\n;');
      this.queue(null);
    });
}

function mangleModuleNames(expose) {
  expose = expose || {};
  return through(function(mod) {
    mod = utils.cloneDeep(mod);
    if (expose[mod.id])
      mod.id = expose[mod.id];
    else
      mod.id = common.hash(mod.id);
    for (var id in mod.deps)
      if (mod.deps[id])
        if (expose[mod.deps[id]])
          mod.deps[id] = expose[mod.deps[id]];
        else
          mod.deps[id] = common.hash(mod.deps[id]);
    this.queue(mod);
  });
}

function insertDebugInfo() {
  return through(function(mod) {
    mod = utils.cloneDeep(mod);
    mod.sourceFile = mod.id;
    mod.sourceRoot = 'file://localhost';
    this.queue(mod);
  });
}

