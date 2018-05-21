import base64, io, os, re, tempfile, uuid
from urlparse import urljoin, urlparse
from django.contrib.auth import password_validation
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.urls import reverse
from rest_framework import mixins, serializers
from tracking.models import Visitor
from PIL import Image, ExifTags
from forallbackpack import file_util
from forallbackpack.models import *
from forallbackpack.validation import validate_username, validate_email


RE_DATA_URI = re.compile(r'^data:(?P<mediatype>[^\;]*)(;(?P<encoding>base64))?,(?P<data>.*)')


class BaseModelSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        raise NotImplementedError(
            '`%s.create()` is not implemented.' % self.__class__.__name__)

    def update(self, instance, validated_data):
        raise NotImplementedError(
            '`%s.update()` is not implemented.' % self.__class__.__name__)

class UserProfileValidatorMixin(object):
    def validate_phone_number(self, value):
        """Phone number must be unique"""
        if value:
            try:
                userprofile = UserProfile.objects.get(phone_number=value)

                if not self.instance or self.instance != userprofile:
                    raise serializers.ValidationError(
                        'A user with this phone number already exists')
            except UserProfile.DoesNotExist:
                pass

        return value

    def validate_email(self, value):
        """Email must be unique"""
        if value:
            try:
                user = UserEmail.objects.get(email=value).user

                if not self.instance or self.instance.user != user:
                    raise serializers.ValidationError(
                        'A user with this email address already exists.')
            except UserEmail.DoesNotExist:
                pass

        return value

class ForallUserSerializer(serializers.ModelSerializer, UserProfileValidatorMixin):
    phone_number = serializers.RegexField(r'^\d{3}-\d{3}-\d{4}$', max_length=12,
                    required=False, allow_blank=True, default='',
                    error_messages={
                        'invalid': 'Invalid phone_number, expected format XXX-XXX-XXXX.'
                    })
    password = serializers.CharField(source='user.password', max_length=50,
                    write_only=True)
    first_name = serializers.CharField(source='user.first_name', max_length=30,
                    allow_blank=True, default='')
    last_name = serializers.CharField(source='user.last_name',  max_length=30,
                    allow_blank=True, default='')
    email = serializers.EmailField(source='user.email', max_length=254,
                    allow_blank=False, default='',
                    error_messages={
                        'invalid': 'Invalid email.'
                    })
    hub_id = serializers.CharField(required=False, write_only=True)
    hub_url = serializers.CharField(required=False, write_only=True)
    hub_name = serializers.CharField(required=False, write_only=True)

    hub_id = serializers.CharField(required=False, write_only=True)
    hub_url = serializers.CharField(required=False, write_only=True)
    hub_name = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = UserProfile
        fields = (
            'id', 'phone_number', 'password', 'first_name', 'last_name', 'email',
            'hub_id', 'hub_url', 'hub_name',
        )

    def validate_password(self, value):
        """Use built-in Django password validation"""
        user = User(
            username=self.initial_data.get('username', ''),
            first_name=self.initial_data.get('first_name', ''),
            last_name=self.initial_data.get('last_name', '')
        )

        try:
            password_validation.validate_password(value, user)
        except ValidationError as e:
            raise serializers.ValidationError(str(e))

        return value

    def validate(self, data):
        """If hub data sent, must be complete"""
        hub_id = data.get('hub_id', '')
        hub_name = data.get('hub_name', '')
        hub_url = data.get('hub_url', '')

        if hub_id or hub_url or hub_name:
            if not hub_id:
                raise serializers.ValidationError("`hub_id` required")
            if not hub_name:
                raise serializers.ValidationError("`hub_name` required")
            if not hub_url:
                raise serializers.ValidationError("`hub_url` required")

        return data

    def create(self, validated_data):
        """
        Create `User` with auto-generated `username` and `UserEmail`.
        Optionally create `UserAccount` and `UserApp` if hub data sent.
        """
        user_data = validated_data.pop('user')

        user = User.objects.create_user(
            uuid.uuid4().hex, user_data.get('email'), user_data.get('password'))
        user.first_name = user_data.get('first_name')
        user.last_name = user_data.get('last_name')
        user.save()

        UserEmail.objects.create(
            user=user, email=user_data.get('email'), is_validated=True, is_primary=True)

        hub_id = validated_data.pop('hub_id', '')
        hub_name = validated_data.pop('hub_name', '')
        hub_url = validated_data.pop('hub_url', '')
        registration = self.context.get('registration', None)

        if hub_id and registration:
            UserAccount.objects.create(user=user, registration=registration)
            UserApp.objects.create(user=user, app_id=hub_id, app_name=hub_name, app_url=hub_url)

        return UserProfile.objects.create(user=user, **validated_data)

