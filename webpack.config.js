const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
  mode: 'development',
  entry: isProduction 
    ? { main: './src/index.js' }
    : { main: './src/index.js', demo: './examples/demo/demo.js' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    library: 'QuillSpeechToText',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: isProduction
    ? []
    : [
        new HtmlWebpackPlugin({
          template: './examples/demo/index.html',
          filename: 'index.html',
          chunks: ['demo']
        })
      ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
  }
  };
};
