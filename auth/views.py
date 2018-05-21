# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from datetime import timedelta
from django.contrib.auth import login, logout
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.utils import timezone
from oauth2_provider.settings import oauth2_settings
from oauth2_provider.models import Application, AccessToken


def token_login(request, token):
    """Login the `User` associated with token and redirect"""    
    try:
        access_token = AccessToken.objects.get(token=token)   

        if not access_token.is_expired() and access_token.user.is_active: 
            if not request.user\
            or request.user <> access_token.user\
            or not request.user.is_authenticated:
                # Logout current user
                logout(request)
            
                # Login if has validated email address
                if access_token.user.useremail_set.filter(is_validated=True).count():
                    login(request, access_token.user, 'django.contrib.auth.backends.ModelBackend')                  
    except AccessToken.DoesNotExist:
        pass

    return redirect(request.GET.get('next'))
    
def token_refresh(request, token):
    """
    Handle token expiration for FB front-end.  If token exists for FB provider and 
    forallbackpack_user_id, make sure the user is logged in and reset `expires`.
    """
    try:
        application = Application.objects.get(
            name='ForallBackpack', authorization_grant_type='implicit'
        )
        
        access_token = AccessToken.objects.get(token=token, application=application)
        
        if access_token.user.is_active\
        and access_token.user.useremail_set.filter(is_validated=True).count():
            # Logout current user
            logout(request)
            
            # Login token user
            login(request, access_token.user, 'django.contrib.auth.backends.ModelBackend')
            
            # Reset expiration
            access_token.expires = timezone.now() + timedelta(seconds=oauth2_settings.ACCESS_TOKEN_EXPIRE_SECONDS)
            access_token.save()
        
            return JsonResponse({})
    except (Application.DoesNotExist, AccessToken.DoesNotExist):
        pass
    
    return HttpResponse(status=403, reason='Invalid access token, could not refresh.')
        