class SetPasswordSerializer(serializers.Serializer):
    forallbackpack_user_id = serializers.UUIDField()
    password = serializers.CharField()
    
    class Meta:
        fields = ('forallbackpack_user_id', 'password',)

    def validate_password(self, value):
        """Use built-in Django password validation"""
        try:
            password_validation.validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(str(e))

        return value
       
class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    from_name = serializers.CharField()
    subject = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        fields = ('email', 'from_name', 'subject', 'message',)

class ResetPasswordConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(max_length=50)

    class Meta:
        fields = ('uidb64', 'token', 'password',)

class ClaimAccountSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    claim_code = serializers.CharField()
    forallbackpack_user_id = serializers.UUIDField(allow_null=True, default=None)

    class Meta:
        fields = ('email', 'password', 'claim_code', 'forallbackpack_user_id')

class ClaimNewAccountSerializer(ForallUserSerializer):
    claim_code = serializers.CharField(write_only=True)

    class Meta:
        model = UserProfile
        fields = (
            'id', 'phone_number', 'password', 'first_name', 'last_name', 'email',
            'claim_code'
        )

class ClaimCodeAccountSerializer(serializers.Serializer):
    claim_code = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=30)    
    last_name = serializers.CharField(max_length=30)
    username = serializers.CharField(max_length=254)
    password = serializers.CharField(max_length=50, write_only=True)
            
    class Meta:
        fields = ('claim_code', 'first_name', 'last_name', 'username', 'password',)
            
    def validate_password(self, value):
        """Use built-in Django password validation"""
        user = User(
            username=self.initial_data.get('username', ''),
            first_name=self.initial_data.get('first_name', ''),
            last_name=self.initial_data.get('last_name', '')
        )

        try:
            password_validation.validate_password(value, user)
        except ValidationError as e:
            raise serializers.ValidationError(str(e))

        return value
                 
    def validate(self, data):
        """
        Username may be a username or an email address.  If email address, add field to
        validated data for view only (ignored in `create()`).
        """
        username = data.get('username')
        email = ''
        
        try:
            # Try to validate as email address
            validate_email(username)
            email = username
        except ValidationError as ve:
            if ve.code == 'email_invalid':
                # Try to validate as username
                try:
                    validate_username(username)
                except ValidationError as e:
                    raise serializers.ValidationError(str(e))
            else:
                raise serializers.ValidationError(str(ve))
    
        data['email'] = email
        return data        
        
    def create(self, validated_data):
        """Create `User` and `UserProfile` ignoring email."""           
        user = User.objects.create_user(validated_data.get('username'), '', validated_data.get('password'))
        user.first_name = validated_data.get('first_name')
        user.last_name = validated_data.get('last_name')
        user.save()

        return UserProfile.objects.create(user=user)
    
class UserAppSerializer(serializers.ModelSerializer):
    app_url = serializers.SerializerMethodField()

    class Meta:
        model = UserApp
        fields = ('id', 'app_name', 'app_url',)

    def get_app_url(self, obj):
        return urljoin(obj.app_url, '/relogin/forallbackpack/')

