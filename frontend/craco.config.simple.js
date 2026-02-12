module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      if (env === "production") {
        // Remover completamente o ForkTsCheckerWebpackPlugin e ESLint
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          const name = plugin.constructor.name;
          return name !== "ForkTsCheckerWebpackPlugin" && 
                 name !== "ESLintWebpackPlugin";
        });
      }
      return webpackConfig;
    },
  }
};
