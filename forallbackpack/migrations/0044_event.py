# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-09-21 17:05
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0043_useremail_is_primary'),
    ]

    operations = [
        migrations.CreateModel(
            name='Event',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('url', models.CharField(max_length=256)),
                ('name', models.CharField(max_length=256)),
                ('description', models.TextField(blank=True)),
                ('role', models.CharField(max_length=256)),
                ('header_image', models.TextField(blank=True)),
                ('badge_name', models.CharField(max_length=256)),
                ('badge_description', models.TextField(blank=True)),
                ('badge_image', models.TextField(blank=True)),
                ('registration', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='forallbackpack.Registration')),
            ],
        ),
    ]
