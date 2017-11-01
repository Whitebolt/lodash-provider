'use strict';

var lodashTest = /^lodash\.[a-z0-9]/;
var lookup = {};
var deleted = {};

var util = require('util');
var readFileSync = require('fs').readFileSync;
var path = require('path');
var memoize = require('lodash.memoize');
var uniq = require('lodash.uniq');
var localRequire = (function(){
	var resolve = require('resolve').sync;
	var dir = path.dirname((module.parent || module).filename);
	var resolver = memoize(function(moduleId) {return resolve(moduleId, {basedir:dir});});
	var _require = memoize(function (moduleId) {return require(resolver(moduleId))});
	_require.resolve = resolver;
	return _require;
})();
var _Symbol = (function(){
	try {
		return Symbol;
	} catch(err) {
		return {};
	}
})();


/**
 * Get a lodash module id for the given function.
 *
 * @param {string} functionName		Lodash function to get module name of.
 * @returns {string}				Lodash module-id.
 */
function getLodashId(functionName) {
	return 'lodash.'+functionName.toLowerCase();
}

/**
 * Get the given function from lodash. Given a function name try to load the corresponding module.
 *
 * @throws {ReferenceError}			If function not found then throw error.
 * @param {string} functionName		The function name to find (this will be lower-cased).
 * @returns {Function}				The lodash function.
 */
function lodashRequire(functionName) {
	var moduleId = getLodashId(functionName);

	try {
		var method = localRequire(moduleId);
		method.toString = lodashFunctionToString(functionName);
		return method;
	} catch (err) {
		throw new ReferenceError('Could not find '+functionName+', did you forget to install '+moduleId);
	}
}

/**
 * Get the .toString() of a lodash function. Will wrap the entire module.
 *
 * @param {string} functionName		Function name to export.
 * @returns {Function}				The function module wrapped correctly.
 */
function lodashFunctionToString(functionName) {
	var moduleText = readFileSync(localRequire.resolve(getLodashId(functionName)), 'utf-8');

	return function () {
		return 'function '+functionName+'() {var module = {exports:{}};'+moduleText+'\nreturn module.exports.apply({}, arguments);};';
	}
}

/**
 * Get object that has everything provided in it.  Pull in lodash methods as well as local ones.
 *
 * @param {Object} target			The local object.
 * @returns {Object}				An object with everything in.
 */
var getWholeObject = memoize(function getWholeObject(target) {
	return Object.assign({}, setLodashFunctions(), target);
});

/**
 * Traps for export Proxy.
 *
 * @property {Function} get
 * @property {Function} set
 * @property {Function} has
 * @property {Function} deleteProperty
 * @property {Function} ownKeys
 */
var traps = {
	get: function(target, property, receiver) {
		if (deleted[property]) return undefined;
		if (target.hasOwnProperty(property)) return Reflect.get(target, property, receiver);
		if ((typeof property).toLowerCase() !== 'symbol') return lodashRequire(property, localRequire);
		if (property === util.inspect.custom) return function() {
			return util.inspect(getWholeObject(target));
		};
		if (property === _Symbol.iterator) return function*() {
			var lodash = getWholeObject(target);
			for (var property in lodash) {
				if (lodash.hasOwnProperty(property)) yield [lodash[property], property, target];
			}
		};
	},
	set: function(target, property, value, receiver) {
		deleted[property] = false;
		return Reflect.set(target, property, value, receiver);
	},
	has: function(target, property) {
		if (deleted[property]) return false;
		if (property in target) return Reflect.has(target, property);
		var lodash = setLodashFunctions();
		return (property in lodash);
	},
	ownKeys: function(target) {
		return uniq(Reflect.ownKeys(target).concat(Reflect.ownKeys(setLodashFunctions()))).filter(function(key) {
			return !deleted[key];
		});
	},
	deleteProperty: function(target, property) {
		deleted[property] = true;
	}
};

/**
 * Test whether current environment supports Proxy objects has the Reflect api.
 *
 * @returns {boolean}		Does it support Proxy and Reflect?
 */
function hasProxyReflect() {
	try {
		return !!(Proxy || Reflect);
	} catch (err) {}
	return false;
}

/**
 * Take a path string and lop the last directory off returning the parent.
 *
 * @param {string} path		Directory path.
 * @returns {string}		Parent directory.
 */
function lop(path) {
	var parts = path.split('/');
	parts.pop();
	return parts.join('/');
}

/**
 * Find all possible local directories for node_modules loading.
 *
 * @returns {Array.<string>}		Load paths.
 */
function getPathStack() {
	return (module.parent || module).paths.map(function(path) {
		return lop(path)
	}).filter(function(path) {
		return (path !== '');
	});
}

/**
 * Try to load package.json from a path, returning the data or {} if it cannot be loaded.
 *
 * @param path
 * @returns {{}}
 */
function tryPackage(path) {
	return tryModule(path + '/package.json');
}

/**
 * Try to load a module.  		Capture failures returning an empty object {} for load failure.
 * @param {string} path			Path to load from.
 * @returns {*|Object.<{}>}			Module or Object.
 */
function tryModule(path) {
	try {
		return localRequire(path);
	} catch(err) {}
	return {};
}

/**
 * Get all possible local loading directories for node_modules and load all package.json data in each.
 *
 * @returns {Array.<Object>}		The package data or {}.
 */
function getPackageDataStack() {
	return getPathStack().map(function(path) {
		return tryPackage(path)
	});
}

/**
 * Load all the lodash methods from given packages array.
 *
 * @param {Array.<Object>} packages			Packages array to load into.
 * @param {Array.<Object>} packageData		Package data array.
 * @param {string} modType					Section of package data to load from (eg. 'dependencies').
 */
function loadPackageModules(packages, packageData, modType) {
	Object.keys(packageData[modType] || {}).forEach(function(packageName) {
		if (lodashTest.test(packageName)) packages.push(tryModule(packageName));
	});
}

/**
 * Load all lodash modules that can be found in the current paths into lookup. Results are memoized.
 *
 * @memoize
 */
var getLodashFunctions = memoize(function() {
	var packages = [];

	getPackageDataStack().forEach(function(packageData) {
		loadPackageModules(packages, packageData, 'dependencies');
		loadPackageModules(packages, packageData, 'devDependencies');
	});

	return packages;
});

/**
 * Find and set lodash functions on a given object. Results are memoized.
 *
 * @memoize
 * @param {Object} [lookup={}]		Object to set on.
 */
var setLodashFunctions = memoize(function setLodashFunctions(lookup) {
	lookup = lookup || {};
	getLodashFunctions().forEach(function(exported) {
		if (exported.name) lookup[exported.name] = exported;
	});

	return lookup;
});


if (hasProxyReflect()) {
	module.exports = new Proxy(lookup, traps);
} else {
	module.exports = setLodashFunctions(lookup);
}
