import {List, Map, Set, fromJS} from 'immutable';
import * as constants from './constants';


// Cache state as plain JS
function cacheState(state, logToConsole) {
    localforage.setItem('state', state.toJS()).then(function(value) {
        if(logToConsole) {
            console.debug('Cached state', state.toJS());
        }
    }).catch(function(err) {
        console.error('Error caching state', err);
    });

    return state;
}

// Compile new 'tags' for tagType
function compileTags(state, tagType, itemsById) {
    var tagTypeSet = Set();

    itemsById.forEach(function(d) {
        if(!d.get('is_deleted')) {
            tagTypeSet = tagTypeSet.concat(d.get('tags'));
        }
        return true;
    });

    return state.get('tags').set(
        tagType, tagTypeSet.toList().sortBy(name => name.toLowerCase())
    );
}

export function reducer(state = Map(), action) {
    switch (action.type) {
        case 'SET_STATE':
            return state.merge(action.state);

        case 'ERROR':
        case 'LOGOUT_ERROR':
        case 'LOAD_STATE_ERROR':
            return cacheState(state.set('error', action.error));

        case 'REDIRECT':
            document.location.href = action.url;
            return state;

        case 'LOGOUT_SUCCESS':
            document.location.href = action.redirectUrl;
            return state;

        case 'LOAD_STATE_SUCCESS':
            return cacheState(state
                .merge({error: null, loaded: true, lastSync: action.lastSync}), 
                true // DEBUG
            );

        case 'SET_IS_OFFLINE':
            return cacheState(state.set('isOffline', action.isOffline));
            
        case 'ADD_APP':
            var appData = action.json;
            var apps = state.getIn(['user', 'apps']);

            // Only add if this is actually a new app
            if(!apps.find(data => data.get('id') == appData.id)) {
                return cacheState(state
                    .setIn(['user', 'apps'], apps.push(Map(appData)))
                );
            }
            return state;

        case 'SET_FILTER':
            return cacheState(state
                .setIn(['filter', action.filterType], Map(action.filter))
            );

// User (online only)
        case 'FETCH_USER_START':
            return state;

        case 'FETCH_USER_SUCCESS':
            return cacheState(state.mergeIn(['user'], action.json));

// Sync
        case 'SYNCED_AWARD':
            award = fromJS(action.json).set('dirty', false);
                        
            return cacheState(state
                .setIn(['awards', 'itemsById', action.json.id], award)
                .set('toSync', Math.max(state.get('toSync', 0) - 1, 0))
            );

        case 'SYNCED_ENTRY':
            if(action.json.is_deleted) {
                state = state.deleteIn(['entries', 'itemsById', action.json.id]);            
            } else {
                entry = fromJS(action.json).set('dirty', false);              
                state = state.setIn(['entries', 'itemsById', action.json.id], entry);
            }

            return cacheState(state
                .set('toSync', Math.max(state.get('toSync', 0) - 1, 0))
            );

        case 'SYNC_SUCCESS':
            return cacheState(state.set('lastSync', action.lastSync));

// UserEmails (online only)
        case 'ADD_EMAIL':
            var emails = state.getIn(['user', 'emails'])
                .push(Map(action.json));

            return cacheState(state.setIn(['user', 'emails'], emails));

        case 'SET_PRIMARY_EMAIL':
            var primaryId = action.id;

            var emails = state.getIn(['user', 'emails'])
                .map(function(useremail) {
                    return useremail.set('is_primary', useremail.get('id') == primaryId);
                })
                .sortBy((useremail) => !useremail.get('is_primary'));

            return cacheState(state.setIn(['user', 'emails'], emails));

        case 'DELETE_EMAIL':
            var deleteId = action.id;
            
            var emails = state.getIn(['user', 'emails']).filter(
                useremail => useremail.get('id') != deleteId
            );

            return cacheState(state.setIn(['user', 'emails'], emails));

// Tags (online only)
        case 'FETCH_TAGS_START':
            return state;
            
        case 'FETCH_TAGS_SUCCESS':
            var tags = [[], []];

            action.json.forEach(function(d) {
                tags[d.type].push(d.name);
            });

            return cacheState(state.set('tags', fromJS(tags)));

// Awards
        case 'FETCH_AWARDS_START':
            return cacheState(state
                .mergeIn(['awards'], {loading: true, error: null})
            );
        
        case 'FETCH_AWARDS_END':
            return cacheState(state
                .setIn(['awards', 'loading'], false)
            );
            
        case 'FETCH_AWARDS_ERROR':
            return cacheState(state
                .mergeIn(['awards'], {loading: false, error: action.error})
            );

        case 'FETCH_AWARDS_SUCCESS':
            var itemsById = {};
            var issuerSet = Set();

            var items = action.json.map(function(d) {
                itemsById[d.id] = d;
                
                if(!d.is_deleted) {
                    issuerSet = issuerSet.add(d.issuer_org_name);
                }
                return d.id;
            });

            return cacheState(state
                .mergeIn(['awards'], {
                    loading: false,
                    error: null,
                    items: items,
                    itemsById: itemsById
                })
                .set('issuers', issuerSet.toList().sortBy(name => name.toLowerCase()))
            );

        case 'ADD_AWARD':
            // Note: award may already be in state even if was deleted
            var awardId = action.json.id;
            
            var award = fromJS(action.json);
    
            // Add to list and map
            var items = Set(state.getIn(['awards', 'items'])).add(awardId).toList();
            var itemsById = state.getIn(['awards', 'itemsById']).set(awardId, award);

            // Sort awards by issued_date desc with nulls first
            items = items.sort((id1, id2) => {
                var d1 = itemsById.getIn([id1, 'issued_date']);
                var d2 = itemsById.getIn([id2, 'issued_date']);
            
                if(!d1) {
                    return -1;
                } else if(!d2) {
                    return 1;
                } else if(d1 < d2) {
                    return 1;
                } else if(d1 > d2) {
                    return -1;
                } 
            
                return 0;
            });
            
            // Add to issuers
            var issuers = Set(state.get('issuers'))
                .add(award.get('issuer_org_name'))
                .toList()
                .sortBy(name => name.toLowerCase());

            return cacheState(state
                .setIn(['awards', 'items'], items)
                .setIn(['awards', 'itemsById'], itemsById)
                .set('issuers', issuers)
            );

        case 'UPDATE_AWARD_TAGS':
            var awardId = action.id;

            var isOffline = state.get('isOffline', false);
            var isDirty = state.getIn(['awards', 'itemsById', awardId, 'dirty'], false);
                        
            // Update item tags
            state = state
                .setIn(['awards', 'itemsById', awardId, 'tags'], List(action.tags));
            
            // If offline, make sure flagged as dirty       
            if(isOffline && !isDirty) {
                state = state
                    .setIn(['awards', 'itemsById', awardId, 'dirty'], true)
                    .set('toSync', state.get('toSync', 0) + 1);
            }
                
            // Recompile tag set
            var tags = compileTags(state, constants.TAG_TYPE.Award, 
                state.getIn(['awards', 'itemsById']));

            return cacheState(state.set('tags', tags));
          
        case 'UPDATE_AWARD_STATUS':
            // Update award verification and revocation status
            return cacheState(state
                .mergeIn(['awards', 'itemsById', action.id], {
                    'verified_dt': action.verified_dt,
                    'revoked': action.revoked,
                    'revoked_reason': action.revoked_reason
                })
            );

        case 'DELETE_AWARD':
            var awardId = action.id;
            var entryId = state.getIn(['awards', 'itemsById', awardId, 'entry']);
            
            var isOffline = state.get('isOffline', false);
            var isDirty = state.getIn(['awards', 'itemsById', awardId, 'dirty'], false);
            
            // Set deleted flag
            state = state
                .setIn(['awards', 'itemsById', awardId, 'is_deleted'], true);
            
            // If offline, make sure flagged as dirty       
            if(isOffline && !isDirty) {
                state = state
                    .setIn(['awards', 'itemsById', awardId, 'dirty'], true)
                    .set('toSync', state.get('toSync', 0) + 1);     
            }
                     
            // Recompile issuer and tag set
            var issuerSet = Set();
            var tagTypeSet = Set();

            state.getIn(['awards', 'itemsById']).forEach(function(d) {
                if(!d.get('is_deleted')) {
                    issuerSet = issuerSet.add(d.get('issuer_org_name'));
                    tagTypeSet = tagTypeSet.concat(d.get('tags'));
                }
                return true;
            });

            state = state
                .set('issuers', issuerSet.toList().sortBy(name => name.toLowerCase()))
                .setIn(['tags', constants.TAG_TYPE.Award], tagTypeSet.toList().sortBy(name => name.toLowerCase()));

            // Flag/remove related entry if pledge
            if(entryId) {
                var items = state.getIn(['entries', 'items']).filter(id => id != entryId);

                if(isOffline) {                     
                    state = state
                        .setIn(['entries', 'items'], items)
                        .mergeIn(['entries', 'itemsById', entryId], {is_deleted: true, dirty: true})
                        .set('toSync', state.get('toSync', 0) + 1);
                } else {                
                    state = state
                        .setIn(['entries', 'items'], items)
                        .deleteIn(['entries', 'itemsById', entryId]);
                }
            }

            return cacheState(state);
            
// Entries
        case 'FETCH_ENTRIES_START':
            return cacheState(state
                .mergeIn(['entries'], {loading: true, error: null})
            );

        case 'FETCH_ENTRIES_END':
            return cacheState(state
                .setIn(['entries', 'loading'], false)
            );

        case 'FETCH_ENTRIES_ERROR':
            return cacheState(state
                .mergeIn(['entries'], {loading: false, error: action.error})
            );

        case 'FETCH_ENTRIES_SUCCESS':
            var itemsById = {};

            var items = action.json.map(function(d) {
                itemsById[d.id] = d;
                return d.id;
            });

            return cacheState(state
                .mergeIn(['entries'], {
                    loading: false,
                    error: null,
                    items: items,
                    itemsById: itemsById
                })
            );
           
        case 'ADD_ENTRY':
            var entryId = action.json.id;
            var awardId = action.json.award;

            var isOffline = state.get('isOffline', false);
            var entry = fromJS(action.json).set('dirty', isOffline);
            
            // Add to list and map
            var items = state.getIn(['entries', 'items']).unshift(entryId);
            var itemsById = state.getIn(['entries', 'itemsById']).set(entryId, entry);

            state = state
                .setIn(['entries', 'items'], items)
                .setIn(['entries', 'itemsById'], itemsById);
        
            if(isOffline) {
                state = state.set('toSync', state.get('toSync', 0) + 1);
            }

            // Add entry ref to award if pledge
            if(awardId) {
                state = state.setIn(['awards', 'itemsById', awardId, 'entry'], entryId);
            }

            return cacheState(state);

        case 'UPDATE_ENTRY':
            var entryId = action.json.id;
            
            var isOffline = state.get('isOffline', false);
            var isDirty = state.getIn(['entries', 'itemsById', entryId, 'dirty'], false);
            
            var entry = fromJS(action.json).set('dirty', isOffline);
                       
            if(isOffline && !isDirty) {
                state = state.set('toSync', state.get('toSync', 0) + 1);
            }

            return cacheState(state
                .mergeIn(['entries', 'itemsById', entryId], entry)
            );

        case 'UPDATE_ENTRY_TAGS':
            var entryId = action.id;

            var isOffline = state.get('isOffline', false);
            var isDirty = state.getIn(['entries', 'itemsById', entryId, 'dirty'], false);

            // Update item tags
            state = state
                .setIn(['entries', 'itemsById', entryId, 'tags'], List(action.tags));
            
            // If offline, make sure flagged as dirty
            if(isOffline && !isDirty) {
                state = state
                    .setIn(['entries', 'itemsById', entryId, 'dirty'], true)
                    .set('toSync', state.get('toSync', 0) + 1);
            }
            
            // Recompile tag set
            var tags = compileTags(state, constants.TAG_TYPE.Entry, 
                state.getIn(['entries', 'itemsById']));

            return cacheState(state.set('tags', tags));

        case 'DELETE_ENTRY':
            var entryId = action.id;
            var awardId = state.getIn(['entries', 'itemsById', entryId, 'award']);

            var isOffline = state.get('isOffline', false);
            var isDirty = state.getIn(['entries', 'itemsById', entryId, 'dirty'], false);
            var isSynced = state.getIn(['entries', 'itemsById', entryId, 'sections', 0, 'id'], '');
                        
            // Flag or remove entry           
            var items = state.getIn(['entries', 'items']).filter(id => id != entryId);
            var itemsById = state.getIn(['entries', 'itemsById']);
            
            if(isOffline) {  
                if(isSynced) {      
                    itemsById = itemsById.mergeIn([entryId], {is_deleted: true, dirty: true});
                
                    if(!isDirty) {               
                        state = state.set('toSync', state.get('toSync', 0) + 1);
                    }
                } else {
                    itemsById = itemsById.delete(entryId);                    
                    state = state.set('toSync', state.get('toSync', 1) - 1);
                }
            } else {        
                itemsById = itemsById.delete(entryId);     
            }
    
            // Recompile tag list
            var tags = compileTags(state, constants.TAG_TYPE.Entry, itemsById);

            state = state
                .setIn(['entries', 'items'], items)
                .setIn(['entries', 'itemsById'], itemsById)
                .set('tags', tags);

            // Remove entry ref from award if pledge
            if(awardId) {
                state = state.setIn(['awards', 'itemsById', awardId, 'entry'], null);
            }
                                        
            return cacheState(state);            

// Shares (online only)
        case 'FETCH_SHARES_START':
            return cacheState(state
                .mergeIn(['shares'], {loading: true, error: null})
            );

        case 'FETCH_SHARES_END':
            return cacheState(state
                .setIn(['shares', 'loading'], false)
            );

        case 'FETCH_SHARES_ERROR':
            return cacheState(state
                .mergeIn(['shares'], {loading: false, error: action.error})
            );

        case 'FETCH_SHARES_SUCCESS':
            var itemsById = {};
            
            var items = action.json.map(function(d) {
                itemsById[d.id] = d;
                return d.id; 
            });
            
            return cacheState(state
                .mergeIn(['shares'], {
                    loading: false,
                    error: null,
                    items: items,
                    itemsById: itemsById
                })
            );

        case 'ADD_SHARE':
            var itemsKey;
            var share = action.json;

            if(share.content_type == 'award') {
                itemsKey = 'awards';
            } else {
                itemsKey = 'entries';
            }

            // Add share
            var items = state.getIn(['shares', 'items']).unshift(share.id);
            var itemsById = state.getIn(['shares', 'itemsById']).set(share.id, Map(share));

            // Add share ref
            var shareList = state
                .getIn([itemsKey, 'itemsById', share.object_id, 'shares'])
                .push(share.id);

            return cacheState(state
                .setIn(['shares', 'items'], items)
                .setIn(['shares', 'itemsById'], itemsById)
                .setIn([itemsKey, 'itemsById', share.object_id, 'shares'], shareList)
            );

        case 'DELETE_SHARE':
            // Flag as deleted
            return cacheState(state
                .setIn(['shares', 'itemsById', action.id, 'is_deleted'], true)
            );
    }

    return state;
}
