# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-09-21 21:01
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0046_registration_url_claim_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='registration',
            name='url_verify_event_classcode',
            field=models.CharField(blank=True, default='/api/user/verify_event_classcode/', help_text='POST event and class details for verification', max_length=256),
        ),
        migrations.AlterField(
            model_name='registration',
            name='url_claim_event',
            field=models.CharField(blank=True, default='/api/user/claim_event/', help_text='POST event and user details', max_length=256),
        ),
    ]
