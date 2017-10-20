'use strict';

var readFileSync = require('fs').readFileSync;

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

var lookup = {};
module.exports = new Proxy(lookup, {
	get: function(target, property, receiver) {
		if (target.hasOwnProperty(property)) return Reflect.get(target, property, receiver);
		return lodashRequire(property, lookup.__require);
	},
	set: function(target, property, value, receiver) {
		return Reflect.set(target, property, value, receiver);
	}
});
