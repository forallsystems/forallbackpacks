# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-10-08 05:18
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0063_merge_20171006_1855'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='badge_criteria',
            field=models.TextField(blank=True),
        ),
    ]
