module.exports = {
  jest: {
    configure: (jestConfig) => {
      jestConfig.transformIgnorePatterns = [
        '/node_modules/(?!react-markdown|remark-gfm)/',
      ];
      return jestConfig;
    },
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'production') {
        webpackConfig.devtool = 'source-map';
      }
      // Add a rule to transpile react-markdown and remark-gfm with babel-loader
      webpackConfig.module.rules.push({
        test: /\.js$/,
        include: [
          /node_modules\/react-markdown/,
          /node_modules\/remark-gfm/,
        ],
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      });
      return webpackConfig;
    },
  },
};