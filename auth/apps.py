# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.apps import AppConfig


class AuthConfig(AppConfig):
    name = 'auth'
    label = 'forallbackpack.auth'

    def ready(self):
        from auth.signals import *

class AuthSubModuleConfig(AppConfig):
    name = 'forallbackpack.auth'
    label = 'forallbackpack.auth'

    def ready(self):
        from forallbackpack.auth.signals import *
