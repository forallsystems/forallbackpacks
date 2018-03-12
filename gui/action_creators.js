import * as constants from './constants';
import 'babel-polyfill'
import fetch from 'isomorphic-fetch';

// for testing
function uuid4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

// Thrown error is one of the following:
// {status: 400, statusText: 'Bad Request', detail: {...}}
// {status: <int>, statusText: <string>}
function processResponse(response) {
    if(response.ok) {
        // Handle empty response bodies
        return Promise.resolve(
            response.text().then(responseText => {
                if(responseText) {
                    return JSON.parse(responseText);
                } else {
                    return {};
                }
            })
        );
        //return Promise.resolve(response.json());
    } 
    
    // Handle internal API errors
    if(response.status == 400) {               
        return response.json().then(json => {
            console.log('JSON', typeof(json), json);
            if(typeof(json) == 'string') {
                throw {status: 400, statusText: json};
            } else if(typeof(json.detail) == 'string') {
                throw {status: 400, statusText: json.detail};
            } else {
                throw {status: 400, statusText: response.statusText, detail: json.detail};
            }
        });
    }
    
    // Handle other (e.g. 404)
    return Promise.reject({status: response.status, statusText: response.statusText});
}

export function fetchGetJSON(url) {
    return localforage.getItem('token').then(function(token) {
        return fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+token
            }
        })
        .then(processResponse);
    });
}

export function fetchPostJSON(url, data) {
    return localforage.getItem('token').then(function(token) {
        return fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+token
            },
            body: JSON.stringify(data)
        })
        .then(processResponse);
    });
}

export function fetchPostFormData(url, formData) {
    return localforage.getItem('token').then(function(token) {
        return fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
//              'Content-Type': 'application/json',
                'Authorization': 'Bearer '+token
            },
            body: formData
        })
        .then(processResponse);
    });
}

export function fetchPatchJSON(url, data) {
    return localforage.getItem('token').then(function(token) {
        return fetch(url, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+token
            },
            body: JSON.stringify(data)
        })
        .then(processResponse);
    });
}

export function fetchDeleteJSON(url) {
    return localforage.getItem('token').then(function(token) {
        return fetch(url, {
            method: 'DELETE',
            headers: {                
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+token
            }

        })
        .then(processResponse);
    });
}

// Dispatch to report global error
export function setError(action, error) {
    return {type: 'ERROR', error: action+' ['+error+']'};
}

// Dispatch when email added
export function addEmail(json) {
    return {type: 'ADD_EMAIL', json: json};
}

// Dispatch when primary email changed
export function setPrimaryEmail(id) {
    return {type: 'SET_PRIMARY_EMAIL', id: id};
}

// Dispatch when email deleted
export function deleteEmail(id) {
    return {type: 'DELETE_EMAIL', id: id};
}

// Dispatch when award added (claimed)
export function addAward(json) {
    return {type: 'ADD_AWARD', json: json};
}

// Dispatch when award tags updated
export function updateAwardTags(id, tags) {
    return {type: 'UPDATE_AWARD_TAGS', id: id, tags: tags};
}

// Dispatch when award deleted
export function deleteAward(id) {
    return {type: 'DELETE_AWARD', id: id};
}

// Dispatch when entry added
export function addEntry(json) {
    return {type: 'ADD_ENTRY', json: json};
}

// Dispatch when entry updated (separate from tag update)
export function updateEntry(json) {
    return {type: 'UPDATE_ENTRY', json: json};
}

// Dispatch when entry tags updated
export function updateEntryTags(id, tags) {
    return {type: 'UPDATE_ENTRY_TAGS', id: id, tags: tags};
}

// Dispatch when entry deleted
export function deleteEntry(id) {
    return {type: 'DELETE_ENTRY', id: id};
}

// Dispatch when share added
export function addShare(json) {
    return {type: 'ADD_SHARE', json: json};
}

// Dispatch when share deleted
export function deleteShare(id) {
    return {type: 'DELETE_SHARE', id: id};
}

// Dispatch when app (maybe) added
export function addApp(json) {
    return {type: 'ADD_APP', json: json};
}

// Dispatch when need to (re)authorize
function authorize() {
    return function(dispatch, getState) {
        console.debug('(re)authorizing');
        
        // Clear all cached state
        localforage.clear().then(function() {
            // Redirect for reauthorization
            dispatch({type: 'REDIRECT', url: '/'});
        }).catch(function(error) {
            dispatch(setError('Error clearing state', error));
        });    
    }
}

// Dispatch when user information updated
export function fetchUserSuccess(json) {
    return {type: 'FETCH_USER_SUCCESS', json: json};
}

function loadStateError(error) {
    return {type: 'LOAD_STATE_ERROR', error: error};
}

function loadStateSuccess(json) {
    return {type: 'LOAD_STATE_SUCCESS'}; 
}

