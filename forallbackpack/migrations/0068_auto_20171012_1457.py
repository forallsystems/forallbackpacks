# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-10-12 14:57
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0067_auto_20171011_1605'),
    ]

    operations = [
        migrations.AlterField(
            model_name='attachment',
            name='data_uri',
            field=models.TextField(blank=True, default='', help_text='Data URL for image thumbnails'),
        ),
    ]
