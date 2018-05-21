import * as constants from './constants';
import 'babel-polyfill'
import fetch from 'isomorphic-fetch';
import moment from 'moment';


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
    } 
        
    // Handle internal API errors
    if(response.status == 400) {               
        return response.json().then(json => {
            console.debug('JSON', typeof(json), json);
            if(typeof(json) == 'string') {
                throw {status: 400, statusText: json};
            } else if(typeof(json.detail) == 'string') {
                throw {status: 400, statusText: json.detail};
            } else {
                throw {status: 400, statusText: response.statusText, detail: json.detail};
            }
        });
    }
    
    // Handle 410 badge revocation
    if(response.status == 410) {
        return response.json().then(json => {
            console.debug('JSON', typeof(json), json);
            if(typeof(json) == 'string') {
                throw {status: 410, statusText: json};
            } else if(typeof(json.detail) == 'string') {
                throw {status: 410, statusText: json.detail};
            } else {
                throw {status: 410, statusText: response.statusText, detail: json.detail};
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
        .then((response) => {
            // Handle unauthorized, try to refresh token expiration
            if(response.status == 403) {
                return fetch(constants.AUTH.refreshTokenUrl+token+'/')
                    .then((r) => {
                        if(r.ok) {
                            return fetch(url, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer '+token
                                }
                            }).then(processResponse);
                        }
                        
                        return processResponse(response);
                    });
            } 
            
            return processResponse(response);
        });
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
        .then((response) => {
            // Handle unauthorized, try to refresh token expiration
            if(response.status == 403) {
                return fetch(constants.AUTH.refreshTokenUrl+token+'/')
                    .then((r) => {
                        if(r.ok) {
                            return fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer '+token
                                },
                                body: JSON.stringify(data)
                            }).then(processResponse);
                        }
                        
                        return processResponse(response);
                    });
            }
            
            return processResponse(response);        
        });
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
        .then((response) => {
            // Handle unauthorized, try to refresh token expiration
            if(response.status == 403) {
                return fetch(constants.AUTH.refreshTokenUrl+token+'/')
                    .then((r) => {
                        if(r.ok) {
                            return fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Authorization': 'Bearer '+token
                                },
                                body: formData
                            }).then(processResponse);
                        }
                        
                        return processResponse(response);
                    });
            }
            
            return processResponse(response);        
        });
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
        .then((response) => {
            // Handle unauthorized, try to refresh token expiration
            if(response.status == 403) {
                return fetch(constants.AUTH.refreshTokenUrl+token+'/')
                    .then((r) => {
                        if(r.ok) {
                            return fetch(url, {
                                method: 'PATCH',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer '+token
                                },
                                body: JSON.stringify(data)
                            }).then(processResponse);
                        }
                        
                        return processResponse(response);
                    });
            }
            
            return processResponse(response);        
        });
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
        .then((response) => {
            // Handle unauthorized, try to refresh token expiration
            if(response.status == 403) {
                return fetch(constants.AUTH.refreshTokenUrl+token+'/')
                    .then((r) => {
                        if(r.ok) {
                            return fetch(url, {
                                method: 'DELETE',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer '+token
                                }
                            }).then(processResponse);
                        }
                        
                        return processResponse(response);
                    });
            }
            
            return processResponse(response);        
        });
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

// Dispatch after verifying award status
export function updateAwardStatus(id, verified_dt, revoked, revoked_reason) {
    return {
        type: 'UPDATE_AWARD_STATUS', 
        id: id, 
        verified_dt: verified_dt,
        revoked: revoked,
        revoked_reason: revoked_reason
    };
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

function loadStateSuccess(lastSync) {
    return {type: 'LOAD_STATE_SUCCESS', lastSync: lastSync}; 
}

function fetchUser(dispatchError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_USER_START'});
        
        return fetchGetJSON(constants.API_ROOT+'me/account/')
            .then(json => {
                dispatch(fetchUserSuccess(json));
            })
            .catch((error) => {
                error.action = 'Error fetching user';
                throw error;
            });
    }
}

