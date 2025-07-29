const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ["../common"],
  webpack: (config, { isServer }) => {
    // Add path alias for @common
    config.resolve.alias = {
      ...config.resolve.alias,
      "@common": path.resolve(__dirname, "../common"),
      // Commented out preact replacements
      // react: 'preact/compat',
      // 'react-dom/test-utils': 'preact/test-utils',
      // 'react-dom': 'preact/compat',
      // 'react/jsx-runtime': 'preact/jsx-runtime',
      // 'react-dom/server': 'preact-render-to-string'
    };

    // Ignore wallet injection errors in development
    if (!isServer) {
      config.ignoreWarnings = [
        { message: /ethereum/ },
        { message: /can't redefine non-configurable property/ },
      ];
    }

    return config;
  },
  // Suppress hydration warnings for wallet-related components
  reactStrictMode: false,
};
