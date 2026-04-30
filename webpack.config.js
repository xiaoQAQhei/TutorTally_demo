const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  const nonSecure = path.resolve(__dirname, 'node_modules/nanoid/non-secure/index.js');

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...config.resolve.alias,
    'nanoid/non-secure': nonSecure,
  };

  return config;
};
