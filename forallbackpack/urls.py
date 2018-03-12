from django.conf.urls import url, include
from django.contrib import admin
from django.contrib.auth import views as auth_views
from . import views, assertion_views

urlpatterns = [
    url(r'^admin/', admin.site.urls),

    url(r'^login/$', views.CustomLoginView.as_view(), name='login'),
    url(r'^logout/$', auth_views.logout, name='logout'),

    url(r'^password_reset/$', auth_views.password_reset,  name='password_reset'),
    url(r'^password_reset/done/$', auth_views.password_reset_done,  name='password_reset_done'),
    url(r'^reset/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,13}-[0-9A-Za-z]{1,20})/$', auth_views.password_reset_confirm, {'template_name': 'registration/password_change.html'}, name='password_reset_confirm'),
    url(r'^reset/done/$', auth_views.password_reset_complete, {'template_name': 'registration/password_reset_complete.html'}, name='password_reset_complete'),

    url(r'^validate_account_claim_code/$', views.validate_account_claim_code, name='validate-account-claim-code'),
    url(r'^claim/$', views.claim_account, name='claim-account'),
    url(r'^register/$', views.register, name='register'),
    url(r'^sso/$', views.sso, name='sso'),

    url(r'^$', views.init),

    url(r'^dropboxAuthStart/$', views.dropboxAuthStart, name='dropboxAuthStart'),
    url(r'^dropboxAuthComplete/$', views.dropboxAuthComplete, name='dropboxAuthComplete'),
    url(r'^googleDriveAuthStart/$', views.googleDriveAuthStart, name='googleDriveAuthStart'),
    url(r'^googleDriveAuthComplete/$', views.googleDriveAuthComplete, name='googleDriveAuthComplete'),
    url(r'^onedriveAuthStart/$', views.onedriveAuthStart, name='onedriveAuthStart'),
    url(r'^onedriveAuthComplete/$', views.onedriveAuthComplete, name='onedriveAuthComplete'),

    # Assertion views for Mozilla Badge Backpack
    url(r'^assertion/(?P<award_id>(\w|\-)+)/issuer/$', assertion_views.view_assertion_issuer, name='viewAssertionIssuer'),
    url(r'^assertion/(?P<award_id>(\w|\-)+)/badge/$', assertion_views.view_assertion_badge, name='viewAssertionBadge'),
    url(r'^assertion/(?P<award_id>(\w|\-)+)/$', assertion_views.view_assertion, name='viewAssertion'),

    url(r'^assertion/(?P<award_id>(\w|\-)+)/download/$', assertion_views.download_badge, name='downloadBadge'),
    url(r'^assertion/(?P<award_id>(\w|\-)+)/view/$', assertion_views.view_badge, name='viewBadge'),

    url(r'^share/(?P<share_id>(\w|\-)+)/$', assertion_views.view_share, name='viewShare'),

    # django-oauth-toolkit
    url(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),

    # custom urls for RCOE badging event
    url(r'^rcoe-presenter/$', views.rcoe_presenter),
    url(r'^rcoe-participant/$', views.rcoe_participant),

    # event urls
    url(r'^event/(?P<url>(\w|\-)+)/$', views.view_event),

    # email activation urls
    url(r'^sendActivation/(?P<useremail_id>(\w|\-)+)/$', views.sendActivation, name='sendActivation'),
    url(r'^activateSent/(?P<useremail_id>(\w|\-)+)/$', views.activateSent, name='activateSent'),
    url(r'^activate/(?P<useremail_id>(\w|\-)+)/$', views.activate, name='activate'),
]

try:
    urlpatterns+=[
        url(r'^api/', include('api.urls')),
        url(r'^auth/', include('auth.urls', namespace='auth')),
    ]
except ImportError:
    urlpatterns+=[
        url(r'^api/', include('forallbackpack.api.urls')),
        url(r'^auth/', include('forallbackpack.auth.urls', namespace='auth')),
    ]
