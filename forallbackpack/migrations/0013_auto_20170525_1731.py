# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-05-25 17:31
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0012_merge_20170525_1731'),
    ]

    operations = [
        migrations.AlterField(
            model_name='registration',
            name='key',
            field=models.CharField(max_length=255, unique=True),
        ),
    ]
