from urlparse import urlparse
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from oauthlib.oauth2 import OAuth2Error
from oauth2_provider.oauth2_validators import OAuth2Validator as BaseOAuth2Validator
from forallbackpack.models import UserProfile, UserEmail, UserApp


class NoApplicationConnectionError(OAuth2Error):
    """Authenticated `User` has no `UserApp` connection to the client"""
    error = 'no_userapp'
    description = 'User is not connected to client'
    status_code = 403

class OAuth2Validator(BaseOAuth2Validator):
    """
    Override to add user lookup by email address.  Credentials must correspond to a
    username or validated email address and an active `User` that has an association with
    client, which is an `Application` instance.
    """
    def validate_user(self, username, password, client, request, *args, **kwargs):
        print 'auth.validators.OAuth2Validator.validate_user'
        
        try:
            user = UserEmail.objects.get(email=username, is_validated=True).user
        except UserEmail.DoesNotExist:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:            
                return False

        u = authenticate(username=user.username, password=password)
        if u is not None and u.is_active:
            client_netloc = urlparse(client.redirect_uris).netloc
            if not u.userapp_set.filter(app_url__iregex=r'^https?://%s' % client_netloc).count():
                raise NoApplicationConnectionError(request=request)
            
            request.user = u
            return True
        return False
 
  