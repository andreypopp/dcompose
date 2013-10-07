/**
 * @typedef {Object} Split
 *   @property {Object} graph
 *   @property {Array.<Strign>} deps
 *   @property {Array.<Strign>} invDeps
 */

var fs            = require('fs'),
    path          = require('path'),
    utils         = require('lodash'),
    inherits      = require('util').inherits,
    cssBundler    = require('../bundlers/css'),
    jsBundler     = require('../bundlers/js'),
    BaseComposer  = require('../index'),
    hash          = require('../common').hash,
    asyncDeps     = require('./async-deps');

var runtime = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8'),
    prelude = fs.readFileSync(path.join(__dirname, 'prelude.js'), 'utf8');

function Composer(entries, opts) {
  BaseComposer.call(this, entries, opts);
  this.opts.transform = (this.opts.transform || []).concat(asyncDeps);
}

inherits(Composer, BaseComposer);

Composer.prototype.bundle = function(graph) {

  return this._graphIndex().then(function(graph) {
    var layout = layoutMultiBundle(graph, this.entries),
        bundles = {};

    for (var k in layout)
      if (k.match(/\.css$/)
        bundles[k] = cssBundler(layout[k])
      else if (k.match(/\.js$/))
        bundles[k] = jsBundler(layout[k])
      else
        throw new Error("don't know how to bundle " + k);

    return bundles;
  }.bind(this));
}

function layoutMultiBundle(graph, entries) {
  return new LayoutStrategy(graph, entries).layout();
}

function LayoutStrategy(graph, entries) {
  this.entries = entries;
  this.graph = graph;
  this.mappings = {};
}

LayoutStrategy.prototype = {
  layout: function() {
    var splits = this.computeSplits(),
        conds = this.computeConditions(splits),
        results = {};

    for (var id in splits)
      console.log(utils.pick(splits[id], ['id', 'deps', 'invDeps', 'closedInvDeps']))

    for (var id in splits) {
      results[bundleName(id)] = splits[id].graph;
      if (conds[id]) {
        console.log('')
        variants(conds[id]).forEach(function(conds) {
          if (conds.some(function(c) { return splits[id].invDeps.indexOf(c) > -1; }))
            return
          console.log(id, conds)
          var bundle = splits[id].graph;
          conds.forEach(function(c) {
            bundle = except(bundle, splits[c].graph);
          });
          if (!utils.isEmpty(bundle))
            results[bundleName(id, conds)] = bundle;
        });
      }
    }

    console.log(utils.keys(results).length);
    return results;
  },

  /**
   * Compute splits for a graph
   */
  computeSplits: function() {
    var splits = {};

    splits[this.entry] = computeSplit(this.graph, this.entry);

    traverse(this.graph, this.entry, function(mod) {
      if (utils.isEmpty(mod.async_deps)) return;
      for (var id in mod.async_deps)
        splits[mod.async_deps[id]] = computeSplit(this.graph, mod.async_deps[id]);
    }.bind(this));

    var allPaths = {},
        queue = [{id: this.entry, path: []}];

    while (queue.length > 0) {
      var c = queue.shift();
      if (splits[c.id].deps.length > 0) {
        queue = queue.concat(splits[c.id].deps.map(function(d) {
          return {id: d, path: c.path.concat(c.id)};
        }));
      }
      (allPaths[c.id] = allPaths[c.id] || []).push(c.path);
    }

    for (var id in allPaths)
      splits[id].invDeps = utils.intersection.apply(null, allPaths[id]);

    return splits;
  },

  computeConditions: function(splits) {
    var conds = {};
    for (var p in splits)
      for (var t in splits) {
        if (t === p) continue;
        if (utils.intersection(
              Object.keys(splits[p].graph),
              Object.keys(splits[t].graph)).length > 0) {
          conds[p] = conds[p] || [];
          conds[p].push(t);
        }
      }
    return conds;
  },

  addRuntimeLoader: function(graph) {
    var id = '__runtime__/loader';
    graph[id] = {
      id: id,
      source: runtime,
      deps: {},
      expose: id
    }
  },

  addRuntimeModuleMapping: function(graph) {
    var id = '__runtime__/modules';
    graph[id] = {
      id: id,
      deps: {},
      source: 'module.exports = ' + JSON.stringify(this.mapping) + ';',
      expose: id
    }
  },

  updateMapping: function(bundleName, graph) {
    for (var id in graph) this.mapping[hash(id)] = bundleName;
  }
};

function computeSplit(graph, entry) {
  var graph =  subgraphFor(graph, entry);
  var deps = [];
  for (var id in graph)
    if (!utils.isEmpty(graph[id].async_deps))
      deps = deps.concat(utils.values(graph[id].async_deps));
  return {id: entry, graph: graph, deps: utils.uniq(deps)};
}

function traverse(graph, fromId, func) {
  var toTraverse = [[graph[fromId]]],
      seen = {};

  while (toTraverse.length > 0) {
    var args = toTraverse.shift();
    var mod = args[0];

    if (!mod || seen[mod.id]) continue;
    seen[mod.id] = true;

    var value = func.apply(null, args);
    if (utils.isBoolean(value) && !value) continue;
    for (var depId in mod.deps)
      if (mod.deps[depId])
        toTraverse.unshift([graph[mod.deps[depId]], depId, mod]);
  }
}

function subgraphFor(graph, entry) {
  var result = {};
  traverse(graph, entry, function(mod, id, parent) {
    if (parent && parent.async_deps && parent.async_deps[id]) return false;
    result[mod.id] = mod;
  })
  return result;
}

function except(a, b) {
  var result = {}
  for (var key in a)
    if (!b[key]) result[key] = a[key]
  return result
}

function variants(items) {
  var results = [];
  for (var i = 1; i <= items.length; i++)
    for (var j = 0; j < items.length; j++)
      if (items.length - j >= i)
        results.push(items.slice(j, j + i));
  return results;
}

function bundleName(entry, conds) {
  parts = (conds || []).slice(0).sort();
  parts.unshift(entry);
  return parts.join('_');
}

module.exports = Composer;
