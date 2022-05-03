const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const HtmlMinimizerPlugin = require("html-minimizer-webpack-plugin");
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const SitemapPlugin = require('sitemap-webpack-plugin').default;
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require('webpack');
const pjson = require('./package.json');


var today = () => {
  let d = new Date();
  let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
  let mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(d);
  let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
  return `${ye}-${mo}-${da}`;
}

const paths = [
  {
    path: '/',
    lastmod: true,
    priority: 1,
    changefreq: 'monthly'
  }
]

module.exports = {
  entry: [
    path.resolve(__dirname, './src/index.js'), 
  ],
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'bundle.js',
  },
  // devServer: {
  //   contentBase: path.resolve(__dirname, './dist'),
  // },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: "./src",
          globOptions: {
            ignore: [
              '**/*.scss',
              '**/*.sass',
              '**/index.js'
            ]
          }
        },
      ],
      options: { concurrency: 100 },
    }),
    new WebpackManifestPlugin({
      basePath: "",
      publicPath: "/"
    }),
    new BrowserSyncPlugin({
      host: 'localhost',
      port: 4200,
      server: { baseDir: ['dist'] }
    }),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(pjson.version),
      BUILT: JSON.stringify(today())
    })
  ],
  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      },
      {
        test: /\.html$/i,
        type: "asset/resource",
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
      // `...`
      new TerserPlugin(),
      new HtmlMinimizerPlugin({
        parallel: true,
      }),
    ],
  },
};
