var aggregate = require('stream-aggregate-promise'),
    mimetype  = require('mimetype');

function aggregateStreams(streams) {
  var result = {};
  for (var k in streams)
    result[k] = aggregate(streams[k]);
  return result;
}

module.exports = function(composer) {
  function serveBundle(req, res, next) {
    serveBundle.bundle
      .then(function(bundles) {
        var bundleName = req.url.slice(1),
            bundle = bundles[bundleName];

        if (!bundle) return next();

        res.setHeader('Content-Type', mimetype.lookup(bundleName));
        return bundle;
      })
      .then(function(bundle) {
        res.send(bundle);
      })
      .fail(next);
  }

  serveBundle.build = function() {
    serveBundle.bundle = composer.bundle().then(aggregateStreams);
  }

  serveBundle.build();
  composer.on('update', serveBundle.build);

  return serveBundle;
}
