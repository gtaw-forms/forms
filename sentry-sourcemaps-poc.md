# Sentry Source Maps Proof of Concept

This document outlines the steps to configure your Create React App project (using `craco`) to generate and publicly host source maps for Sentry. This will allow Sentry to provide readable stack traces for errors that occur in your minified production code.

## 1. Configure `craco` to Generate Source Maps

First, you need to tell Webpack to generate source maps during the production build. You can do this by modifying your `craco.config.js` file.

```javascript
// craco.config.js
module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'production') {
        webpackConfig.devtool = 'source-map';
      }
      return webpackConfig;
    },
  },
};
```

This configuration will generate source maps for your production build. The `source-map` option is recommended for production as it provides the best quality source maps.

## 2. Host Source Maps Publicly

When you run `npm run build`, the source maps will be generated alongside your other static assets in the `build/static/js` directory. When you deploy your application, these source maps will be publicly accessible.

Sentry will automatically fetch these source maps when it processes an error. It does this by looking for a `SourceMap` header in the HTTP response or by looking for a `//# sourceMappingURL` comment at the bottom of your minified JavaScript files.

## 3. Verify Source Map Configuration

To verify that your source maps are being generated and hosted correctly, you can:

1.  Run `npm run build`.
2.  Inspect the `build/static/js` directory. You should see `.map` files for each of your JavaScript chunks.
3.  Deploy your application.
4.  Open your browser's developer tools and inspect the "Sources" tab. You should see your original, un-minified source code.

## 4. Sentry Configuration

No additional configuration is required in your Sentry project. As long as your source maps are publicly accessible, Sentry will be able to use them to de-minify your error reports.

## Conclusion

By following these steps, you can easily configure your project to generate and host source maps for Sentry. This will give you the benefit of readable stack traces in your Sentry error reports, making it much easier to debug production issues.
