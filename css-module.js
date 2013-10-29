"use strict";

var isCSS = require('./common').isCSS,
    sha1  = require('sha1');

/**
 * Wrap CSS into a CommonJS module which inserts styles into DOM.
 *
 * Stolen from staticify.
 * Licensed under: Apache 2.0
 * Copyright: Pete Hunt <pete@instagram.com>
 */
function transformCSS(data) {
  var code = '';
  var nodeID = '__dcompose_style__' + sha1(data);
  code += 'var nodeID = ' + JSON.stringify(nodeID) + ';\n';
  code += 'var code = ' + JSON.stringify(data) + ';\n';
  code += 'if (typeof window === \'undefined\') {\n';
  code += '  var g = eval(\'global\');\n'; // bypass browserify global insertion
  code += '  if (!g.__dcompose_css) {\n';
  code += '    g.__dcompose_css = [];\n';
  code += '  }\n';
  code += '  g.__dcompose_css.push({nodeID: nodeID, code: code});\n';
  code += '} else if (!document.getElementById(nodeID)) {\n';
  code += '  var node = document.createElement(\'style\');\n';
  code += '  node.setAttribute(\'id\', nodeID);\n';
  code += '  node.innerHTML = code;\n';
  code += '  document.head.appendChild(node);\n';
  code += '}\n';
  return code;
}

module.exports = transformCSS;
