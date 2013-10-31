var utils         = require('lodash'),
    path          = require('path'),
    fs            = require('fs'),
    q             = require('kew'),
    crypto        = require('crypto'),
    resolveNode   = require('resolve'),
    asStream      = require('as-stream');

exports.dummyModule = {id: '__dummy__', source: '', expose: '__dummy__'};

exports.matcher = function(regexp) {
  return regexp.exec.bind(regexp);
}

exports.stubMissingDeps = function(graph) {
  var stubbed = false;
  for (var id in graph)
    for (var dep in graph[id].deps)
      if (!graph[graph[id].deps[dep]]) {
        graph[id].deps[dep] = exports.dummyModule.id;
        stubbed = true;
      }
  if (stubbed)
    graph[exports.dummyModule.id] = exports.dummyModule;
  return graph;
}

exports.isCSS = exports.matcher(/\.(css|styl|scss|sass|less)/);

exports.separateSubgraph = function(graph, predicate) {
  var subgraph = {};
  for (var id in graph)
    if (predicate(id)) {
      subgraph[id] = graph[id];
      delete graph[id];
    }
  return subgraph;
}

/**
 * Stream dependencies from graph
 * @param {Object|Array|Graph} graph
 */
exports.graphToStream = function(graph) {
  if (typeof graph.toStream === 'function')
    return graph.toStream()
  else if (Array.isArray(graph))
    return asStream.apply(null, graph)
  else
    return asStream.apply(null, utils.values(graph))
}

exports.hash = function(what) {
  return crypto.createHash('md5').update(what).digest('base64').slice(0, 6)
}

exports.exposeMap = function(modules) {
  var expose = {};
  expose[exports.dummyModule.id] = exports.dummyModule.id;
  modules.forEach(function(mod) {
    if (mod.expose) expose[mod.id] = mod.expose;
  });
  return expose;
}

exports.thenCallback = function(promise, cb) {
  if (cb) promise.then(
    function(result) { cb(null, result); },
    function(error) { cb(error); });
  return promise;
}

exports.layoutBundle = function(directory, streams) {
  for (var name in streams)
    streams[name]
      .pipe(fs.createWriteStream(path.join(directory, name)))
}

exports.makeCSSTransform = function(transform) {
  if (transform.length === 1)
    return function(filename) {
      if (exports.isCSS(filename))
        return transform(filename);
    }
  else
    return function(mod, graph) {
      if (exports.isCSS(mod.id))
        return transform(mod, graph);
    }
}

exports.resolveTransform = function(id, basedir) {
  basedir = basedir || process.cwd();
  return utils.isString(id) ?
    require(resolveNode.sync(id, {basedir: basedir})) :
    id;
}
