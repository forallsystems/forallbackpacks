# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-06-22 19:49
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0032_award_issuer_org_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='is_claimfs',
            field=models.BooleanField(default=False),
        ),
    ]
