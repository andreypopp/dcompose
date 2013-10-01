require('./a1.js');
require.async('./g.js', function() {console.log(mod)});
require.async('./f.js', function() {console.log(mod)});
require.async('./c.js', function() {console.log(mod)});
module.exports = 'a';
