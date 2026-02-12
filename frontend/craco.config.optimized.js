const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const getRemoveConsolePlugin = () => {
  if (process.env.NODE_ENV !== "production") return [];
  try {
    require.resolve("babel-plugin-transform-remove-console");
    return [["transform-remove-console", { exclude: ["error", "warn"] }]];
  } catch {
    return [];
  }
};

module.exports = {
  babel: {
    plugins: [
      ...getRemoveConsolePlugin()
    ]
  },
  style: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Otimizações de performance
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            materialUI: {
              test: /[\\/]node_modules[\\/](@material-ui|@mui)[\\/]/,
              name: 'material-ui',
              chunks: 'all',
              priority: 20,
            },
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 30,
            },
          },
        },
        runtimeChunk: 'single',
      };

      // Adicionar plugins de otimização
      if (env === 'production') {
        webpackConfig.plugins = [
          ...(webpackConfig.plugins || []),
          new NodePolyfillPlugin(),
          new CompressionPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,
            threshold: 8192,
            minRatio: 0.8,
          }),
        ];
      } else {
        webpackConfig.plugins = [
          ...(webpackConfig.plugins || []),
          new NodePolyfillPlugin(),
          // Bundle analyzer apenas em desenvolvimento
          ...(process.env.ANALYZE === 'true' ? [new BundleAnalyzerPlugin()] : []),
        ];
      }

      // Resolver fallbacks
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        path: "path-browserify",
        buffer: "buffer",
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
      };

      // Module rules
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      });

      // Excluir source maps problemáticos
      const addExcludeForSourceMapLoader = (rule) => {
        if (!rule) return;
        const add = (obj) => {
          if (!obj) return;
          if (obj.loader && obj.loader.includes('source-map-loader')) {
            obj.exclude = Array.isArray(obj.exclude)
              ? [...obj.exclude, /html2pdf\.js/]
              : [/html2pdf\.js/];
          }
        };
        add(rule);
        if (Array.isArray(rule.use)) rule.use.forEach(add);
        if (Array.isArray(rule.oneOf)) rule.oneOf.forEach(addExcludeForSourceMapLoader);
        if (Array.isArray(rule.rules)) rule.rules.forEach(addExcludeForSourceMapLoader);
      };

      if (webpackConfig && webpackConfig.module && Array.isArray(webpackConfig.module.rules)) {
        webpackConfig.module.rules.forEach(addExcludeForSourceMapLoader);
      }

      // Ignorar warnings específicos
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        (warning) => {
          const msg = (warning && (warning.message || warning)) || '';
          const resource = warning && warning.module && warning.module.resource;
          return msg.includes('Failed to parse source map') && /html2pdf\.js/.test(String(resource || ''));
        },
        /Failed to parse source map/,
        /source-map-loader/,
      ];

      // Melhorar cache
      webpackConfig.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };

      return webpackConfig;
    }
  }
};
