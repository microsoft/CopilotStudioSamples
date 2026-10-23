'use strict';

const build = require('@microsoft/sp-build-web');
const path = require('node:path');

// The SDK beta's Activity browser mapping points at TypeScript; use its shipped JavaScript shim.
const activityRoot = path.dirname(require.resolve('@microsoft/agents-activity/package.json'));
build.configureWebpack.mergeConfig({
  additionalConfiguration: config => {
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.join(activityRoot, 'src/browser/crypto.ts')]: path.join(activityRoot, 'dist/src/browser/crypto.js')
    };
    return config;
  }
});

build.addSuppression(`Warning - [sass] The local CSS class 'ms-Grid' is not camelCase and will not be type-safe.`);

var getTasks = build.rig.getTasks;
build.rig.getTasks = function () {
  var result = getTasks.call(build.rig);

  result.set('serve', result.get('serve-deprecated'));

  return result;
};

build.initialize(require('gulp'));
