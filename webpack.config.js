const { resolve } = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// core configuration
const coreConfig = {
    context: resolve(__dirname, 'gui'),

    entry: [
        'react-hot-loader/patch',
        'webpack-dev-server/client?http://localhost:8080',
        'webpack/hot/only-dev-server',
        './index.jsx'
    ],

    // tell webpack how to write the compiled files to disk
    output: {
        filename: 'bundle.js',
        path: resolve(__dirname, 'gui-dist', 'js'),
        publicPath: '/js/'
    },

    // webpack-dev-server options
    devServer: {
        // hot module replacement, requires HotModuleReplacementPlugin
        hot: true,
        // where to serve non-compiled content from
        contentBase: [
            resolve(__dirname, 'gui-dist'),
            resolve(__dirname, 'node_modules')
        ],
        // where bundles will be served from, takes precedence over contentBase
        // should be the same as output.publicPath
        publicPath: '/js/'
    },

    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['es2015','react']
                }
            },
            {
                test: /\.jsx$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['es2015','react']
                }
            },
            {
                test: /\.css$/,
                loader: 'style-loader!css-loader'
            },
            {
                test: /\.scss$/,
                loaders: [ 'style-loader', 'css-loader', 'sass-loader' ]
            }
        ]
    },

    plugins: [
        new webpack.HotModuleReplacementPlugin() ,
        new webpack.NamedModulesPlugin(),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production')
        }),
        // copy vendor assets output directory
        new CopyWebpackPlugin([
            {
                from: resolve(__dirname, 'node_modules/jquery/dist/jquery.min.js'),
                to: resolve(__dirname, 'gui-dist/jquery/dist/jquery.min.js')
            },
            {
                from: resolve(__dirname, 'node_modules/bootstrap/dist'),
                to: resolve(__dirname, 'gui-dist/bootstrap/dist')
            },
            {
                from: resolve(__dirname, 'node_modules/font-awesome/css'),
                to: resolve(__dirname, 'gui-dist/font-awesome/css')
            },
            {
                from: resolve(__dirname, 'node_modules/font-awesome/fonts'),
                to: resolve(__dirname, 'gui-dist/font-awesome/fonts')
            },
            {
                from: resolve(__dirname, 'node_modules/arrive/minified/arrive.min.js'),
                to: resolve(__dirname, 'gui-dist/arrive/minified/arrive.min.js')
            },
            {
                from: resolve(__dirname, 'node_modules/bootstrap-material-design/dist'),
                to: resolve(__dirname, 'gui-dist/bootstrap-material-design/dist')
            },
            {
                from: resolve(__dirname, 'node_modules/localforage/dist/localforage.min.js'),
                to: resolve(__dirname, 'gui-dist/localforage/dist/localforage.min.js')
            }],
            {
                copyUnmodified: true
            }
        )
    ]
}

module.exports = function(env) {
    // Add target-dependent config
    if(env.production && env.production == 1) {
        console.log('Building production');

        coreConfig.plugins.push(
            new webpack.DefinePlugin({
                'env.app_root': JSON.stringify('https://www.forallbackpacks.com/app/'),
                'env.server_root': JSON.stringify('https://www.forallbackpacks.com/')
            })
        );
    } else if(env.production && env.production == 2) {
        console.log('Building staging');

        coreConfig.plugins.push(
            new webpack.DefinePlugin({
                'env.app_root': JSON.stringify('https://staging.forallbackpacks.com/app/'),
                'env.server_root': JSON.stringify('https://staging.forallbackpacks.com/')
            })
        );
    } else if(env.production && env.production == 3) {
        console.log('Building testing');

        coreConfig.plugins.push(
            new webpack.DefinePlugin({
                'env.app_root': JSON.stringify('https://testing.forallbackpacks.com/app/'),
                'env.server_root': JSON.stringify('https://testing.forallbackpacks.com/')
            })
        );
    } else {
        console.log('Building development');

        coreConfig.plugins.push(
            new webpack.DefinePlugin({
                'env.app_root': JSON.stringify('http://localhost:8080'),
                'env.server_root': JSON.stringify('http://127.0.0.1:5000/')
            })
        );
    }

    return coreConfig;
}