class UserEmailSerializer(serializers.ModelSerializer):
    badge_count = serializers.SerializerMethodField()

    class Meta:
        model = UserEmail
        fields = ('id', 'email', 'is_validated', 'is_primary', 'badge_count')
        extra_kwargs = {'is_validated': {'read_only': True}}

    def get_badge_count(self, obj):
        """Number of badges associated with email address"""
        return Award.objects.filter(student_email=obj.email).count()

    def validate_email(self, value):
        """Email must be unique to user (and may be archived)"""
        if value and not self.instance:
            try:
                user = UserEmail.objects.get(email=value).user

                if user != self.context.get('request').user:
                    raise serializers.ValidationError(
                        'A user with this email address already exists.')
            except UserEmail.DoesNotExist:
                pass

        return value

    def create(self, validated_data):
        email = validated_data.get('email')

        try:
            # Handle un-archiving
            user_email = UserEmail.objects.get(email=email)
            user_email.is_archived = False
            user_email.save()
        except UserEmail.DoesNotExist:
            user_email = UserEmail.objects.create(
                user=self.context.get('request').user, email=email)

        return user_email

    def update(self, instance, validated_data):
        instance.is_primary = validated_data.get('is_primary', instance.is_primary)
        instance.is_archived = validated_data.get('is_archived', instance.is_archived)
        instance.save()

        # If `is_primary`, make sure `User` record contains this email address and no
        # other `UserEmail` are marked as primary
        if instance.is_primary:
            user = self.context.get('request').user

            if user.email != instance.email:
                user.email = instance.email
                user.save()

            UserEmail.objects.filter(user=user).exclude(id=instance.id)\
                .update(is_primary=False)

        return instance

class MyAccountSerializer(serializers.ModelSerializer, UserProfileValidatorMixin):
    phone_number = serializers.RegexField(r'^\d{3}-\d{3}-\d{4}$', max_length=12,
                    required=False, allow_blank=True, default='',
                    error_messages={
                        'invalid': 'Phone number must entered as: XXX-XXX-XXXX'
                    })
    is_new = serializers.BooleanField()
    is_claimfs = serializers.BooleanField()
    is_claimrcoe = serializers.IntegerField()

    first_name = serializers.CharField(source='user.first_name', max_length=30)
    last_name = serializers.CharField(source='user.last_name',  max_length=30)

    password = serializers.CharField(max_length=50, allow_blank=True, write_only=True)

    emails = serializers.SerializerMethodField()
    apps = UserAppSerializer(source='user.userapp_set', many=True)

    class Meta:
        model = UserProfile
        fields = (
            'id', 'phone_number', 'is_new', 'is_claimfs', 'is_claimrcoe','event',
            'first_name', 'last_name', 'password', 'notify_type', 'emails', 'apps',
        )

    def get_emails(self, obj):
        """Only return non-archived"""
        return UserEmailSerializer(
            obj.user.useremail_set.filter(is_archived=False).order_by('-is_primary'),
            many=True
        ).data

    def validate_password(self, value):
        """Use built-in Django password validation"""
        if value:
            user = User(
                username=self.initial_data.get('username', ''),
                first_name=self.initial_data.get('first_name', ''),
                last_name=self.initial_data.get('last_name', '')
            )

            try:
                password_validation.validate_password(value, user)
            except ValidationError as e:
                raise serializers.ValidationError(str(e))

        return value

    def create(self, validated_data):
        raise NotImplementedError(
            '`%s.create()` is not implemented.' % self.__class__.__name__)

    def update(self, instance, validated_data):
        user_data = validated_data.get('user', {})
        password = validated_data.get('password')

        instance.is_new = validated_data.get('is_new', instance.is_new)
        instance.is_claimfs = validated_data.get('is_claimfs', instance.is_claimfs)
        instance.is_claimrcoe = validated_data.get('is_claimfs', instance.is_claimrcoe)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.notify_type = validated_data.get('notify_type', instance.notify_type)
        instance.event = validated_data.get('event', instance.event)
        instance.save()

        user = instance.user
        user.first_name = user_data.get('first_name', user.first_name)
        user.last_name = user_data.get('last_name', user.last_name)

        if password:
            user.set_password(password)
        user.save()

        return instance

