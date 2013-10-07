var cssPack       = require('css-pack'),
    combine       = require('stream-combiner'),
    depsSort      = require('deps-sort'),
    graphToStream = require('../common').graphToStream;

/**
 * Bundle graph of CSS dependencies
 *
 * @param {Graph} graph
 */
module.exports = function(graph) {
  return combine(graphToStream(graph), depsSort(), cssPack());
}
