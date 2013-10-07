var utils         = require('lodash'),
    q             = require('kew'),
    crypto        = require('crypto'),
    asStream      = require('as-stream');

exports.buildIndex = function(modules) {
  var index = {};
  for (var i = 0, length = modules.length; i < length; i++)
    index[modules[i].id] = utils.cloneDeep(modules[i]);
  return index;
}

exports.dummyModule = {id: '__dummy__', source: '', expose: '__dummy__'};

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