class NotifyEmailSerializer(serializers.Serializer):
    to_email = serializers.CharField()
    from_name = serializers.CharField()
    subject = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True)
    html_message = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        fields = ('to_email', 'from_name', 'subject', 'message', 'html_message')

    def validate(self, data):
        """Must have `message` or `html_message`"""
        if not (data.get('message', '') or data.get('html_message', '')):
            raise serializers.ValidationError("`message` or `html_message` required")
        return data

class TagSerializer(BaseModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'name', 'type',)

class EvidenceSerializer(BaseModelSerializer):
    class Meta:
        model = Evidence
        fields = ('id', 'file', 'hyperlink', 'label', 'description',)

class AwardEndorsementSerializer(serializers.ModelSerializer):
    class Meta:
        model = AwardEndorsement
        fields = (
            'id', 'issuer_name', 'issuer_url', 'issuer_email', 'issuer_image_data_uri',
        )
        
class AwardSerializer(BaseModelSerializer):
    tags = serializers.SerializerMethodField()
    shares = serializers.SerializerMethodField()
    evidence = EvidenceSerializer(source='evidence_set', many=True)
    endorsements = AwardEndorsementSerializer(source='awardendorsement_set', many=True)

    class Meta:
        model = Award
        fields = (
            'id', 'issued_date', 'expiration_date', 'verified_dt', 'revoked', 
            'revoked_reason', 'student_name', 'badge_name',
            'badge_version',  'badge_description', 'badge_criteria', 'badge_image',
            'baked_image_url', 'badge_image_data_uri', 'assertion_url',
            'issuer_org_url', 'issuer_org_name',
            'tags', 'shares', 'evidence', 'endorsements', 'entry', 'is_deleted',
        )

    def get_tags(self, obj):
        return obj.tags.order_by('name').values_list('name', flat=True)

    def get_shares(self, obj):
        return obj.shares.values_list('id', flat=True)

class AwardVerifySerializer(BaseModelSerializer):
    class Meta:
        model = Award
        fields = ('id', 'verified_dt', 'revoked', 'revoked_reason',)

class FilteredListSerializer(serializers.ListSerializer):
    """Filter deleted and order by creation date"""
    def to_representation(self, data):
        data = data.filter(is_deleted=False).order_by('created_dt')
        return super(FilteredListSerializer, self).to_representation(data)
    
class AttachmentSerializer(BaseModelSerializer):
    hyperlink = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = (
            'id', 'section', 'label', 'award', 'file', 'hyperlink',  'data_uri',
            'created_dt',
        )
        list_serializer_class = FilteredListSerializer

    def get_hyperlink(self, obj):
        if obj.hyperlink:
            return obj.hyperlink

        if obj.file:
            return obj.file.url

        if obj.award:
            return self.context.get('request').build_absolute_uri(
                reverse('viewBadge', kwargs={'award_id': str(obj.award.id)}))

        return ''

class SectionSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True)

    class Meta:
        model = Section
        fields = ('id', 'title', 'text', 'attachments', 'updated_dt',)
        extra_kwargs = {'id': {'read_only': False, 'required': False}}
        list_serializer_class = FilteredListSerializer

class EntrySerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True)
    tags = serializers.SerializerMethodField()
    shares = serializers.SerializerMethodField()

    class Meta:
        model = Entry
        fields = (
            'id', 'created_dt', 'sections', 'tags', 'shares', 'award',
        )

    def get_tags(self, obj):
        return obj.tags.order_by('name').values_list('name', flat=True)

    def get_shares(self, obj):
        return obj.shares.values_list('id', flat=True)

class AttachmentPostFileField(serializers.FileField):
    """Allow front-end to send URL as file"""
    def to_internal_value(self, data):
        if isinstance(data, basestring)\
        and re.match(r'^https?://', data):
            return data
                   
        return super(AttachmentPostFileField, self).to_internal_value(data)

