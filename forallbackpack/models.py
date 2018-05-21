from __future__ import unicode_literals

import datetime, random, string, uuid
from urlparse import urljoin, urlparse
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.forms.models import model_to_dict
from dropbox import DropboxOAuth2Flow


class Registration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=256)
    prefix = models.CharField(max_length=100, unique=True)
    key = models.CharField(max_length=255, unique=True)
    secret = models.CharField(max_length=256)
    has_forall_permissions = models.BooleanField(blank=True, default=False,
        help_text='Has elevated ForAll permissions')
    url = models.URLField(verbose_name='URL',
        help_text='Default base URL for constructing API endpoints')
    # ----- org-level endpoints -----
    url_verify_account_claim_code = models.CharField(max_length=256, blank=True,
        default='/api/user/verify_account_claim_code/',
        help_text='POST account claim code for verification')
    url_claim_account = models.CharField(max_length=256, blank=True,
        default='/api/user/claim_account/',
        help_text='POST redeeemed account claim code')
    url_award_claim = models.CharField(max_length=256, blank=True,
        default='/api/user/claim_badge/',
        help_text='POST award claim code')
    url_claim_event = models.CharField(max_length=256, blank=True,
        default='/api/user/claim_event/',
        help_text='POST event and user details')
    url_verify_event_classcode = models.CharField(max_length=256, blank=True,
        default='/api/user/verify_event_classcode/',
        help_text='POST event and class details for verification')
    url_pledge = models.CharField(max_length=245, blank=True,
        default='/api/user/pledge/',
        help_text='POST or DELETE user pledge')

    def __str__(self):
        return self.name

    def url_for(self, url_name, url_append=''):
        """Get full endpoint url by name (e.g. 'claim_account')"""
        try:
            p = urlparse(self.url)
            
            url = '%s://%s' % (p.scheme, p.netloc)   
                     
            path = p.path
            if path.endswith('/'):
                path = path[:-1]
                                        
            endpoint = getattr(self, 'url_'+url_name)
            if not endpoint.startswith('/'):
                endpoint = '/'+endpoint

            if url_append:
                if not endpoint.endswith('/'):
                    endpoint += '/'
            
            return urljoin(url, path+endpoint+url_append)
        except AttributeError:
            raise Exception("Unknown org url '%s'" % url_name)