function fetchTags(dispatchError) {
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

function fetchAwards(dispatchError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_AWARDS_START'});
                
        return fetchGetJSON(constants.API_ROOT+'award/')
            .then(json => {
                dispatch({type: 'FETCH_AWARDS_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching awards';

                if(dispatchError) {
                    dispatch({
                        type: 'FETCH_AWARDS_ERROR', 
                        error: error.action+': '+error.statusText
                    });
                } else {
                    dispatch({type: 'FETCH_AWARDS_END'});
                }
                
                throw error;
            });
    }
}

function fetchEntries(dispatchError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_ENTRIES_START'});
                
        return fetchGetJSON(constants.API_ROOT+'entry/')
            .then(json => {
                dispatch({type: 'FETCH_ENTRIES_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching entries';

                if(dispatchError) {
                    dispatch({
                        type: 'FETCH_ENTRIES_ERROR', 
                        error: error.action+': '+error.statusText
                    });
                } else {
                    dispatch({type: 'FETCH_ENTRIES_END'});
                }
                
                throw error;
            });
    }
}

function fetchShares(dispatchError) {
    return function(dispatch, getState) {
        dispatch({type: 'FETCH_SHARES_START'});
                
        return fetchGetJSON(constants.API_ROOT+'share/')
            .then(json => {
                dispatch({type: 'FETCH_SHARES_SUCCESS', json: json});
            })
            .catch(error => {
                error.action = 'Error fetching shares';

                if(dispatchError) {
                    dispatch({
                        type: 'FETCH_SHARES_ERROR', 
                        error: error.action+': '+error.statusText
                    });
                } else {
                    dispatch({type: 'FETCH_SHARES_END'});
                }
                
                throw error;
            });
    }
}

function setState(state) {
    return {type: 'SET_STATE', state: state};
}

export function loadState(defaultState) {    
    return function(dispatch, getState) {      
        localforage.getItem('state').then(function(value) {
            var cachedState = value || defaultState;
            
            if(cachedState.loaded) {
                console.log('loadState', 'using cached state');
                dispatch(setState(cachedState));
                dispatch(loadStateSuccess(cachedState.lastSync)); 
                
                if(cachedState.isOffline) {
                    return; // We're done
                }
            } else {
                console.log('loadState', 'using default state');
                dispatch(setState(defaultState));
            }

            Promise.all([
                fetchUser(!cachedState.loaded)(dispatch, getState),
                fetchTags(!cachedState.loaded)(dispatch, getState),
                fetchAwards(!cachedState.loaded)(dispatch, getState),
                fetchEntries(!cachedState.loaded)(dispatch, getState),
                fetchShares(!cachedState.loaded)(dispatch, getState),        
            ]).then(() => {  
                console.log('loadState success');
                dispatch(loadStateSuccess(moment.utc().format())); 
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
                console.error('loadState error', error);
               
                if(error.status == 401 || error.status == 403) {
                    dispatch(authorize());
                } else if(!cachedState.loaded) {                  
                    dispatch(loadStateError(error.action+': '+error.statusText));
                }
            });
        }).catch(function(error) {
            console.error('Error loading state', error);
            dispatch(loadStateError('Error loading state: '+error.message));        
        });
    }
}

// Offline mode
export function setIsOffline(isOffline) {
    return {type: 'SET_IS_OFFLINE', isOffline: isOffline}
}

// Dispatch when award synced
export function syncedAward(json) {
    return {type: 'SYNCED_AWARD', json: json};
}

// Dispatch when entry synced
export function syncedEntry(json) {
    return {type: 'SYNCED_ENTRY', json: json};
}

// Dispatch when sync successfully completed
export function syncSuccess(lastSync) {
    return {type: 'SYNC_SUCCESS', lastSync: lastSync};
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

