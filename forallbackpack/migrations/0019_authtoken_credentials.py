# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-05-29 15:22
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0018_auto_20170529_0148'),
    ]

    operations = [
        migrations.AddField(
            model_name='authtoken',
            name='credentials',
            field=models.TextField(blank=True),
        ),
    ]
