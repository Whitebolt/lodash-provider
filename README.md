# Lodash Provider

A utility function provider that exports lodash functions dynamically. You can create your own hybrid utility module using a mix of your own functions and the lodash provided ones.

The provider will search your own utility functions if requested method is not present try to load and present the lodash one.

## Install

```bash
npm install lodash-provider
```

Or

```bash
yarn add lodash-provider
```

## The purpose of this module

Most sensible people can do not bother with refactoring-on-refactoring of private methods.  Normally, we do not wish to unit test private code. It is for these reasons that using lodash is good practice.  

The newest version of lodash, allows methods to be imported individually. This avoids bloating your own modules with the entire lodash export.

The pain of all this is having to require-in each module individually and mix that in with your own utility functions not provided by lodash.  This module aims to make this process slightly easier by providing some sugar.


### Example

```javascript
const util = require('lodash-provider');

// Use lodash functions

util.isString('A string');
util.flatten([['A','B'],'C');

```

So, what is happening here is not just an exotic way to *require('lodash')* and get everything.  Each function call is doing a require for that lodash function.  So, in the background,this has happened:

```javascript
require('lodash.isstring');
require('lodash.flatten);

```

This is achieved through proxies and will throw a helpful error when lodash module is not found (did you forget to install it?)

## Mixing with your own utility functions

It is more useful when you combine it with your own functions.

### Example

```javascript
'use strict';

const util = require('lodash-provider');

util.makeArray = function makeArray(value) {
	if (value === undefined) return [];
	if (value instanceof Set) return [...value];
	return util.castArray(value);
};

module.exports = util;
```

Here we have added our utility function that is similar to lodash's castArray. All our utility functions could be addded here and then we can include in other parts of our project:

```javascript
const util = require('./util);
```

## Older node versions

If JavaScript Proxy and Reflect are available this module will simply require in the lodash functions as they are requested.  In older node versions this cannot be achieved with proxies. In this setting the module will parse the package.json hierarchy and load in the lodash dependencies.
