# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.conf import settings
from django.db import models


class UserLogin(models.Model):
    dt = models.DateTimeField(auto_now_add=True)
    remote_addr = models.GenericIPAddressField(
        help_text="Remote IP address of request")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
        help_text='User that logged in or None for failure')
    credentials = models.TextField(blank=True,
        help_text="Credentials passed to authenticate for failure")

    class Meta:
        verbose_name = 'UserLogin'

    def __str__(self):
        return "%s::%s" % (self.dt, self.user)
