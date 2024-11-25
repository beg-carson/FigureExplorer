const ESLintWebpackPlugin = require('eslint-webpack-plugin');

module.exports = {
    webpack: {
        configure: {
            module: {
                rules: [
                    {
                        test: /\.wasm$/,
                        type: 'javascript/auto',
                    }
                ]
            },
            resolve: {
                fallback: {
                    "fs": false,
                    "crypto": false,
                    "path": require.resolve("path-browserify")
                }
            }
        }
    }
};
