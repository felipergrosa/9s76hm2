module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Remover ForkTsCheckerWebpackPlugin que está causando problemas
      if (env === "production") {
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          return plugin.constructor.name !== "ForkTsCheckerWebpackPlugin";
        });
      }
      return webpackConfig;
    },
  },
};
