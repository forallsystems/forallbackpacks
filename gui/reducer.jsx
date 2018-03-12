import {List, Map, Set} from 'immutable';
import * as constants from './constants';

// Cache state as plain JS
function cacheState(state) {
    localforage.setItem('state', state.toJS()).then(function(value) {
        //console.debug('Cached state', state.toJS());
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
            //console.debug('LOADED STATE', state.toJS());
            return cacheState(state.merge({error: null, loaded: true}));

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

        case 'FETCH_USER_START':
            return cacheState(state.setIn(['user', 'id'], ''));

        case 'FETCH_USER_SUCCESS':
            return cacheState(state.mergeIn(['user'], action.json));

// UserEmails
        case 'ADD_EMAIL':
            var emails = state.getIn(['user', 'emails']);

            return cacheState(state
                .setIn(['user', 'emails'], emails.push(Map(action.json)))
            );

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
// Tags
        case 'FETCH_TAGS_START':
            var tags = [List(), List()];
            return cacheState(state.set('tags', List(tags)));

        case 'FETCH_TAGS_SUCCESS':
            var tags = [List(), List()];

            action.json.forEach(function(d) {
                tags[d.type] = tags[d.type].push(d.name);
            });

            return cacheState(state.set('tags', List(tags)));

// Awards
        case 'FETCH_AWARDS_START':
            return cacheState(state
                .mergeIn(['awards'], {loading: true, error: null})
            );

        case 'FETCH_AWARDS_ERROR':
            return cacheState(state
                .mergeIn(['awards'], {loading: false, error: action.error})
            );

        case 'FETCH_AWARDS_SUCCESS':
            var issuerSet = Set();
            var itemsById = {};

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
            // Note: award may already be in state if was deleted
            var awardId = action.json.id;           
            var award = Map(action.json).set('shares', List(action.json.shares));

            // Add to items list and map
            //var items = state.getIn(['awards', 'items']).unshift(awardId);            
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
            
            // Add to issuer set
            var issuerSet = Set(state.get('issuers')).add(award.get('issuer_org_name'));

            return cacheState(state
                .setIn(['awards', 'items'], items)
                .setIn(['awards', 'itemsById'], itemsById)
                .set('issuers', issuerSet.toList().sortBy(name => name.toLowerCase()))
            );

        case 'UPDATE_AWARD_TAGS':
            // Update item tags
            var itemsById = state
                .getIn(['awards', 'itemsById'])
                .setIn([action.id, 'tags'], List(action.tags));

            // Recompile tag set
            var tags = compileTags(state, constants.TAG_TYPE.Award, itemsById);

            return cacheState(state
                .setIn(['awards', 'itemsById'], itemsById)
                .set('tags', tags)
            );

        case 'DELETE_AWARD':
            var deleteId = action.id;
            
            // Flag as deleted in map (do not remove!)
            state = state.setIn(['awards', 'itemsById', deleteId, 'is_deleted'], true);
                     
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

            var tags = state.get('tags').set(
                constants.TAG_TYPE.Award,
                tagTypeSet.toList().sortBy(name => name.toLowerCase())
            );

            state = state
                .set('issuers', issuerSet.toList().sortBy(name => name.toLowerCase()))
                .set('tags', tags);

            // Remove related entry if pledged
            var entryId = state.getIn(['awards', 'itemsById', deleteId, 'entry']);

            if(entryId) {
                var items = state.getIn(['entries', 'items']).filter(id => id != entryId);
                var itemsById = state.getIn(['entries', 'itemsById']).delete(entryId);

                state = state
                    .setIn(['entries', 'items'], items)
                    .setIn(['entries', 'itemsById'], itemsById);
            }

            return cacheState(state);

// Entries
        case 'FETCH_ENTRIES_START':
            return cacheState(state
                .mergeIn(['entries'], {loading: true, error: null})
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

            var sections = action.json.sections.map(function(section) {
                return Map(section);
            });
            
            var entry = Map(action.json)
                .set('sections', List(sections))
                .set('tags', List(action.json.tags))
                .set('shares', List(action.json.shares));

            // Add to items list and map
            var items = state.getIn(['entries', 'items']).unshift(entryId);
            var itemsById = state.getIn(['entries', 'itemsById']).set(entryId, entry);

            state = state
                .setIn(['entries', 'items'], items)
                .setIn(['entries', 'itemsById'], itemsById);

            // Add entry ref to award if pledge
            if(awardId) {
                state = state.setIn(['awards', 'itemsById', awardId, 'entry'], entryId);
            }

            return cacheState(state);

        case 'UPDATE_ENTRY':
            var entryId = action.json.id;

            return cacheState(state
                .mergeIn(['entries', 'itemsById', entryId], action.json)
            );

        case 'UPDATE_ENTRY_TAGS':
            // Update item tags
            var itemsById = state
                .getIn(['entries', 'itemsById'])
                .setIn([action.id, 'tags'], List(action.tags));

            // Recompile tag list
            var tags = compileTags(state, constants.TAG_TYPE.Entry, itemsById);

            return cacheState(state
                .setIn(['entries', 'itemsById'], itemsById)
                .set('tags', tags)
            );

        case 'DELETE_ENTRY':
            var deleteId = action.id;
            
            // Grab entry we are deleting
            var entry = state.getIn(['entries', 'itemsById', deleteId]);

            // Get award ref, if any
            var awardId = entry.get('award');

            // Remove item from list and map
            var items = state.getIn(['entries', 'items']).filter(id => id != deleteId);
            var itemsById = state.getIn(['entries', 'itemsById']).delete(deleteId);

            // Recompile tag list
            var tags = compileTags(state, constants.TAG_TYPE.Entry, itemsById);

            state = state
                .setIn(['entries', 'items'], items)
                .setIn(['entries', 'itemsById'], itemsById)
                .set('tags', tags);

            // Remove entry ref from award?
            if(awardId) {
                state = state.setIn(['awards', 'itemsById', awardId, 'entry'], null);
            }
                                        
            return cacheState(state);            

// Shares
        case 'FETCH_SHARES_START':
            return cacheState(state
                .mergeIn(['shares'], {loading: true, error: null})
            );

        case 'FETCH_SHARES_ERROR':
            return cacheState(state
                .mergeIn(['shares'], {loading: false, error: action.error})
            );

        case 'FETCH_SHARES_SUCCESS':
            var items = action.json.map(function(d) {
                return d.id;
            });

            var itemsById = action.json.reduce(function(o, d) {
                o[d.id] = d;
                return o;
            }, {});

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
            var shareId = action.id;

            return cacheState(state
                .setIn(['shares', 'itemsById', shareId, 'is_deleted'], true)
            );
    }

    return state;
}
