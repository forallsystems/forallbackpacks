# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-09-27 16:56
from __future__ import unicode_literals

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0051_useremail_is_archived'),
    ]

    operations = [
        migrations.AddField(
            model_name='useremail',
            name='created_dt',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
