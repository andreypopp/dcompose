"use strict";

var detective = require('detective')

module.exports = function(mod, g) {
  if (g.opts.noParse && g.opts.noParse.indexOf(mod.filename) > -1) return

  var deps = detective(mod.source, {
    isRequire: function(node) {
      return (node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type == 'Identifier' &&
          node.callee.object.name == 'require' &&
          node.callee.property.type == 'Identifier' &&
          node.callee.property.name == 'async')
    }
  })

  return g.resolveMany(deps, mod)
    .then(function(deps) { return {deps: deps, async_deps: deps} })
}

