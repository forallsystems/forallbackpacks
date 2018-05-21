import React from 'react';
import ReactDOM from 'react-dom';
import {HashRouter as Router, Route, Redirect, Switch} from 'react-router-dom'
import {createStore, applyMiddleware} from 'redux';
import {Provider} from 'react-redux';
import thunkMiddleware from 'redux-thunk'
import createHashHistory from 'history/createHashHistory'
//import initReactFastclick from 'react-fastclick';
import * as constants from './constants';
import {redirectToLogin} from './auth';
import loggingMiddleware from './logging_middleware';
import {reducer} from './reducer.jsx';
import {setError, loadState} from './action_creators';
import {parseQueryString} from './components/common.jsx';
import {App} from './components/App.jsx';
import {Badge} from './components/Badge.jsx';
import {BadgeList} from './components/BadgeList.jsx';
import {EntryEdit} from './components/EntryEdit.jsx';
import {EntryView} from './components/EntryView.jsx';
import {MyAccount} from './components/MyAccount.jsx';
import {PledgeEdit} from './components/PledgeEdit.jsx';
import {PledgeView} from './components/PledgeView.jsx';
import {Portfolio} from './components/Portfolio.jsx';
import {Timeline} from './components/Timeline.jsx';


// django-oauth-toolkit redirects back to <request-uri>/#/access_token=...
// => location.hash = #/access_token=...
function parseHashString() {
    var parsedParameters = {};

    if(location.hash.length > 2) {
        var hashParameters = location.hash.substr(2).split('&');

        for(var i = 0; i < hashParameters.length; i++) {
            var parameter = hashParameters[i].split('=');
            parsedParameters[parameter[0]] = decodeURIComponent(parameter[1]);
        }
    }

    return parsedParameters;
}

function redirect(url) {
    document.location.href = url;
}

// Process referrer
//
// Post-export auth redirect will have location.hash = '...?oa=xx%...'
// We don't mess with the stored referrer on post-export auth redirects or page reloads
// (post-export auth redirect will have location.hash = '...?oa=xx%...')
//
if(!document.location.hash.match(/\?oa=[a-z]{2}&/)
&& window.performance.navigation.type != 1) 
{
    var match = document.referrer.match(/^https?:\/\/[^\/]+/);
    
    if(match && match != constants.APP_ROOT) {
        sessionStorage.setItem('referrer', match[0]);
    } else {
        sessionStorage.removeItem('referrer');
    }   
} 

// Create store
const store = createStore(
    reducer,
    applyMiddleware(
        thunkMiddleware,    // lets us dispatch() functions
        loggingMiddleware   // debugging
    )
);

// Create history
var history = createHashHistory()

// Init fastclick
//initReactFastclick();

// Render app
ReactDOM.render(
    <Provider store={store}>
        <Router history={history}>
            <App>
                <Switch>
                    <Route path="/badges/:awardId" component={Badge}  />
                    <Route path="/badges"  component={BadgeList}  />
                    <Route path="/entry/edit/:entryId" component={EntryEdit} />
                    <Route path="/entry/edit" component={EntryEdit} />
                    <Route path="/entry/view/:entryId" component={EntryView} />
                    <Route path="/eportfolio" component={Portfolio} />
                    <Route path="/my-account" component={MyAccount} />
                    <Route path="/pledge/edit/:awardId" component={PledgeEdit} />
                    <Route path="/pledge/view/:awardId" component={PledgeView} />
                    <Route path="/timeline" component={Timeline} />
                    <Route render={() =>  <Redirect to="/badges" />} />
                </Switch>
            </App>
        </Router>
    </Provider>,
    document.getElementById('root')
);

// Check hash params for post-login authorization
var hashParams = parseHashString();

// Check query params for uid
var queryParams = parseQueryString();

if(hashParams.access_token && hashParams.state) {
    console.debug('Got token and state', hashParams.access_token, hashParams.state);

    // Get stored authState
    localforage.getItem('authState').then(function(authState) {
        // Clear stored authState
        localforage.removeItem('authState').then(function() {
            // Validate authState
            if(authState == hashParams.state) {
                // Store token
                localforage.setItem('token', hashParams.access_token).then(function () {
                    // Redirect to self without weird hash
                    redirect(location.pathname);
                }).catch(function(error) {
                    store.dispatch(setError('Error storing token', error));
                });
            } else {
                redirectToLogin(store);
            }
        }).catch(function(error) {
            store.dispatch(setError('Error clearing authState', error));
        });
    });
} else {
    // Check for token
    console.debug('Checking for token');
    
    localforage.getItem('token').then(function(token) {
        console.debug('Found token', token);

        if(token) {
            // Check for uid
            if(queryParams.uid) {
                localforage.getItem('state').then(function(cachedState) {
                    if(cachedState && cachedState.user && cachedState.user.id == queryParams.uid) {
                        // Retain cached state    
                        redirect(constants.APP_ROOT);                  
                    } else {
                        // Clear cached state
                        localforage.removeItem('state').then(function() {
                            redirect(constants.APP_ROOT);
                        }).catch(function(err) {
                            store.dispatch(setError('Error clearing state'));
                        });                       
                    }
                }).catch(function(error) {
                    store.dispatch(setError('Error retrieving state', error));
                });            
            } else {
                console.debug('Using cache state');
                store.dispatch(loadState(constants.DEFAULT_STATE));                    
            }
        } else {
            redirectToLogin(store);
        }
    }).catch(function(error) {
        store.dispatch(setError('Error retrieving token', error));
    });
}
