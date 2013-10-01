var u             = require('lodash'),
    resolveCb     = require('browser-resolve'),
    q             = require('kew'),
    asStream      = require('as-stream');

exports.indexToStream = function(index) {
  return asStream.apply(null, u.values(index));
}

exports.buildIndex = function(modules) {
  var graph = {};
  for (var i = 0, length = modules.length; i < length; i++)
    graph[modules[i].id] = u.cloneDeep(modules[i]);
  return graph;
}


exports.dummyModule = {id: '__dummy__', source: ''};

exports.matcher = function(regexp) {
  return regexp.exec.bind(regexp);
}

exports.stubMissingDeps = function(graph) {
  for (var id in graph)
    for (var dep in graph[id].deps)
      if (!graph[graph[id].deps[dep]])
        graph[id].deps[dep] = exports.dummyModule.id;
  return graph;
}

exports.separateSubgraph = function(graph, predicate) {
  var subgraph = {};
  for (var id in graph)
    if (predicate(id)) {
      subgraph[id] = graph[id];
      delete graph[id];
    }
  return subgraph;
}


exports.resolve = function(id, parent) {
  var promise = q.defer();
  resolveCb(id, parent, promise.makeNodeResolver());
  return promise;
}
