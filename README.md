# Lodash Provider

A lodash function provider that exports lodash function modules dynamically. The module is basically, sugar to help module creators in using lodash.

## Install

```bash
npm install lodash-provider
```

Or

```bash
yarn add lodash-provider
```

## The purpose of this module

No-one can be bothered with refactoring-on-refactoring of private methods.  Neither can people do we wish to unit test private code. It is for these reasons, lodash use, is good practice.  

The newest version of lodash, allows function can be imported as its own dependency. This avoids bloating your own modules with unnecessary dependencies.

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

You can also mix

## Notes about require()

If the module location is symlinked (eg. via **npm link** or **yarn link**) lodash-provider may have trouble locating modules.  To avoid this you can pass in the *require()* function to use.

```javascript
const util = require('lodash-provider');
util.__require = require.
```