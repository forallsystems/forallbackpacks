# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-09-09 19:34
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0038_attachment_user'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='share',
            name='views',
        ),
    ]