class AttachmentPostSerializer(BaseModelSerializer):
    file = AttachmentPostFileField(required=False, allow_null=True)
    copy = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True, queryset=Attachment.objects.all())
    
    class Meta:
        model = Attachment
        fields = (
            'id', 'section', 'label', 'award', 'file', 'hyperlink', 'data_uri', 'copy'
        )
        extra_kwargs = {'id': {'read_only': False, 'required': False}}

    def validate_data_uri(self, value):
        if value and not RE_DATA_URI.match(value):
            raise serializers.ValidationError('Invalid data_uri.')
        
        return value
 
    def process_image_file(self, uploaded_file):
        data_uri = ''
        
        if not uploaded_file:
            return data_uri
            
        try:
            image = Image.open(uploaded_file)
            image_format = image.format

            # Rotate, if needed
            if hasattr(image, '_getexif'):
                orientation_key = next(k for k, v in ExifTags.TAGS.items() if v == 'Orientation')

                exif = image._getexif()
                if exif is not None:
                    exif_dict = dict(exif.items())
                    orientation = exif_dict.get(orientation_key, None)

                    if orientation == 3:
                        image = image.transpose(Image.ROTATE_180)
                        uploaded_file.seek(0)
                        image.save(uploaded_file, format=image_format)
                    elif orientation == 6:
                        image = image.transpose(Image.ROTATE_270)
                        uploaded_file.seek(0)
                        image.save(uploaded_file, format=image_format)
                    elif orientation == 9:
                        image = image.transpose(Image.ROTATE_90)
                        uploaded_file.seek(0)
                        image.save(uploaded_file, format=image_format)

            # Make data_uri for thumbnail, if needed
            if image_format in ('GIF', 'JPEG', 'JPG', 'PNG'):
                thumbnail = image.copy()
                image.thumbnail((300, 300), Image.ANTIALIAS)

                buffer = io.BytesIO()
                image.save(buffer, format=image_format)

                data_uri = 'data:image/%s;base64,%s' % (
                    image_format.lower(),
                    base64.b64encode(buffer.getvalue())
                )

                buffer.close()

            uploaded_file.seek(0)
        except (KeyError, IOError):
            pass   
            
        return data_uri

    def create(self, validated_data):
        label = validated_data.get('label', '')
        
        copy = validated_data.pop('copy', None)
        data_uri = validated_data.pop('data_uri', '')
        uploaded_file = validated_data.pop('file', None)
        temp_filepath = ''
        
        if copy:
            # Copy file from existing attachment
            uploaded_file = copy.file    
        elif data_uri:          
            # Save data_uri to tempfile and then blank
            m = RE_DATA_URI.match(data_uri)
   
            mediatype = m.group('mediatype') or 'text/plain'
            encoding = m.group('encoding') or None
            data = m.group('data')

            _, suffix = os.path.splitext(label)   
            if not suffix:
                suffix = file_util.guess_extension(mediatype) or ''
            
            (fd, temp_filepath) = tempfile.mkstemp(suffix=suffix)
            
            uploaded_file = os.fdopen(fd, 'r+b')
            if encoding:
                uploaded_file.write(base64.b64decode(data))       
            else:
                uploaded_file.write(data)
            
            uploaded_file.seek(0)
        
        data_uri = self.process_image_file(uploaded_file)
        
        instance = Attachment.objects.create(
            user=self.context.get('request').user, data_uri=data_uri, **validated_data)
 
        if uploaded_file:
            instance.file.save(label, uploaded_file)
        
        if temp_filepath:
            os.remove(temp_filepath)
            
        return instance
        
class SectionPostSerializer(BaseModelSerializer):
    attachments = serializers.ListSerializer(child=AttachmentPostSerializer())

    class Meta:
        model = Section
        fields = ('id', 'title', 'text', 'attachments')
        extra_kwargs = {'id': {'read_only': False, 'required': False}}

