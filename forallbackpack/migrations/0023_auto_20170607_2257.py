# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-06-07 22:57
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0022_share'),
    ]

    operations = [
        migrations.RenameField(
            model_name='share',
            old_name='created_date',
            new_name='created_dt',
        ),
    ]
