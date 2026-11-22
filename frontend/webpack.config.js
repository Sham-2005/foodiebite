const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const fs = require('fs');

// Robust environment variable loader supporting frontend/.env and root .env
const frontendDotenv = path.resolve(__dirname, '.env');
const rootDotenv = path.resolve(__dirname, '../.env');
const env = {};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const matched = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (matched) {
      const key = matched[1];
      let value = (matched[2] || '').trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1).trim();
      }
      env[key] = value;
    }
  });
}

// 1. Load root .env (base)
parseEnvFile(rootDotenv);
// 2. Load frontend .env (overrides root)
parseEnvFile(frontendDotenv);

// 2b. Merge system environment variables (vital for Vercel, Render, CI/CD where .env is not committed)
if (typeof process !== 'undefined' && process.env) {
  Object.keys(process.env).forEach(key => {
    if (
      key.startsWith('REACT_APP_') ||
      key.startsWith('NEXT_PUBLIC_') ||
      key === 'NODE_ENV' ||
      key === 'PUBLIC_URL' ||
      key === 'VERCEL_URL' ||
      key === 'VERCEL_ENV'
    ) {
      if (process.env[key] !== undefined && (env[key] === undefined || env[key] === '')) {
        env[key] = process.env[key];
      }
    }
  });
}

// 3. Mirror NEXT_PUBLIC_ and REACT_APP_ Supabase aliases for seamless interoperability
const resolvedSupabaseUrl =
  env.NEXT_PUBLIC_SUPABASE_URL ||
  env.REACT_APP_SUPABASE_URL ||
  (process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  (process.env && process.env.REACT_APP_SUPABASE_URL) ||
  '';

const resolvedSupabaseKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.REACT_APP_SUPABASE_ANON_KEY ||
  (process.env && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  (process.env && process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY) ||
  '';

if (resolvedSupabaseUrl) {
  env.NEXT_PUBLIC_SUPABASE_URL = resolvedSupabaseUrl;
  env.REACT_APP_SUPABASE_URL = resolvedSupabaseUrl;
}
if (resolvedSupabaseKey) {
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = resolvedSupabaseKey;
  env.REACT_APP_SUPABASE_PUBLISHABLE_KEY = resolvedSupabaseKey;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = resolvedSupabaseKey;
  env.REACT_APP_SUPABASE_ANON_KEY = resolvedSupabaseKey;
}

// 4. Mirror API URL aliases
const resolvedApiUrl =
  env.NEXT_PUBLIC_API_URL ||
  env.REACT_APP_API_URL ||
  (process.env && process.env.NEXT_PUBLIC_API_URL) ||
  (process.env && process.env.REACT_APP_API_URL) ||
  '';

if (resolvedApiUrl) {
  env.NEXT_PUBLIC_API_URL = resolvedApiUrl;
  env.REACT_APP_API_URL = resolvedApiUrl;
}

// 5. Mirror Google Web Client ID aliases
const resolvedGoogleClientId =
  env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  env.REACT_APP_GOOGLE_WEB_CLIENT_ID ||
  (process.env && process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
  (process.env && process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID) ||
  '';

if (resolvedGoogleClientId) {
  env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID = resolvedGoogleClientId;
  env.REACT_APP_GOOGLE_WEB_CLIENT_ID = resolvedGoogleClientId;
}

// Enforce Render production backend in production builds if not explicitly overridden
const isProdBuild = process.env.NODE_ENV === 'production' || process.argv.includes('production') || process.argv.includes('--mode=production');
if (isProdBuild && (!env.REACT_APP_API_URL || env.REACT_APP_API_URL.includes('localhost'))) {
  env.REACT_APP_API_URL = 'https://foodiebite-backend.onrender.com/api';
  env.NEXT_PUBLIC_API_URL = 'https://foodiebite-backend.onrender.com/api';
}

const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

// Guarantee fallback definitions for all expected Supabase keys so no unreplaced identifier throws at runtime
const supabaseKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'REACT_APP_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'REACT_APP_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
];
supabaseKeys.forEach(k => {
  const fullKey = `process.env.${k}`;
  if (!envKeys[fullKey]) {
    envKeys[fullKey] = JSON.stringify('');
  }
});

module.exports = {
  entry: path.resolve(__dirname, 'index.web.js'),
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    publicPath: process.env.PUBLIC_URL || '/',
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
      'process.env': JSON.stringify(env),
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
    })
  ],
  performance: {
    hints: false,
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      // Stub out native-only Google Sign-In on Web so it never leaks into webpack
      '@react-native-google-signin/google-signin$': path.resolve(__dirname, 'src/services/googleSigninWebStub.js'),
      // react-native-image-picker: keep alias so any remaining import still gets the web mock
      'react-native-image-picker$': path.resolve(__dirname, 'src/services/imagePickerMock.js'),
      // react-native-document-picker: native-only module — stub it out for the web bundle
      'react-native-document-picker$': path.resolve(__dirname, 'src/services/documentPickerWebStub.js'),
      // react-native-reanimated: optional peer dependency of gesture-handler, provide web stub so webpack resolves without error
      'react-native-reanimated$': path.resolve(__dirname, 'src/services/reanimatedWebStub.js'),
      // Fix gesture-handler 2.18.0 PressableProps type export warning in ESM
      [path.resolve(__dirname, 'node_modules/react-native-gesture-handler/lib/module/components/Pressable/PressableProps')]: path.resolve(__dirname, 'src/services/pressablePropsWebStub.js'),
      [path.resolve(__dirname, 'node_modules/react-native-gesture-handler/lib/module/components/Pressable/PressableProps.js')]: path.resolve(__dirname, 'src/services/pressablePropsWebStub.js'),
    },
    extensions: ['.web.js', '.js', '.jsx', '.json'],
    mainFields: ['browser', 'module', 'main']
  },
  devServer: {
    historyApiFallback: true,
    port: 3000,
    hot: true,
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    },
    proxy: [
      {
        context: ['/uploads', '/api'],
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    ]
  }
};
