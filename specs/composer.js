var dcompose  = require('../index'),
    q         = require('kew'),
    assert    = require('assert'),
    path      = require('path'),
    aggregate = require('stream-aggregate-promise');

function fixture(filename) {
  return path.join(__dirname, 'fixtures', filename);
}

function assertBundleOk(bundle) {
  var assertions = Array.prototype.slice.call(arguments, 1);
  return aggregate(bundle).then(function(bundle) {
    assertions.forEach(function(assertion) {
      assert.ok(bundle.indexOf(assertion) > -1);
    });
  }).end();
}

function assertHasSubstrings(bundle) {
  var assertions = Array.prototype.slice.call(arguments, 1);
  assertions.forEach(function(assertion) {
    assert.ok(bundle.indexOf(assertion) > -1);
  });
}

describe('Composer', function() {

  describe('bundleJS', function() {

    it('bundles only js dependencies', function(done) {
      var composer = dcompose(fixture('entry.js'));
      aggregate(composer.bundleJS()).then(function(bundle) {
        assertHasSubstrings(bundle,
          'I am entry.js',
          'I am dep.js');
        done();
      }).fail(done);
    });

    it('bundles only js dependencies (result via callback)', function(done) {
      var composer = dcompose(fixture('entry.js'));
      composer.bundleJS(function(err, bundle) {
        if (err) return done(err);
        assertHasSubstrings(bundle,
          'I am entry.js',
          'I am dep.js');
        done();
      });
    });
  });

  describe('bundleCSS', function() {

    it('bundles only css dependencies', function(done) {
      var composer = dcompose(fixture('styles.css'));
      aggregate(composer.bundleCSS()).then(function(bundle) {
        assertHasSubstrings(bundle,
          'I am styles.css',
          'I am dep.css');
        done();
      }).fail(done);
    });

    it('bundles only css dependencies (result via callback)', function(done) {
      var composer = dcompose(fixture('styles.css'));
      composer.bundleCSS(function(err, bundle) {
        if (err) return done(err);
        assertHasSubstrings(bundle,
          'I am styles.css',
          'I am dep.css');
        done();
      });
    });
  });

  describe('bundle', function() {

    it('bundles css and js dependencies', function(done) {
      var composer = dcompose(fixture('entry.js'));
      aggregate(composer.bundle()).then(function(bundle) {
        assertHasSubstrings(bundle,
          'I am entry.js',
          'I am dep.js');
        assertHasSubstrings(bundle,
          'I am styles.css',
          'I am dep.css');
        done();
      }).fail(done);
    });

    it('bundles css and js dependencies (result via callback)', function(done) {
      var composer = dcompose(fixture('entry.js'));
      composer.bundle(function(err, bundle) {
        if (err) return done(err);
        assertHasSubstrings(bundle,
          'I am entry.js',
          'I am dep.js');
        assertHasSubstrings(bundle,
          'I am styles.css',
          'I am dep.css');
        done();
      });
    });
  });

});
