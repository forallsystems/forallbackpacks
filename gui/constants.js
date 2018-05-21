import {List, Map} from 'immutable';

// The root url for this front-end application (see webpack.config.js)
export const APP_ROOT = env.app_root;

// The root url for the back-end server (see webpack.config.js)
export const SERVER_ROOT = env.server_root;

export const AUTH = {
    clientId: 'qC4IV4ZhupitN0omyOeM2eoEXd73FIeMAfLj9EBh',
    authorizationUrl: SERVER_ROOT+'o/authorize/',
    accessTokenUrl: SERVER_ROOT+'o/token/',
    revokeTokenUrl: SERVER_ROOT+'o/revoke_token/',
    refreshTokenUrl: SERVER_ROOT+'auth/refresh/',
    logoutUrl: SERVER_ROOT+'logout/',

    // append '?ref=...' for redirect after auth complete
    service: {
        Dropbox: {
            name: 'Dropbox',
            url: SERVER_ROOT+'dropboxAuthStart/'
        },
        GoogleDrive: {
            name: 'Google Drive',
            url: SERVER_ROOT+'googleDriveAuthStart/',
            client_id: '467043896714-ndfjbj73ae82sr0k0ud1m1pf2si669pr.apps.googleusercontent.com',
            developer_key: 'AIzaSyBEgxhLJmNcjO-s_hQj6Cao9cbtYXz6f7M'
        },
        OneDrive: {
            name: 'OneDrive',
            url: SERVER_ROOT+'onedriveAuthStart/'
        }
    }
}

export const API_ROOT = SERVER_ROOT+'api/';

export const ATTACHMENT_ONLINE_BYTE_LIMIT = 50000000; //  per file

export const ATTACHMENT_OFFLINE_BYTE_LIMIT = 8000000; //  per file

// Must match UserProfile model
export const NOTIFY_TYPE = {
    Email: 0,
    SMS: 1,
    Email_SMS: 2
}

// Must match Tag model
export const TAG_TYPE = {
    Award: 0,
    Entry: 1
}

// Must match Share model
export const SHARE_TYPE_LIST = [
    'type_link',
    'type_embed',
    'type_facebook',
    'type_twitter',
    'type_pinterest',
    'type_googleplus',
    'type_linkedin'
];

export const SHARE_TYPE_NAME = {
    type_link: 'Public Link',
    type_embed: 'HTML Embed',
    type_facebook: 'Facebook',
    type_twitter: 'Twitter',
    type_pinterest: 'Pinterest',
    type_googleplus: 'Google Plus',
    type_linkedin: 'LinkedIn'
}

export const SHARE_TYPE_ICON_CLASS = {
    type_link: 'fa fa-link',
    type_embed: 'fa fa-code fa-lg',
    type_facebook: 'fa fa-facebook-square fa-lg',
    type_twitter: 'fa fa-twitter-square fa-lg',
    type_pinterest: 'fa fa-pinterest-square fa-lg',
    type_googleplus: 'fa fa-google-plus-square fa-lg',
    type_linkedin: 'fa fa-linkedin-square fa-lg'
}

// Map path to info
const _PATH_INFO = {
    '/badges': {title: 'My Badges', name: 'Badges', containerClass: 'badges'},
    '/claim-account': {title: 'Claim Account', name: 'Claim Account',  containerClass: 'claim-account'},
    '/claim-badge': {title: 'Claim Badge', name: 'Claim Badge', containerClass: 'claim-badge'},
    '/entry/edit': {
        title: 'Add Entry to ePortfolio', name: '', containerClass: 'entry-new', 
        hideMenu: true, editFooter: true
    },
    '/eportfolio': {title: 'My ePortfolio', name: 'ePortfolio', containerClass: 'eportfolio'},
    '/my-account': {title: 'My Account', name: 'My Account', containerClass: 'my-account'},
    '/timeline': {title: 'My Timeline', name: 'Timeline', containerClass: 'timeline'}
}

export function PATH_INFO(path) {
    if(_PATH_INFO[path]) {
        return _PATH_INFO[path];
    }

    if(/^\/badges\//.test(path)) {
        return {title: 'Badge Details', name: '', containerClass: 'badge-detail'};
    }

    if(/^\/entry\/edit\//.test(path)) {
        return {title: 'Edit ePortfolio Entry', name: '', containerClass: 'entry-edit', 
                editFooter: true};
    }

    if(/^\/entry\/view\//.test(path)) {
        return {title: 'View ePortfolio Entry', name: '', containerClass: 'entry-view'};
    }

    if(/^\/pledge\/edit\//.test(path)) {
        return {title: 'Pledge For Badge', name: '', containerClass: 'pledge-edit', 
                editFooter: true};    
    }

    if(/^\/pledge\/view\//.test(path)) {
        return {title: 'View Pledge For Badge', name: '', containerClass: 'pledge-view'};    
    }
    
    return {};
}

export const DEFAULT_STATE = {
    isOffline: false,
    toSync: 0,              // number of updates to sync
    lastSync: null,         // last sync
    loaded: false,
    error: null,            // global error
    issuers: [],            // [<string>]
    user : {
        id: 0,
        first_name: '',
        last_name: '',
        emails: List(),
        phone_number: '',
        apps: List(),
        is_new: 0,
        is_claimfs: 0,
        notify_type: 0
    },
    // filter state by TAG_TYPE
    filter: [
        {
            startDate: '', // YYYY-MM-DD
            endDate: '',   // YYYY-MM-DD
            issuers: List(),
            tags: List(),
            isShared: false,
            wasShared: false,
            neverShared: false,
            isValid: false,
            isRevoked: false,
            isExpired: false
        },
        {
            startDate: '', // YYYY-MM-DD
            endDate: '',   // YYYY-MM-DD
            tags: List(),
            isShared: false,
            wasShared: false,
            neverShared: false,
        }
    ],
    // tag names by TAG_TYPE
    tags: [[], []],
    // attrs by TAG_TYPE
    attrs: [{}, {}],
    awards: {
        loading: false,
        error: null,        // for reloading
        items: null,        // [id]
        itemsById: {}       // {id: data}
    },
    entries: {
        loading: false,
        error: null,        // for reloading
        items: null,        // [id]
        itemsById: {}       // {id: data}
    },
    shares: {
        loading: false,
        error: null,        // for reloading
        items: null,        // [id]
        itemsById: {}       // {id: data}
    }
};