class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration = models.ForeignKey(Registration)
    url = models.CharField(max_length=256)
    name = models.CharField(max_length=256)
    description = models.TextField(blank=True)
    role = models.CharField(max_length=256)
    header_image = models.TextField(blank=True)
    badge_name = models.CharField(max_length=256)
    badge_description = models.TextField(blank=True)
    badge_criteria = models.TextField(blank=True)
    badge_image = models.TextField(blank=True)
    is_pledge = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class UserProfile(models.Model):
    EMAIL = 0
    SMS = 1
    EMAIL_SMS = 2

    NOTIFY_TYPE_CHOICES = (
        (EMAIL, 'Email'),
        (SMS, 'SMS'),
        (EMAIL_SMS, 'Email & SMS')
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_new = models.BooleanField(blank=True, default=True)
    is_claimfs = models.BooleanField(blank=True, default=False)
    is_claimrcoe = models.IntegerField(default=0)
    event = models.ForeignKey(Event, blank=True, null=True)
    event_class_code = models.CharField(max_length=256, blank=True, null=True)
    phone_number = models.CharField(max_length=256, blank=True, null=True)
    notify_type = models.IntegerField(choices=NOTIFY_TYPE_CHOICES, default=EMAIL)

class UserEmail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    email = models.CharField(max_length=256, blank=True, null=True)
    is_validated = models.BooleanField(blank=True, default=False)
    is_primary = models.BooleanField(blank=True, default=False)
    is_archived = models.BooleanField(blank=True, default=False)
    created_dt = models.DateTimeField(blank=True, auto_now_add=True)

class UserAccount(models.Model):
    """Track user account claims"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    registration = models.ForeignKey(Registration)

class UserApp(models.Model):
    """Track user apps (via account claims)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    app_id = models.CharField(max_length=256)
    app_name = models.CharField(max_length=256)
    app_url = models.URLField(max_length=256)

class AuthToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    type = models.TextField(blank=True)
    token = models.TextField(blank=True)
    credentials = models.TextField(blank=True)

class Tag(models.Model):
    AWARD = 0
    ENTRY = 1

    TYPE_CHOICES = (
        (AWARD, 'Award'),
        (ENTRY, 'Entry')
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    name = models.CharField(max_length=256)
    type = models.IntegerField(choices=TYPE_CHOICES, default=AWARD)

    def __str__(self):
        return self.name

class Share(models.Model):
    """
    `content_object` is what is being shared, e.g. an `Award` instance
    """
    TYPE_LINK = 'type_link'
    TYPE_EMBED = 'type_embed'
    TYPE_FACEBOOK = 'type_facebook'
    TYPE_TWITTER = 'type_twitter'
    TYPE_PINTEREST = 'type_pinterest'
    TYPE_GOOGLEPLUS = 'type_googleplus'
    TYPE_LINKEDIN = 'type_linkedin'

    TYPE_CHOICES = (
        (TYPE_LINK, 'Link'),
        (TYPE_EMBED, 'Embed'),
        (TYPE_FACEBOOK, 'Facebook'),
        (TYPE_TWITTER, 'Twitter'),
        (TYPE_PINTEREST, 'Pinterest'),
        (TYPE_GOOGLEPLUS, 'Google Plus'),
        (TYPE_LINKEDIN, 'LinkedIn'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    created_dt = models.DateTimeField(blank=True, null=True, auto_now_add=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_LINK)
    is_deleted = models.BooleanField(blank=True, default=False)

    def __str__(self):
        return self.content_type.model

class Award(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    event = models.ForeignKey(Event, blank=True, null=True,
        help_text='For pledgable badges')
    issued_date = models.DateField(blank=True,null=True)
    external_id = models.TextField(blank=True)
    badge_id = models.TextField(blank=True,null=True)
    external_badge_id = models.TextField(blank=True,null=True)
    expiration_date = models.DateField(blank=True,null=True)

    verified_dt = models.DateTimeField(blank=True, null=True, default=None,
        help_text='Date and time of last successful verification')
    revoked = models.BooleanField(blank=True, default=False)
    revoked_reason = models.TextField(blank=True, default='')

    student_name = models.TextField(blank=True)
    student_email = models.EmailField(blank=True)

    # State of the badge when award was issued
    badge_name = models.TextField(blank=True)
    badge_version =  models.CharField(max_length=20, blank=True)
    badge_description = models.TextField(blank=True)
    badge_criteria = models.TextField(blank=True)
    badge_image = models.FileField(blank=True, null=True, upload_to='files/badges', max_length=255)

    org_issued_name = models.TextField(blank=True)
    assertion_url = models.TextField(blank=True,null=True)
    issuer_org_url = models.TextField(blank=True)
    issuer_org_name = models.TextField(blank=True)
    issuer_org_email = models.TextField(blank=True)
    issuer_org_origin = models.TextField(blank=True)

    baked_image_url = models.TextField(blank=True, null=True)
    badge_image_data_uri = models.TextField(blank=True,
        help_text='Data URI for badge image thumbnail') # generate on save

    tags = models.ManyToManyField(Tag, blank=True)
    shares = GenericRelation(Share)
    is_deleted = models.BooleanField(blank=True, default=False)
    
    def __str__(self):
        return self.badge_name

    @staticmethod
    def getAwardByExternalID(external_id):
        for a in Award.objects.filter(external_id=external_id):
            return a
        return None

class Evidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award = models.ForeignKey(Award)
    file = models.FileField(blank=True, null=True, upload_to='files/evidence', max_length=255)
    hyperlink = models.TextField(blank=True, null=True)
    label = models.CharField(max_length=256)
    description = models.TextField(blank=True, null=True)
    created_date = models.DateTimeField(blank=True, null=True, auto_now_add=True)

class AwardCustom(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_private = models.BooleanField(default=False)
    name = models.CharField(max_length=256)
    value = models.TextField(blank=True, null=True, max_length=256)

class AwardEndorsement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award = models.ForeignKey(Award)
    issuer_name = models.CharField(max_length=256)
    issuer_url = models.URLField()
    issuer_email = models.EmailField(blank=True, default='')
    issuer_image = models.FileField(blank=True, null=True, upload_to='files/awardendorsement', max_length=255)
    issuer_image_data_uri = models.TextField(blank=True, default='',
        help_text='Data URI for image thumbnail') # generate on save
    issued_on = models.DateTimeField()

    class Meta:
        verbose_name = 'AwardEndorsement'
        ordering = ['issuer_name']    
    
class Entry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    award = models.OneToOneField(Award, blank=True, null=True,
        help_text="Award reference for 'pledgable badges'")
    tags = models.ManyToManyField(Tag, blank=True)
    shares = GenericRelation(Share)
    is_deleted = models.BooleanField(blank=True, default=False)
    created_dt = models.DateTimeField(blank=True, auto_now_add=True)
    updated_dt = models.DateTimeField(blank=True, auto_now=True)

class Section(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry = models.ForeignKey(Entry, related_name='sections')
    title = models.CharField(blank=True, default='', max_length=256)
    text = models.TextField(blank=True, default='')
    is_deleted = models.BooleanField(blank=True, default=False)
    created_dt = models.DateTimeField(blank=True, auto_now_add=True)
    updated_dt = models.DateTimeField(blank=True, auto_now=True)

    def __str__(self):
        return self.title

class Attachment(models.Model):
    """
    `Award` *or* uploaded file attached to `Section`

    We need the ability to upload files before actually saving the associated `Section`,
    so `section` is allowed to be null, but app should perform appropriate cleanup.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User)
    section = models.ForeignKey(Section, blank=True, null=True, related_name='attachments')
    label = models.CharField(max_length=256)
    award = models.ForeignKey(Award, blank=True, null=True, related_name='attachments')
    file = models.FileField(blank=True, null=True, upload_to='files/attachments', max_length=255)
    hyperlink = models.CharField(max_length=256, blank=True, default='')
    data_uri = models.TextField(blank=True, default='',
        help_text='Data URL for image thumbnails') # generate on save
    is_deleted = models.BooleanField(blank=True, default=False)
    created_dt = models.DateTimeField(blank=True, auto_now_add=True)

    def __str__(self):
        if self.award:
            return 'Badge:'+self.award.badge_name
        elif self.file:
            return self.file.url
        elif self.hyperlink:
            return self.hyperlink
        else:
            return self.label
