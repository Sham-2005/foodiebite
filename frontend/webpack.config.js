const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const fs = require('fs');

// Simple helper to load environment variables from .env if present
const dotenvPath = path.resolve(__dirname, '.env');
const env = {};
if (fs.existsSync(dotenvPath)) {
  const content = fs.readFileSync(dotenvPath, 'utf-8');
  content.split('\n').forEach(line => {
    const matched = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (matched) {
      const key = matched[1];
      let value = matched[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value;
    }
  });
}

const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = {
  entry: path.resolve(__dirname, 'index.web.js'),
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    publicPath: '/',
    clean: true,
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            const context = module.context || '';
            const pkgMatch = context.match(/[\\/]node_modules[\\/](?:@([^\\/]+)[\\/])?([^\\/]+)/);
            if (pkgMatch) {
              const pkg = pkgMatch[1] ? `${pkgMatch[1]}-${pkgMatch[2]}` : pkgMatch[2];
              if (pkg.includes('firebase')) return 'vendor-firebase';
              if (pkg.includes('react-dom') || pkg.includes('react-native-web')) return 'vendor-react-web';
              if (pkg.includes('lucide')) return 'vendor-icons';
              if (pkg.includes('tesseract')) return 'vendor-tesseract';
            }
            return 'vendor';
          },
          priority: -10,
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: (filePath) => {
          if (!filePath) return false;
          const isNodeModules = /[\\/]node_modules[\\/]/.test(filePath);
          if (!isNodeModules) return false;
          // Whitelist packages that need transpilation by babel for web
          return !/[\\/]node_modules[\\/](react-native-vector-icons|react-native-safe-area-context|lucide-react-native|react-native-svg)[\\/]/.test(filePath);
        },
        use: {
          loader: 'babel-loader',
          options: {
            configFile: false,
            babelrc: false,
            presets: [
              ['@babel/preset-env', { targets: { chrome: '80' } }],
              '@babel/preset-react'
            ],
            plugins: ['react-native-web']
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg|jpg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html')
    }),
    new webpack.DefinePlugin({
      ...envKeys,
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
    })
  ],
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      // react-native-image-picker: keep alias so any remaining import still gets the web mock
      'react-native-image-picker$': path.resolve(__dirname, 'src/services/imagePickerMock.js'),
      // react-native-document-picker: native-only module — stub it out for the web bundle
      'react-native-document-picker$': path.resolve(__dirname, 'src/services/documentPickerWebStub.js'),
    },
    extensions: ['.web.js', '.js', '.jsx', '.json'],
    mainFields: ['browser', 'module', 'main']
  },
  devServer: {
    historyApiFallback: true,
    port: 3000,
    hot: true,
    proxy: [
      {
        context: ['/uploads', '/api'],
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    ]
  }
};
