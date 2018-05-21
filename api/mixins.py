"""
For API request logging.  Subclassing LoggingMixin to implement the _clean_data procedure
which is not in drf-tracking version 1.2.0 available on pip at this time.
"""
import copy, re, traceback
from django.utils.timezone import now
from rest_framework_tracking.mixins import LoggingMixin as _LoggingMixin
from rest_framework_tracking.models import APIRequestLog


class LoggingMixin(_LoggingMixin):
    logging_methods = '__all__'

    """Mixin to log requests"""
    def initial(self, request, *args, **kwargs):
        """Set current time on request"""

        # check if request method is being logged
        if self.logging_methods != '__all__' and request.method not in self.logging_methods:
            super(_LoggingMixin, self).initial(request, *args, **kwargs)
            return None

        # get IP
        ipaddr = request.META.get("HTTP_X_FORWARDED_FOR", None)
        if ipaddr:
            # X_FORWARDED_FOR returns client1, proxy1, proxy2,...
            ipaddr = [x.strip() for x in ipaddr.split(",")][0]
        else:
            ipaddr = request.META.get("REMOTE_ADDR", "")

        # get view
        view_name = ''
        try:
            method = request.method.lower()
            attributes = getattr(self, method)
            view_name = (type(attributes.__self__).__module__ + '.' +
                         type(attributes.__self__).__name__)
        except Exception:
            pass

        # get the method of the view
        if hasattr(self, 'action'):
            view_method = self.action if self.action else ''
        else:
            view_method = method.lower()

        # save to log
        self.request.log = APIRequestLog.objects.create(
            requested_at=now(),
            path=request.path,
            view=view_name,
            view_method=view_method,
            remote_addr=ipaddr,
            host=request.get_host(),
            method=request.method,
            query_params=_clean_data(request.query_params.dict()),
        )

        # regular initial, including auth check
        super(_LoggingMixin, self).initial(request, *args, **kwargs)

        # add user to log after auth
        user = request.user
        if user.is_anonymous():
            user = None
        self.request.log.user = user

        # get data dict
        try:
            # Accessing request.data *for the first time* parses the request body, which may raise
            # ParseError and UnsupportedMediaType exceptions. It's important not to swallow these,
            # as (depending on implementation details) they may only get raised this once, and
            # DRF logic needs them to be raised by the view for error handling to work correctly.
            self.request.log.data = _clean_data(self.request.data.dict())
        except AttributeError:  # if already a dict, can't dictify
            if isinstance(self.request.data, dict):
                self.request.log.data = _clean_data(copy.deepcopy(self.request.data))
            else:
                self.request.log.data = self.request.data
        finally:
            self.request.log.save()


def _clean_data(data):
    """
    Remove data not to be logged from a dictionary.
    Function based on the "_clean_credentials" function of django
    (django/django/contrib/auth/__init__.py)
    Note: modifies data in-place, so pass a deep copy
    """
    SENSITIVE_DATA = re.compile('api|token|key|secret|password|signature|data_uri', re.I)
    CLEANSED_SUBSTITUTE = '********************'
    
    if isinstance(data, dict):
        for key in data:
            if SENSITIVE_DATA.search(key):
                if data[key]:
                    data[key] = CLEANSED_SUBSTITUTE
            elif isinstance(data[key], list):
                data[key] = [_clean_data(v) for v in data[key]]            
            elif isinstance(data[key], dict):
                data[key] = _clean_data(data[key])
        
    return data