class EntryPostSerializer(serializers.ModelSerializer):
    sections = serializers.ListSerializer(child=SectionPostSerializer())

    class Meta:
        model = Entry
        fields = ('id', 'award', 'sections',)
        extra_kwargs = {'id': {'read_only': False, 'required': False}}

    def create(self, validated_data):
        # Handle special kwarg (ignore)
        ignore_attachments = validated_data.pop('ignore_attachments', True)
        
        user = self.context.get('request').user

        section_data_list = validated_data.pop('sections', [])
        
        instance = Entry.objects.create(user=user, **validated_data)

        for section_data in section_data_list:
            # Ignore attachments, saved separately by UI
            section_data.pop('attachments', [])
            
            section = Section.objects.create(entry=instance, **section_data)
    
        return instance

    def update(self, instance, validated_data):
         # Handle special kwarg
        ignore_attachments = validated_data.pop('ignore_attachments', False)
        
        user = self.context.get('request').user
        
        old_sections = set(
            instance.sections.filter(is_deleted=False)\
                .values_list('id', flat=True)
        )

        old_attachments = set(
            Attachment.objects.filter(section_id__in=old_sections, is_deleted=False)\
                .values_list('id', flat=True)
        )
        
        for section_data in validated_data.get('sections'):
            # Assume attachments saved separately by UI
            attachment_data_list = section_data.pop('attachments', [])
            
            try:
                section = Section.objects.get(pk=section_data.get('id'))
                section.title = section_data.get('title')
                section.text = section_data.get('text')
                section.save()  
                
                old_sections.remove(section.id)       
            except Section.DoesNotExist:
                section = Section.objects.create(entry=instance, **section_data)
             
            if not ignore_attachments:                
                old_attachments -= set([d['id'] for d in attachment_data_list])
                                                             
        # Flag old sections/attachments as deleted
        Section.objects.filter(id__in=old_sections).update(is_deleted=True)
        
        if not ignore_attachments:
            Attachment.objects.filter(id__in=old_attachments).update(is_deleted=True)

        return instance

class ContentTypeField(serializers.RelatedField):
    queryset = ContentType.objects.all()

    default_error_messages = {
        'required': 'This field is required.',
        'does_not_exist': 'Invalid value "{name}" - type does not exist.',
        'invalid_value': 'Invalid value "{name}" - type not allowed.',
    }

    def to_representation(self, value):
        """Return `ContentType.model` as serialized representation"""
        return value.model

    def to_internal_value(self, data):
        """Return `ContentType` as internal representation"""
        if data not in ['award', 'entry']: # add more here
            self.fail('invalid_value', name=data)

        try:
            return ContentType.objects.get(model=data)
        except ContentType.DoesNotExist:
            self.fail('does_not_exist', name=data)

class ShareSerializer(BaseModelSerializer):
    content_type = ContentTypeField()
    url = serializers.SerializerMethodField()
    views = serializers.SerializerMethodField()

    class Meta:
        model = Share
        fields = (
            'id', 'created_dt', 'content_type', 'object_id', 'views', 'url', 'type',
            'is_deleted',
        )

    def get_url(self, obj):
        request = self.context.get('request')

        return request.build_absolute_uri(
            reverse('viewShare', kwargs={'share_id': str(obj.id)}))

    def get_views(self, obj):
        parts = urlparse(self.get_url(obj))
        return Visitor.objects.filter(pageviews__url=parts.path).distinct().count()

    def create(self, validated_data):
        user = self.context.get('request').user

        content_type = validated_data.pop('content_type')
        object_id = validated_data.pop('object_id')

        try:
            content_object = content_type.get_object_for_this_type(id=object_id, user=user)

            return Share.objects.create(user=user, content_object=content_object,
                **validated_data)
        except ObjectDoesNotExist as e:
            raise serializers.ValidationError(str(e))

class RegistrationSerializer(BaseModelSerializer):
    class Meta:
        model = Registration
        exclude = ('id', 'key', 'secret' )
