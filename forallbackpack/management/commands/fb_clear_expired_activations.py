import datetime
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from forallbackpack.models import *


class Command(BaseCommand):
    help = 'Delete unvalidated, expired UserEmail instances (and associated Users '\
         + ' with no validated email addresses).'

    def handle(self, *args, **options):
        cutoff = timezone.now() - datetime.timedelta(hours=24)        
        expired_qs = UserEmail.objects.filter(is_validated=False, created_dt__lt=cutoff)
        
        for user_email in expired_qs:
            user = user_email.user
            
            if user.useremail_set.filter(is_validated=True).count():
                # User has at least one other validated email address
                print 'Removing UserEmail %s' % user_email.email
                user_email.delete()
            else:
                # User has no validated email address
                print 'Removing User %s' % user_email.email                
                user.delete()