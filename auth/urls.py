from __future__ import absolute_import
from django.conf.urls import url

from . import views

app_name = 'auth'

urlpatterns = [
    url(r'^login/(?P<token>(\w|\-)+)/$', views.token_login),
    url(r'^refresh/(?P<token>(\w|\-)+)/$', views.token_refresh),
]


