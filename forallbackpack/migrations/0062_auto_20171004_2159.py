# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-10-04 21:59
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0061_award_event'),
    ]

    operations = [
        migrations.AlterField(
            model_name='registration',
            name='url_pledge',
            field=models.CharField(blank=True, default='/api/user/pledge/', help_text='POST or DELETE user pledge', max_length=245),
        ),
    ]