function fetchUser(throwError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_USER_START'});
        
        return fetchGetJSON(constants.API_ROOT+'me/account/')
            .then(json => {
                dispatch(fetchUserSuccess(json));
            })
            .catch((error) => {
                error.action = 'Error fetching user';
                
                if(throwError) {
                    throw error;
                }
            });
    }
}

function fetchTags() {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_TAGS_START'});
    
        return fetchGetJSON(constants.API_ROOT+'tag/')
            .then(json => {
                dispatch({type: 'FETCH_TAGS_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching tags';
                throw error;
            });
    }
}

function fetchAwards(throwError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_AWARDS_START'});
                
        return fetchGetJSON(constants.API_ROOT+'award/')
            .then(json => {
                dispatch({type: 'FETCH_AWARDS_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching awards';

                dispatch({
                    type: 'FETCH_AWARDS_ERROR', 
                    error: error.action+': '+error.statusText
                });
                
                if(throwError) {
                    throw error;
                }
            });
    }
}

function fetchEntries(throwError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_ENTRIES_START'});
                
        return fetchGetJSON(constants.API_ROOT+'entry/')
            .then(json => {
                dispatch({type: 'FETCH_ENTRIES_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching entries';

                dispatch({
                    type: 'FETCH_ENTRIES_ERROR', 
                    error: error.action+': '+error.statusText
                });
                
                if(throwError) {
                    throw error;
                }
            });
    }
}

function fetchShares(throwError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_SHARES_START'});
                
        return fetchGetJSON(constants.API_ROOT+'share/')
            .then(json => {
                dispatch({type: 'FETCH_SHARES_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching shares';

                dispatch({
                    type: 'FETCH_SHARES_ERROR', 
                    error: error.action+': '+error.statusText
                });
                
                if(throwError) {
                    throw error;
                }
            });
    }
}

function setState(state) {
    return {type: 'SET_STATE', state: state};
}

export function loadState(defaultState) {    
    return function(dispatch, getState) {                 
        localforage.getItem('state').then(function(value) {
            if(value) {
                dispatch(setState(value));
                
                if(value.loaded) {
                    dispatch(loadStateSuccess());
                  
                    // Reload awards, entries, shares
                    if(window.performance.navigation.type == 1) {  
                        dispatch(fetchUser(false));
                        dispatch(fetchAwards(false));
                        dispatch(fetchEntries(false));
                        dispatch(fetchShares(false));
                    }                    
                    return; // we're done
                }
            } else {
                dispatch(setState(defaultState));
            }
                       
            Promise.all([
                fetchUser(true)(dispatch, getState),
                fetchTags()(dispatch, getState),
                fetchAwards(true)(dispatch, getState),
                fetchEntries(true)(dispatch, getState),
                fetchShares(true)(dispatch, getState),
                // add more here           
            ]).then(() => {  
                dispatch(loadStateSuccess()); 
                /* If we needed 2-stage loading, this is how we'd do it...          
                Promise.all([
                    fetchAwards()(dispatch, getState)
                    // add more here
                ]).then(() => {
                    dispatch(loadStateSuccess());
                }).catch((error) => {
                    console.error('Caught promise #2 error', error);
                    dispatch(loadStateError(error.action+': '+error.statusText));
                });   
                */             
            }).catch((error) => {
                if(error.status == 401 || error.status == 403) {
                    console.error('Caught unauthorized error');
                    dispatch(authorize());
                } else {
                    console.error('Caught error', error);
                    dispatch(loadStateError(error.action+': '+error.statusText));
                }
            });
        }).catch(function(error) {
            console.error('Error loading state', error);
            dispatch(loadStateError('Error loading state: '+error.message));        
        });
    }
}

// Logout
//
function logoutError(error) {
    return {type: 'LOGOUT_ERROR', error: error};
}

function logoutSuccess(redirectUrl) {
    return {type: 'LOGOUT_SUCCESS', redirectUrl: redirectUrl};
}

export function logout() {
    return function(dispatch, getState) {
        // Load token
        localforage.getItem('token').then(function(token) {
            // Revoke token
            var revokeUrl = constants.AUTH.revokeTokenUrl
                +'?client_id='+constants.AUTH.clientId+'&token='+token;
                            
            console.debug('Revoking token', revokeUrl);
            
            fetch(revokeUrl, {method: 'POST'})
                .then(function(response) {
                    console.debug('Got response', response.status);                       
                    return response.status;
                })
                .then(function(status) { 
                    console.debug('Clearing localforage');
                        
                    localforage.clear().then(function() {
                        console.debug('Now really logging out');
                        dispatch(logoutSuccess(constants.AUTH.logoutUrl));                        
                    }).catch(function(error) {
                        dispatch(logoutError('Error clearing state: '+error.message));
                    });
                })
                .catch(function(error) {
                    dispatch(logoutError('Error revoking token ['+error+']'));
                });  
        }).catch(function(error) {
            dispatch(logoutError('Error getting token: '+error.message));   
        });          
    };
}

