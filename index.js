'use strict';

var readFileSync = require('fs').readFileSync;
var path = require('path');
var lodashTest = /^lodash\.[a-z0-9]/;
var lookup = {};

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
 * @param {Function} require			The require function to use - avoids symlinking errors.
 * @returns {Function}				The lodash function.
 */
function lodashRequire(functionName, require) {
	var moduleId = getLodashId(functionName);

	try {
		var method = require(moduleId);
		method.toString = lodashFunctionToString(functionName, require);
		return method;
	} catch (err) {
		throw new ReferenceError('Could not find '+functionName+', did you forget to install '+moduleId);
	}
}

/**
 * Get the .toString() of a lodash function. Will wrap the entire module.
 *
 * @param {string} functionName		Function name to export.
 * @param {Function} require			The require function to use - avoids symlinking errors.
 * @returns {Function}				The function module wrapped correctly.
 */
function lodashFunctionToString(functionName, require) {
	var moduleText = readFileSync(require.resolve(getLodashId(functionName)), 'utf-8');

	return function () {
		return 'function '+functionName+'() {const module = {exports:{}};'+moduleText+'\nreturn module.exports.apply({}, arguments);};';
	}
}

function get(target, property, receiver) {
	if (target.hasOwnProperty(property)) return Reflect.get(target, property, receiver);
	return lodashRequire(property, lookup.__require);
}

function set(target, property, value, receiver) {
	return Reflect.set(target, property, value, receiver);
}

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
 * Take an array, returning unique entries.
 *
 * @note not the most efficient method but designed to be backwards compatible with older JavaScript versions.
 *
 * @param {Array} ary		Array to filter.
 * @returns {Array}			Array of unique entries.
 */
function unique(ary) {
	var _ary = [];
	var lookup = {};
	ary.forEach(function(item) {
		if (!lookup.hasOwnProperty(item)) {
			_ary.push(item);
			lookup[item] = true;
		}
	});
	return _ary;
}

/**
 * Traverse up the current module->parent tree returning all possible local directories for node_modules loading.
 *
 * @returns {Array.<string>}		Load paths.
 */
function getPathStack() {
	var _module = module;
	var stack = [];
	while (_module.parent) {
		var dir = path.dirname(_module.filename);
		while(dir) {
			stack.push(dir);
			dir = lop(dir);
		}
		_module = _module.parent;
	}

	return unique(stack).sort();
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
		return require(path);
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
 * Load all lodash modules that can be found in the current paths into lookup.
 */
function getLodashFunctions() {
	var packages = [];

	getPackageDataStack().forEach(function(packageData) {
		loadPackageModules(packages, packageData, 'dependencies');
		loadPackageModules(packages, packageData, 'devDependencies');
	});

	packages.forEach(function(exported) {
		if (exported.name) lookup[exported.name] = exported;
	});
}


if (hasProxyReflect()) {
	module.exports = new Proxy(lookup, {get:get, set:set});
} else {
	getLodashFunctions();
	module.exports = lookup;
}
