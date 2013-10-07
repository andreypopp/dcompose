
// modules are defined as an array
// [ module function, map of requireuires ]
//
// map of requireuires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the requireuire for previous bundles

(function outer (modules, cache, entry) {
    // Save the require from previous bundle to this closure if any
    var previousRequire = typeof require == "function" && require;


    function newRequire(name, jumped){

        var localRequire = function(x) {
          var id = modules[name][1][x];
          return newRequire(id ? id : x);
        }

        localRequire.async = function(x, cb) {
          var id = modules[name][1][x]
          runtime.load(id ? id : x, cb)
        }

        if(!cache[name]) {
            if(!modules[name]) {
                // if we cannot find the the module within our internal map or
                // cache jump to the current global require ie. the last bundle
                // that was added to the page.
                var currentRequire = typeof require == "function" && require;
                if (!jumped && currentRequire) return currentRequire(name, true);

                // If there are other bundles on this page the require from the
                // previous one is saved to 'previousRequire'. Repeat this as
                // many times as there are bundles until the module is found or
                // we exhaust the require chain.
                if (previousRequire) return previousRequire(name, true);
                throw new Error('Cannot find module \'' + name + '\'');
            }
            var m = cache[name] = {exports:{}};
            modules[name][0].call(m.exports,localRequire,m,m.exports,outer,modules,cache,entry);
        }
        return cache[name].exports;
    }

    var runtime = newRequire('__runtime__/loader')
    runtime.bundleLoaded(newRequire, entry);

    // Override the current require with this new one
    return newRequire;
})