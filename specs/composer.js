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

describe('composer', function() {

  describe('bundles js', function() {

    it('bundles only js dependencies', function(done) {
      var composer = dcompose(fixture('entry.js'));
      composer.js().then(aggregate).then(function(bundle) {
        assertHasSubstrings(bundle, 
          'I am entry.js',
          'I am dep.js');
        done();
      }).fail(done);
    });

    it('bundles only js dependencies (result via callback)', function(done) {
      var composer = dcompose(fixture('entry.js'));
      composer.js(function(err, bundle) {
        if (err) return done(err);
        aggregate(bundle).then(function(bundle) {
          assertHasSubstrings(bundle, 
            'I am entry.js',
            'I am dep.js');
          done();
        }).fail(done);
      });
    });
  });

  describe('bundles css', function() {

    it('bundles only css dependencies', function(done) {
      var composer = dcompose(fixture('styles.css'));
      composer.css().then(aggregate).then(function(bundle) {
        assertHasSubstrings(bundle, 
          'I am styles.css',
          'I am dep.css');
        done();
      }).fail(done);
    });

    it('bundles only css dependencies (result via callback)', function(done) {
      var composer = dcompose(fixture('styles.css'));
      composer.css(function(err, bundle) {
        if (err) return done(err);
        aggregate(bundle).then(function(bundle) {
          assertHasSubstrings(bundle, 
            'I am styles.css',
            'I am dep.css');
          done();
        }).fail(done);
      });
    });
  });

  describe('bundles all', function() {

    it('bundles css and js dependencies', function(done) {
      var composer = dcompose(fixture('entry.js'));
      composer.all().then(function(bundle) {
        var js = assertBundleOk(bundle['entry.bundle.js'],
          'I am entry.js',
          'I am dep.js');
        var css = assertBundleOk(bundle['entry.bundle.css'],
          'I am styles.css',
          'I am dep.css');
        return q.all([js, css]).then(function() { done(); });
      }).fail(done);
    });

    it('bundles css and js dependencies (result via callback)', function(done) {
      var composer = dcompose(fixture('entry.js'));
      composer.all(function(err, bundle) {
        if (err) return done(err);
        var js = assertBundleOk(bundle['entry.bundle.js'],
          'I am entry.js',
          'I am dep.js');
        var css = assertBundleOk(bundle['entry.bundle.css'],
          'I am styles.css',
          'I am dep.css');
        return q.all([js, css]).then(function() { done(); });
      });
    });
  });

});
