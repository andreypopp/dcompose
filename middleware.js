var aggregate = require('stream-aggregate-promise'),
    mimetype  = require('mimetype').lookup;

module.exports = function(composer) {
  var bundle = composer.bundle();

  composer.on('update', function() {
    bundle = composer.bundle();
  });

  return function(req, res, next) {
    bundle
      .then(function(bundles) {
        var bundleName = req.params[0],
            bundle = bundles[bundleName];

        if (!bundle) return next();

        res.setHeader('Content-Type', mimetype(bundleName));
        return aggregate(bundle);
      })
      .then(function(bundle) {
        res.send(bundle);
      })
      .fail(next);
  }
}
