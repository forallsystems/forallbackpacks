# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-06-20 21:35
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forallbackpack', '0030_auto_20170620_2001'),
    ]

    operations = [
        migrations.AlterField(
            model_name='share',
            name='type',
            field=models.CharField(choices=[('type_link', 'Link'), ('type_embed', 'Embed'), ('type_facebook', 'Facebook'), ('type_twitter', 'Twitter'), ('type_pinterest', 'Pinterest'), ('type_googleplus', 'Google Plus'), ('type_linkedin', 'LinkedIn')], default='type_link', max_length=20),
        ),
    ]
