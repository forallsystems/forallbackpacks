export default function(store) {
    return function(next) {
        return function(action) {
            console.debug('middleware', action);
            return next(action);
        }
    }
}