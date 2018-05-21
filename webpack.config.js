const { resolve } = require('path');
const webpack = require('webpack');
const WebpackShellPlugin = require('webpack-shell-plugin');

//
// manifest configuration
//
const manifestScript = resolve(__dirname, 'write-manifest.py');
const manifestVersion = '0.1.0';
const manifestDir = resolve(__dirname, 'gui-dist');

//
// core configuration
//
const coreConfig = {
    context: resolve(__dirname, 'gui'),

    entry: [
// add these in module.exports?
//        'react-hot-loader/patch',
//        'webpack-dev-server/client?http://localhost:8080',
//        'webpack/hot/only-dev-server',
        './index.jsx'
    ],

    // tell webpack how to write the compiled files to disk
    output: {
        // output file name 'template'
        filename: 'bundle.js',
        // absolute path to directory for output files
        path: resolve(__dirname, 'gui-dist', 'js'),
        // the url to the output directory resolved relative to the HTML page
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
        })
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
    } else if(env.production && env.production == 'dev') {
        console.log('Building development');
        
        coreConfig.plugins.push(
            new webpack.DefinePlugin({
                'env.app_root': JSON.stringify('http://localhost:8080'),
                'env.server_root': JSON.stringify('http://0.0.0.0:5000/')
            })
        );
    } else {
        console.log('Building for webpack-dev-server');

        coreConfig.entry = [
            'react-hot-loader/patch',
            'webpack-dev-server/client?http://localhost:8080',
            'webpack/hot/only-dev-server'
        ].concat(coreConfig.entry);

        coreConfig.plugins.push(
            new webpack.DefinePlugin({
                'env.app_root': JSON.stringify('http://localhost:8080'),
                'env.server_root': JSON.stringify('http://0.0.0.0:5000/')
            })
        );
    }

    // Write manifest with default timestamp
    coreConfig.plugins.push(
        new WebpackShellPlugin({
            onBuildExit: ['python '+manifestScript+' '+manifestDir]
        })
    );

    return coreConfig;
}
