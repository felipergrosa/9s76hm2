const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

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

      return webpackConfig;
    }
  }
};
