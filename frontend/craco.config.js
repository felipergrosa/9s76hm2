const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  babel: {
    plugins: [
      // Remove console.log em produção para melhor performance
      ...(process.env.NODE_ENV === 'production' 
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] 
        : [])
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
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        path: "path-browserify",
        buffer: "buffer"
      };

      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false // Permite imports sem extensão .js
        }
      });

      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new NodePolyfillPlugin()
      ];

      // Exclui html2pdf.js do source-map-loader para evitar WARNING de es6-promise.map ausente
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

      // Como fallback, ignora especificamente o warning de source map faltando em html2pdf.js
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        (warning) => {
          const msg = (warning && (warning.message || warning)) || '';
          const resource = warning && warning.module && warning.module.resource;
          return msg.includes('Failed to parse source map') && /html2pdf\.js/.test(String(resource || ''));
        }
      ];

      // Otimização de code splitting para reduzir bundle principal
      if (process.env.NODE_ENV === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            maxInitialRequests: 25,
            minSize: 20000,
            cacheGroups: {
              // Vendors principais (React, Material-UI)
              vendor: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|@material-ui|@mui)[\\/]/,
                name: 'vendor',
                chunks: 'all',
                priority: 20,
              },
              // Bibliotecas pesadas separadas
              charts: {
                test: /[\\/]node_modules[\\/](chart\.js|recharts|react-chartjs)[\\/]/,
                name: 'charts',
                chunks: 'all',
                priority: 15,
              },
              pdf: {
                test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist|html2pdf)[\\/]/,
                name: 'pdf',
                chunks: 'all',
                priority: 15,
              },
              editor: {
                test: /[\\/]node_modules[\\/](draft-js|react-draft|draftjs)[\\/]/,
                name: 'editor',
                chunks: 'all',
                priority: 15,
              },
              // Resto dos node_modules
              commons: {
                test: /[\\/]node_modules[\\/]/,
                name: 'commons',
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
              },
            },
          },
        };
      }

      return webpackConfig;
    }
  }
};
