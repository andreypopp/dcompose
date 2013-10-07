var Composer  = require('../index'),
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
  });
}

describe('composer', function() {

  it('bundles css and js dependencies', function(done) {
    var composer = new Composer(fixture('entry.js'));
    composer.bundle().then(function(bundle) {
      var js = assertBundleOk(bundle['bundle.js'],
        'I am entry.js',
        'I am dep.js');
      var css = assertBundleOk(bundle['bundle.css'],
        'I am styles.css',
        'I am dep.css');
      return q.all([js, css]).then(function() { done(); });
    }).fail(done);
  });
});
