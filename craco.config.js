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
        
        // Improve chunk loading reliability with better hash naming
        webpackConfig.output.chunkFilename = 'static/js/[name].[contenthash:8].chunk.js';
        
        // Optimize chunk splitting to reduce chunk loading failures
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            ...webpackConfig.optimization.splitChunks,
            chunks: 'all',
            maxInitialRequests: 25, // Increase to allow more parallel requests
            maxAsyncRequests: 25,
            minSize: 20000, // Minimum chunk size
            maxSize: 244000, // Maximum chunk size to split large chunks
            cacheGroups: {
              ...webpackConfig.optimization.splitChunks?.cacheGroups,
              // Separate vendor chunks by package for better caching
              defaultVendors: {
                test: /[\\/]node_modules[\\/]/,
                name(module) {
                  // Get package name from node_modules path
                  const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                  return packageName ? `vendor.${packageName.replace('@', '')}` : 'vendors';
                },
                priority: -10,
                reuseExistingChunk: true,
              },
              // Create a common chunk for frequently used modules
              common: {
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true,
              },
              // Separate React and React-DOM
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'react',
                priority: 20,
                reuseExistingChunk: true,
              },
              // Separate large libraries
              firebase: {
                test: /[\\/]node_modules[\\/]firebase[\\/]/,
                name: 'firebase',
                priority: 15,
                reuseExistingChunk: true,
              },
              bootstrap: {
                test: /[\\/]node_modules[\\/](react-bootstrap|bootstrap)[\\/]/,
                name: 'bootstrap',
                priority: 15,
                reuseExistingChunk: true,
              },
            },
          },
          // Keep runtime chunk separate for better caching
          runtimeChunk: 'single',
          // Minimize and optimize
          minimize: true,
        };
        
        // Enable prefetch and preload for lazy chunks
        webpackConfig.output.crossOriginLoading = 'anonymous';
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