# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.contrib.auth import login, logout
from django.shortcuts import redirect
from oauth2_provider.models import AccessToken


def token_login(request, token):
    """Login the `User` associated with token and redirect"""
    try:
        access_token = AccessToken.objects.get(token=token)        
        if not access_token.is_expired() and access_token.user.is_active:        
            # Logout current user
            logout(request)
            
            # Login if has validated email address
            if access_token.user.useremail_set.filter(is_validated=True).count():
                login(request, access_token.user, 'django.contrib.auth.backends.ModelBackend')                  
    except AccessToken.DoesNotExist:
        pass

    return redirect(request.GET.get('next'))
        