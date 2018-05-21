import * as constants from './constants';

// Generate auth state token
function generateToken(length) {
    var n = length || 50;
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < n; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Store authorization state value and redirect to FB authorization URL
export function redirectToLogin(dispatcher) {
    var authState = generateToken(20);

    var url = constants.AUTH.authorizationUrl+'?response_type=token'
                + '&client_id='+constants.AUTH.clientId
                + '&redirect_uri='+constants.APP_ROOT
                + '&state='+authState;

    localforage.setItem('authState', authState).then(function() {
        document.location.href = url;
    }).catch(function(error) {
        dispatcher.dispatch(setError('Error setting authState', error));
    });
}
