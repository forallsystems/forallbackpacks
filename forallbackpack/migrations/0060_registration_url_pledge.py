# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-10-04 20:16
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0059_merge_20171004_2016'),
    ]

    operations = [
        migrations.AddField(
            model_name='registration',
            name='url_pledge',
            field=models.CharField(blank=True, default='/api/user/pledge/', help_text='POST user pledge', max_length=245),
        ),
    ]
