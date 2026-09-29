const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const webpack = require("webpack");

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
      // Remove console.log em produção para melhor performance
      ...getRemoveConsolePlugin()
    ]
  },
  style: {
    postcss: {
      mode: "extends",
      loaderOptions: (postcssLoaderOptions) => {
        postcssLoaderOptions.postcssOptions.plugins = [
          require('@tailwindcss/postcss'),
          require('autoprefixer'),
        ];
        return postcssLoaderOptions;
      },
    },
  },
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Desabilita ESLint e ForkTsChecker em produção para acelerar o build
      const pluginsToFilter = ['ESLintWebpackPlugin'];
      if (env === 'production') {
        pluginsToFilter.push('ForkTsCheckerWebpackPlugin');
      }

      webpackConfig.plugins = webpackConfig.plugins.filter(plugin =>
        !pluginsToFilter.includes(plugin.constructor.name)
      );

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

      // Otimização de chunks: deixa o splitChunks padrão do webpack dividir por rota.
      // REMOVIDO: cacheGroups "vendor"/"materialUI" que forçavam TODO node_modules
      // (xlsx, jspdf, react-pdf, reactflow, leaflet, chart.js, kbar, jssip...) em um
      // único chunk 'vendors' carregado antes mesmo do login, anulando o React.lazy.
      if (env === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
          },
        };
        // Limita workers do Terser: cada worker duplica a AST na memória.
        // Com ~150 chunks (splitChunks por rota), o padrão (cpus-1) estourava
        // o heap do container no CI e causava OOM (exit 255).
        webpackConfig.optimization.minimizer = (webpackConfig.optimization.minimizer || []).map(
          (minimizer) => {
            if (minimizer && minimizer.constructor && minimizer.constructor.name === 'TerserPlugin') {
              minimizer.options.parallel = 2;
            }
            return minimizer;
          }
        );
      }

      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new NodePolyfillPlugin(),
        // Remove todos os locales do moment (~250KB); o pt-br é importado
        // explicitamente em src/hooks/useAuth.js (onde moment.locale('pt-br') é usado)
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\/locale$/,
          contextRegExp: /moment$/,
        })
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

      return webpackConfig;
    }
  }
};
