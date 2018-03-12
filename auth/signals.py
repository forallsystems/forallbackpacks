from django.contrib.auth.signals import user_logged_in, user_login_failed
from .models import UserLogin


def handle_user_logged_in(sender, request, user, **kwargs):
    ipaddr = request.META.get("HTTP_X_FORWARDED_FOR", None)
    if ipaddr:
        # X_FORWARDED_FOR returns client1, proxy1, proxy2,...
        ipaddr = [x.strip() for x in ipaddr.split(",")][0]
    else:
        ipaddr = request.META.get("REMOTE_ADDR", "")

    UserLogin.objects.create(remote_addr=ipaddr, user=user)
    
def handle_user_login_failed(sender, credentials, request, **kwargs):
    # Get IP
    ipaddr = "-unknown-"
    if request:
        ipaddr = request.META.get("HTTP_X_FORWARDED_FOR", None)
        if ipaddr:
            # X_FORWARDED_FOR returns client1, proxy1, proxy2,...
            ipaddr = [x.strip() for x in ipaddr.split(",")][0]
        else:
            ipaddr = request.META.get("REMOTE_ADDR", "-unknown-")

    UserLogin.objects.create(remote_addr=ipaddr, credentials=credentials)

user_logged_in.connect(handle_user_logged_in,
    dispatch_uid='forallbackpack.signals.handle_user_logged_in')

user_login_failed.connect(handle_user_login_failed,
    dispatch_uid='forallbackpack.signals.handle_user_login_failed')
