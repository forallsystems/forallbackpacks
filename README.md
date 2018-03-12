### Front-End Setup

Install latest npm (v6.10.2) from https://nodejs.org/en/, and make sure `/usr/local/bin/` is in your `$PATH`.

Install required node modules from `package.json`:
```
$ npm install
```



### Front-End Overview

`package.json` contains all the node dependencies for this project.  **Additional node modules should always be installed with** `npm install --save-dev <module name>`.  This will save an entry for the module in the `package.json` file and prevent us from having to commit the entire contents of `node_modules/` to the repository.

`webpack.config.js` is the webpack configuration file, which configures both the operation of the webpack development server and the webpack build process (see below).  We should be able to configure different build targets (e.g. dev vs. production), but I haven't looked into that yet.

`gui/` contains the primary source files for the front-end GUI.  Both the webpack dev server and the distributable app require some content that has been pre-placed in `gui-dist/` (i.e. the index.html, css file, image files).

`gui-dist/` is where webpack writes the output from the build process

### Front-End Development

Start the webpack dev server with either of these commands, after which `gui-dist/index.html` should be accessible at http://localhost:8080
```
$ webpack-dev-server
$ npm start
```

Hot loading for the webpack dev server should be working, but you will have to manually reload the page and or kill/restart it for css changes in the external css file to show up.

The front-end requires the back-end to be running for user login/authorization and to load data.  The location of the back-end server is defined as `SERVER_ROOT` in `gui/constants.js`.  You are free to change this, but note that 3rd-party authorizations (Dropbox, etc) will not work unless the appropriates entries are in the various lists of authorized origins and/or redirect URIs.

### Front-End Build/Distribution

Build the front-end application with either of these commands:
```
$ node_modules/.bin/webpack
$ npm run-script build
```

This compiles all node dependencies code into `gui-dist/js/bundle.js`.  Per the `webpack.config.js`, it also copies certain UMD assets from `node_modules/` (i.e. fontawesome, bootstrap, etc)... because I couldn't figure out how to get localforage working using JS `import`, so I just left it how I had it originally.

After the build, `gui-dist/` should be a self-contained static website (you should be able to load the index.html in your browser).
