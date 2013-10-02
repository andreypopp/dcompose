/**
 * @typedef {Object} Split
 * @property {Object} graph
 * @property {Array.<Strign>} deps
 * @property {Array.<Strign>} invDeps
 */

var BaseCompose = require('../index'),
    fs          = require('fs'),
    path        = require('path'),
    u           = require('lodash'),
    inherits    = require('util').inherits,
    utils       = require('../utils'),
    hash        = require('dgraph-bundler').hash,
    asyncDeps   = require('./async_deps');

var runtime = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8');
var prelude = fs.readFileSync(path.join(__dirname, 'prelude.js'), 'utf8');

function Compose(opts) {
  BaseCompose.call(this, opts);
  this.opts.transform = (this.opts.transform || []).concat(asyncDeps);
  this.prelude = prelude;
}

inherits(Compose, BaseCompose);

Compose.prototype.layoutGraph = function(graph) {
  var entry = path.resolve(this.entries[0]);
  return new LayoutStrategy(graph, entry).layout();
}

function LayoutStrategy(graph, entry) {
  this.entry = entry;
  this.graph = graph;
  this.mappings = {};
}

LayoutStrategy.prototype = {
  layout: function() {
    var splits = this.computeSplits(),
        conds = this.computeConditions(splits),
        results = {};

    for (var id in splits)
      console.log(u.pick(splits[id], ['id', 'deps', 'invDeps', 'closedInvDeps']))

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
          if (!u.isEmpty(bundle))
            results[bundleName(id, conds)] = bundle;
        });
      }
    }

    console.log(u.keys(results).length);
    return results;
  },

  /**
   * Compute splits for a graph
   */
  computeSplits: function() {
    var splits = {};

    splits[this.entry] = computeSplit(this.graph, this.entry);

    traverse(this.graph, this.entry, function(mod) {
      if (u.isEmpty(mod.async_deps)) return;
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
      splits[id].invDeps = u.intersection.apply(null, allPaths[id]);

    return splits;
  },

  computeConditions: function(splits) {
    var conds = {};
    for (var p in splits)
      for (var t in splits) {
        if (t === p) continue;
        if (u.intersection(
              Object.keys(splits[p].graph),
              Object.keys(splits[t].graph)).length > 0) {
          conds[p] = conds[p] || [];
          conds[p].push(t);
        }
      }
    return conds;
  },

  addRuntimeLoader: function(graph) {
    graph['__runtime__/loader'] = {
      id: '__runtime__/loader',
      source: runtime,
      deps: {},
      expose: true
    }
  },

  addRuntimeModuleMapping: function(graph) {
    graph['__runtime__/modules'] = {
      id: '__runtime__/modules',
      deps: {},
      source: 'module.exports = ' + JSON.stringify(this.mapping) + ';',
      expose: true
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
    if (!u.isEmpty(graph[id].async_deps))
      deps = deps.concat(u.values(graph[id].async_deps));
  return {id: entry, graph: graph, deps: u.uniq(deps)};
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
    if (u.isBoolean(value) && !value) continue;
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

module.exports = Compose;
