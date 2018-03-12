from django.conf.urls import include, url
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'api'

# Create a router and register our viewsets with it.
router = DefaultRouter()

router.register(r'forall/user', views.ForallUserViewSet)
router.register(r'forall', views.ForallViewSet, base_name="forall")
router.register(r'me', views.MyViewSet, base_name="me")
router.register(r'useremail', views.UserEmailViewSet, base_name="useremail")
router.register(r'user', views.UserViewSet, base_name="user")
router.register(r'notify', views.NotifyViewSet, base_name="notify")
router.register(r'tag', views.TagViewSet, base_name="tag")
router.register(r'award', views.AwardViewSet, base_name="award")
router.register(r'attachment', views.AttachmentViewSet, base_name="attachment")
router.register(r'entry', views.EntryViewSet, base_name="entry")
router.register(r'share', views.ShareViewSet, base_name="share")
router.register(r'registration', views.RegistrationViewSet, base_name="registration")
router.register(r'event', views.EventViewSet, base_name="event")
router.register(r'pledge', views.PledgeViewSet, base_name="pledge")

# The API URLs are now determined automatically by the router.
urlpatterns = [
    url(r'^', include(router.urls)),
]
