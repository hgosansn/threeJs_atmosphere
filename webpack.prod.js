const merge = require('webpack-merge') 
const common = require('./webpack.config.js');

prod = true;

module.exports = merge(common, {
  mode: 'production',
});