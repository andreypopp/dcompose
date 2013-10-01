var modulesMap = require('__runtime__/modules'),
    fetchedBundles = {};

module.exports = {

  require: require,

  fetch: function(src, callback) {
    var scr = document.head.appendChild(document.createElement('script'));
    scr.async = true;
    scr.onload = callback;
    scr.src = src;
  },

  load: function(id, callback) {
    var bundle = modulesMap[id];

    if (!bundle)
      return callback(new Error('no bundle with '+ id +' module'));

    if (fetchedBundles[bundle])
      return callback(null, this.require(id));

    this.fetch(bundle + '.js', function() {
      fetchedBundles[bundle] = true;
      callback(null, this.require(id));
    }.bind(this));
  },

  bundleLoaded: function(newRequire, entries) {
    this.require = newRequire;
    for(var i=0; i<entries.length; i++)
      newRequire(entries[i]);
  }
}
