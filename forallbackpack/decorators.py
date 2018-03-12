import re
from django.utils.timezone import now
from rest_framework_tracking.models import APIRequestLog

def _clean_data(data):
    """
    Clean a dictionary of data of potentially sensitive info before
    sending to the database.
    Function based on the "_clean_credentials" function of django
    (django/django/contrib/auth/__init__.py)
    """
    SENSITIVE_DATA = re.compile('api|token|key|secret|password|signature', re.I)
    CLEANSED_SUBSTITUTE = '********************'
    for key in data:
        if SENSITIVE_DATA.search(key):
            data[key] = CLEANSED_SUBSTITUTE
    return data

def logging_decorator(the_func):
    """Mimic drf-tracking for Django views"""
    def _decorated(request, *args, **kwargs):
        # get IP
        ipaddr = request.META.get("HTTP_X_FORWARDED_FOR", None)
        if ipaddr:
            # X_FORWARDED_FOR returns client1, proxy1, proxy2,...
            ipaddr = [x.strip() for x in ipaddr.split(",")][0]
        else:
            ipaddr = request.META.get("REMOTE_ADDR", "")

        # get user
        user = request.user
        if user.is_anonymous():
            user = None 
              
        log = APIRequestLog.objects.create(
            requested_at=now(),
            path=request.path,
            view='',
            view_method='',
            remote_addr=ipaddr,
            host=request.get_host(),
            method=request.method,
            query_params=_clean_data(request.GET.dict()),
            user=user
        )
        
        response = the_func(request, *args, **kwargs) 
   
        # compute response time
        response_timedelta = now() - log.requested_at
        response_ms = int(response_timedelta.total_seconds() * 1000)
                
        # save to log
        content_type = response.get('Content-Type')
        if re.match(r'^image/.*', content_type):
            log.response = '<%s>' % content_type
        else:
            log.response = response.content

        #log.response = response.content
        log.status_code = response.status_code
        log.response_ms = response_ms
        log.save()
        
        return response
           
    return _decorated