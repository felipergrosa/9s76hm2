const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
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

      // Otimizações de code splitting (apenas em produção)
      if (process.env.NODE_ENV === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Bundle separado para vendor (node_modules)
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20
              },
              // Bundle separado para Material-UI (biblioteca grande)
              materialUI: {
                name: 'material-ui',
                test: /[\\/]node_modules[\\/](@material-ui|@mui)[\\/]/,
                chunks: 'all',
                priority: 30
              },
              // Bundle separado para React e React DOM
              react: {
                name: 'react',
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                chunks: 'all',
                priority: 40
              },
              // Bundle separado para bibliotecas de gráficos (pesadas)
              charts: {
                name: 'charts',
                test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2|recharts)[\\/]/,
                chunks: 'all',
                priority: 25
              },
              // Bundle separado para bibliotecas de PDF (pesadas)
              pdf: {
                name: 'pdf',
                test: /[\\/]node_modules[\\/](react-pdf|html2pdf\.js)[\\/]/,
                chunks: 'all',
                priority: 25
              },
              // Bundle separado para Socket.IO
              socket: {
                name: 'socket',
                test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
                chunks: 'all',
                priority: 25
              },
              // Common chunks para código compartilhado entre páginas
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true
              }
            }
          },
          // Otimizações adicionais
          moduleIds: 'deterministic',
          runtimeChunk: 'single',
        };
      }

      // Configuração do TerserPlugin para remover console.logs em produção
      // DEVE SER FEITO DEPOIS de configurar optimization
      if (process.env.NODE_ENV === 'production') {
        const TerserPlugin = require('terser-webpack-plugin');
        
        // Garantir que minimizer existe
        if (!webpackConfig.optimization.minimizer) {
          webpackConfig.optimization.minimizer = [];
        }
        
        // Procurar TerserPlugin existente
        const terserPluginIndex = webpackConfig.optimization.minimizer.findIndex(
          (plugin) => plugin.constructor.name === 'TerserPlugin' || 
                      (plugin.constructor && plugin.constructor.name && plugin.constructor.name.includes('Terser'))
        );
        
        // Criar configuração do TerserPlugin para remover console.logs
        const terserConfig = new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // Remove todos os console.* em produção
              drop_debugger: true, // Remove debugger
              pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'], // Remove funções específicas
            },
            output: {
              comments: false, // Remove comentários
            },
          },
          extractComments: false, // Não extrai comentários para arquivo separado
        });
        
        if (terserPluginIndex >= 0) {
          // Substituir configuração existente
          webpackConfig.optimization.minimizer[terserPluginIndex] = terserConfig;
        } else {
          // Adicionar TerserPlugin se não existir (deve estar presente por padrão no CRA)
          // Mas se não estiver, adicionamos
          webpackConfig.optimization.minimizer.push(terserConfig);
        }
      }

      return webpackConfig;
    }
  }
};
