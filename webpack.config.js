const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  const nonSecure = path.resolve(__dirname, 'node_modules/nanoid/non-secure/index.js');

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...config.resolve.alias,
    'nanoid/non-secure': nonSecure,
    'react-native-linear-gradient': path.resolve(__dirname, 'src/utils/LinearGradientMock.js'),
  };

  return config;
};
