import re, time
from tracking.middleware import VisitorTrackingMiddleware
from .models import Share


class VisitorTrackingMiddleware(VisitorTrackingMiddleware):
    """
    Subclass to avoid tracking pageviews for deleted shares
    """
    def _should_track(self, user, request, response):
        if super(VisitorTrackingMiddleware, self)._should_track(user, request, response):            
            m = re.search(r'/share/(?P<share_id>(\w|\-)+)/$', request.path_info)
            if m:
                share_id = m.group('share_id')
                
                try:
                    return not Share.objects.get(pk=share_id).is_deleted                    
                except Share.DoesNotExist:
                    return False
                
            return True
        
        return False


class TrackingMiddleware(object):
    """
    Middleware to 'fix' django-tracking2 for anonymous users.  The session_key for
    anonymous users will not persist unless you actually store something in the session.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        # One-time configuration and initialization.

    def __call__(self, request):
        # Code to be executed for each request before
        # the view (and later middleware) are called.

        response = self.get_response(request)

        # Code to be executed for each request/response after
        # the view is called.
        if not request.session.session_key:
            request.session['forcekey'] = time.time()

        return response