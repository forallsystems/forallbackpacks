import base64, hashlib, io, json, math, os, random, tempfile, traceback, urllib
from datetime import date
from urlparse import urljoin, urlparse
from wsgiref.util import FileWrapper
from django.conf import settings
from django.contrib.auth import update_session_auth_hash, authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator as token_generator
from django.core.files import File
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.db.models import Count, Q, F, Case, When, IntegerField
from django.db.models.functions import Lower
from django.http import Http404
from django.utils import timezone
from django.utils.encoding import force_bytes, force_text
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.urls import reverse
from rest_framework import exceptions, status, viewsets
from rest_framework.decorators import list_route, detail_route
from rest_framework.exceptions import APIException, ValidationError, PermissionDenied
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.views import set_rollback, APIView
from oauth2client import client
from apiclient.discovery import build
from twilio.rest import TwilioRestClient
from PIL import Image
import dropbox
import httplib2
from onedrivesdk.error import OneDriveError
import png
import requests
from .mixins import LoggingMixin
from .permissions import create_jwt_token, get_registration, HasForallPermission, APIPermission
from .serializers import *
from oauth2_provider.models import *
import openbadges_bakery
from forallbackpack import assertion, file_util
from forallbackpack.models import *
from forallbackpack.util import send_activation_email
from forallbackpack.views import getOneDriveClient


def custom_exception_handler(exc, context):
    """
    Returns the response that should be used for any given exception, formatted in a
    consistent way for front-end ajax calls.  By default we handle:
    `Http404`, `PermissionDenied`, `APIException`, and 401 status codes.

    Any unhandled exceptions may return `None`, which will cause a 500 error
    to be raised.
    """
    print 'custom_exception_handler caught %s\n' % type(exc), str(exc)

    if isinstance(exc, Http404):
        data = {'detail': 'Not found'}

        set_rollback()
        return Response(data, status=status.HTTP_404_NOT_FOUND)

    elif isinstance(exc, PermissionDenied) \
    or (hasattr(exc, 'status_code') and exc.status_code == status.HTTP_401_UNAUTHORIZED):
        data = {'detail': 'Permission denied.'}

        set_rollback()
        return Response(data, status=status.HTTP_403_FORBIDDEN)

    elif isinstance(exc, exceptions.APIException):
        headers = {}
        if getattr(exc, 'auth_header', None):
            headers['WWW-Authenticate'] = exc.auth_header
        if getattr(exc, 'wait', None):
            headers['Retry-After'] = '%d' % exc.wait

        data = str(exc)

        if hasattr(exc, 'detail'):
            print 'detail (%s):' % type(exc.detail), exc.detail

            if isinstance(exc.detail, dict):
                # Unwind detail into flat list
                errors = []

                for key, value in exc.detail.iteritems():
                    if isinstance(value, list):
                        value = value[0]

                    # Check for list, because eval()-ing a string will error out
                    if value[0] == '[':
                        value = eval(value)

                    if isinstance(value, list):
                        errors.extend(value)
                    else:
                        errors.append(value)

                data = {'detail': errors}
            elif isinstance(exc.detail, list):
                data = {'detail': exc.detail[0]}
            else:
                data = {'detail': exc.detail}

        set_rollback()
        return Response(data, status=status.HTTP_400_BAD_REQUEST, headers=headers)

    return None

def delete_request(auth_token, url, json_data=None):
    """
    Send DELETE request with Authorization header
    """
    try:
        r = requests.delete(url, json=json_data, headers={'Authorization': auth_token})

        # Handle error messages
        if r.status_code == 400:
            raise APIException(r.json())

        try:
            r.raise_for_status()
            return r.json()
        except requests.RequestException as re:
            raise APIException("request exception")
    except requests.ConnectionError as ce:
        raise APIException("connection error")

def post_request(auth_token, url, json_data):
    """
    Send POST request with Authorization header
    """
    try:
        r = requests.post(url, json=json_data, headers={'Authorization': auth_token})

        # Handle error messages
        if r.status_code == 400:
            raise APIException(r.json())

        try:
            r.raise_for_status()
            return r.json()
        except requests.RequestException as re:
            raise APIException("request exception")
    except requests.ConnectionError as ce:
        raise APIException("connection error")

def handle_award_image(award, badge_image_input):
    """
    Save badge_image and badge_image_data_uri for `badge_image_input` to award.
    `badge_image_input` = url or filepath
    """
    pr = urlparse(badge_image_input)
    
    if pr.scheme and pr.netloc:
        filepath, content_type = file_util.fetch_image(badge_image_input)
              
        if content_type not in [file_util.MIME_TYPE_PNG, file_util.MIME_TYPE_SVG]:
            raise ValidationError("Unknown image format '%s'" % content_type)
    else:
        filepath = badge_image_input

    filename = os.path.basename(filepath)
    award.badge_image.save(filename, File(open(filepath)))

    award.badge_image_data_uri = file_util.make_image_data_uri(filepath, resize_to=(300, 300))
    award.save()
    
    os.remove(filepath)

def handle_award_endorsement_image(endorsement, issuer_image_input):
    """
    Save issuer_image and issuer_image_data_uri for `issuer_image_input` to `endorsement`.
    `issuer_image_input` = url or filepath
    """
    pr = urlparse(issuer_image_input)
    
    if pr.scheme and pr.netloc:
        filepath, content_type = file_util.fetch_image(issuer_image_input)
    
        if content_type not in file_util.IMAGE_MIME_TYPES:
            raise ValidationError("Unknown endorsement image format '%s'" % content_type)
    else:
        filepath = issuer_image_input
    
    filename = os.path.basename(filepath)
    endorsement.issuer_image.save(filename, File(open(filepath)))
    
    endorsement.issuer_image_data_uri = file_util.make_image_data_uri(filepath, resize_to=(300, 300))
    endorsement.save()
    
    os.remove(filepath)
            
def handle_award_push(request, award_data, user=None):
    award = Award.getAwardByExternalID(award_data['id'])
    if award:
        award.is_deleted = False    # Just unflag
    else:
        if not user:
            user = request.user
        award = Award(user=user)
    
    award.issued_date = award_data.get('issued_date', None) or None
    award.external_id = award_data['id']
    award.badge_id = award_data['badge_id']
    award.external_badge_id = award_data.get('external_badge_id', '')
    award.verified_dt = award_data.get('verified_dt', award.verified_dt)
    award.expiration_date = award_data.get('expiration_date', None) or None
    award.student_name = award_data['student_name']
    award.student_email = award_data['student_email']
    award.org_issued_name = award_data['org_issued_name']
    award.badge_name = award_data['badge_name']
    award.badge_version = award_data['badge_version']
    award.badge_description = award_data['badge_description']
    award.badge_criteria = award_data['badge_criteria']
    award.assertion_url = award_data.get('assertion_url', '')
    award.issuer_org_url = award_data['issuer_org_url']
    award.issuer_org_name = award_data['issuer_org_name']
    award.issuer_org_origin = award_data['issuer_org_origin']
    award.issuer_org_email = award_data['issuer_org_email']
    
    try:
        award.save()
    except Exception as e:        
        traceback.print_exc()
        raise e
        
    handle_award_image(award, award_data['badge_image'])

    # Delete any current endorsements then re-add
    for ae in AwardEndorsement.objects.filter(award=award):
        if ae.issuer_image:
            ae.issuer_image.delete()
        ae.delete()
    
    for data in award_data.get('endorsements', []):        
        ae = AwardEndorsement.objects.create(
            award=award,
            issuer_name=data['issuer_name'],
            issuer_url=data.get('issuer_url', ''),
            issuer_email=data.get('issuer_email', ''),
            issued_on=data['issued_on']
        )

        ae_image = data.get('issuer_image', None)
         
        if ae_image:
            handle_award_endorsement_image(ae, ae_image)
        
    # Delete any current evidence then re-add
    for e in Evidence.objects.filter(award=award):
        if e.file:
            e.file.delete()
        e.delete()

    for data in award_data['evidence']:
        evidence = Evidence.objects.create(
            award=award,
            hyperlink=data.get('hyperlink', ''),
            label=data.get('label', ''),
            description=data.get('description', '')
        )
        
        evidence_file = data.get('file', None)
        evidence_filepath = data.get('filepath', None)
        evidence_filename = data.get('filename', None)
 
        if evidence_file:
            # Push from hub
            try:
                temp_filepath, content_type = file_util.fetch_file(evidence_file)
                file_name = os.path.basename(evidence_file)
                
                evidence.file.save(file_name, File(open(temp_filepath)))
                
                os.remove(temp_filepath)
            except Exception as e:
                evidence.hyperlink = evidence_file
                evidence.save()
        elif evidence_filepath:
            # Upload by user
            evidence.file.save(evidence_filename, File(open(evidence_filepath)))
            os.remove(evidence_filepath)
            
    return award

def get_registration_for_claim_code(claim_code):
    """Return `Registration` for claim_code"""
    m = re.match(r'^([^-_]+)[-_](.+)$', claim_code)
    if not m:
        raise APIException("The Claim Code you entered is invalid")

    try:
        return Registration.objects.get(prefix=m.group(1))
    except Registration.DoesNotExist:
        raise APIException("Invalid claim code [registration not found]")


class ForallUserViewSet(LoggingMixin, viewsets.GenericViewSet,
                        mixins.CreateModelMixin,
                        mixins.DestroyModelMixin):
    queryset = UserProfile.objects.all()
    serializer_class = ForallUserSerializer
    #permission_classes = [HasForallPermission]

    def get_serializer_context(self):
        """Add `registration` to serializer context"""
        context = super(ForallUserViewSet, self).get_serializer_context()
        context['registration'] = get_registration(self.request)
        return context

    def perform_destroy(self, instance):
        """Override to delete `User` instance"""
        user = instance.user
        instance.delete()
        user.delete()


class RegistrationViewSet(LoggingMixin, viewsets.ViewSet):
    """
    get:
    Return registration for authenticated org.
    """
    #permission_classes = [APIPermission]

    @list_route(methods=['GET'])
    def getRegistration(self, request, format=None):
        serializer = RegistrationSerializer(get_registration(request))
        return Response(serializer.data)
        #org = get_org(request)
        #return Response(org.prefix)
    '''
    def get(self, request, format=None):
        serializer = RegistrationSerializer(self.get_registration())
        return Response(serializer.data)
    '''

class ForallViewSet(LoggingMixin, viewsets.ViewSet):
    permission_classes = []#[HasForallPermission]

    def generateToken(self):
        n =  50
        text = ""
        possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

        for i in range(0,n):
            text += possible[int(math.floor(random.random() * len(possible)))]

        return text

    @list_route(methods=['post'])
    def register_new_org(self, request, format=None):
        """Adding a new org to FB via install scripts"""
        name = request.data.get('name', '')
        prefix = request.data.get('prefix', '')
        url = request.data.get('url', '')

        key = self.generateToken()
        secret = self.generateToken()

        r = Registration(name=name, prefix=prefix, url=url, key=key, secret=secret)
        r.save()

        return Response({'key':key, 'secret':secret})

    @list_route(methods=['post'])
    def register_new_hub(self, request, format=None):
        name = request.data.get('name', '')
        redirect_url = request.data.get('redirect_url', '')

        key = self.generateToken()
        secret = self.generateToken()

        Application.objects.create(
            client_id=key,
            redirect_uris=redirect_url,
            client_type='confidential',
            authorization_grant_type='authorization-code',
            client_secret=secret,
            name=name,
            skip_authorization=1
        )

        #Create
        key2 = self.generateToken()
        secret2 = self.generateToken()

        Application.objects.create(
            client_id=key2,
            redirect_uris=redirect_url,
            client_type='confidential',
            authorization_grant_type='password',
            client_secret=secret2,
            name=name,
            skip_authorization=1
        )


        return Response({'key':key, 'secret':secret,'key2':key2, 'secret2':secret2})

class MyViewSet(LoggingMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @list_route(methods=['get'])
    def test(self, request, format=None):
        """For testing connectivity"""
        return Response(status=status.HTTP_200_OK)

    @list_route(methods=['get', 'post'])
    def claim_fsbadge(self, request, format=None):
        """Claim the 'ForallSystems' badge"""
        image_path = os.path.join(settings.STATIC_ROOT, 'images', 'FSBadge.png')

        award = Award.objects.create(
            user=request.user,
            issued_date=date.today().strftime('%Y-%m-%d'),
            verified_dt=timezone.now(),
            student_name=request.user.get_full_name(),
            student_email=request.user.email,
            badge_name="ForAllSystems",
            badge_description="Thank you for claiming the ForAllSystems badge!",
            badge_criteria="Created a new account on ForAllBackpacks.",
            org_issued_name="ForAllSystems",
            issuer_org_url="http://www.forallsystems.com",
            issuer_org_name="ForAllSystems",
            issuer_org_email="info@forallsystems.com",
            issuer_org_origin="http://www.forallsystems.com"
        )

        award.badge_image.save('fsbadge.png', File(open(image_path)))
        award.badge_image_data_uri = file_util.make_image_data_uri(image_path, resize_to=(300, 300))
        award.save()

        return Response(AwardSerializer(award).data)

    @list_route(methods=['get', 'post'])
    def account(self, request, format=None):
        """Get or update full account information"""
        userprofile = UserProfile.objects.get(user=request.user)

        if request.method == 'GET':
            serializer = MyAccountSerializer(userprofile);
        else:
            serializer = MyAccountSerializer(userprofile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Handle password change
            if serializer.validated_data.get('password', ''):
                update_session_auth_hash(request, request.user)

        return Response(serializer.data)

    @list_route(methods=['get'])
    def googletoken(self, request, format=None):
        """Get google token if available, raises 403 if needs authorization"""
        try:
            # Create credentials from stored json
            # https://developers.google.com/api-client-library/python/auth/web-app
            auth_token = AuthToken.objects.get(user=request.user, type='GoogleDrive')

            credentials = client.OAuth2Credentials.from_json(auth_token.credentials)
            if credentials.access_token_expired:
                raise PermissionDenied()

            return Response({'access_token': credentials.access_token});
        except AuthToken.DoesNotExist:
            raise PermissionDenied()

    @list_route(methods=['post'])
    def claim_account(self, request):
        """UNUSED: Claim an account using a claim code"""
        userprofile = UserProfile.objects.get(user=request.user)

        account_claim_code = request.data.get('claim_code', '')
        if not account_claim_code:
            raise APIException("Expected 'claim_code'")

        registration = get_registration_for_claim_code(account_claim_code)

        jwt_token = create_jwt_token(registration.id)
        url = registration.url_for('claim_account')

        json_response = post_request(jwt_token, url, {
            'account_claim_code': account_claim_code,
            'forallbackpack_user_id': str(userprofile.id)
        })

        app_id = json_response['hub_id']
        app_name = json_response['hub_name']
        app_url = json_response['hub_url']

        # Link account
        try:
            UserAccount.objects.get(user=request.user, registration=registration)
        except UserAccount.DoesNotExist:
            UserAccount.objects.create(user=request.user, registration=registration)

        # Link app
        try:
            user_app = UserApp.objects.get(user=request.user, app_url=app_url)
        except UserApp.DoesNotExist:
            user_app = UserApp.objects.create(
                user=request.user, app_id=app_id, app_name=app_name, app_url=app_url)

        return Response({
            'org': registration.name,
            'account_url': urljoin(json_response['hub_url'], '/relogin/forallbackpack/'),
            'app': UserAppSerializer(user_app).data
        })

    @list_route(methods=['post'])
    def claim_event(self, request):
        userprofile = UserProfile.objects.get(user=request.user)
        event = userprofile.event

        if event:
            registration = event.registration

            jwt_token = create_jwt_token(registration.id, {
                'forallbackpack_user_id': str(userprofile.id),
                'user_id': ''
            })
            url = registration.url_for('claim_event')

            json_response = post_request(jwt_token, url, {
                'event_id': str(userprofile.event_id),
                'class_code': userprofile.event_class_code,
                'forallbackpack_user_id': str(userprofile.id),
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'email': request.user.email,
            })

            if settings.DEBUG:
                print 'response', json_response

            app_id = json_response['hub_id']
            app_name = json_response['hub_name']
            app_url = json_response['hub_url']

            # Make sure account is linked
            try:
                UserAccount.objects.get(user=request.user, registration=registration)
            except UserAccount.DoesNotExist:
                UserAccount.objects.create(user=request.user, registration=registration)

            # Link app
            try:
                user_app = UserApp.objects.get(user=request.user, app_url=app_url)
            except UserApp.DoesNotExist:
                user_app = UserApp.objects.create(
                    user=request.user, app_id=app_id, app_name=app_name, app_url=app_url)

            award_data = json_response.get('award', None)

            # Handle auto-issued awards
            if award_data:
                if settings.DEBUG:
                    print 'Auto-issued event award'
                award = handle_award_push(request, award_data)
                award.event = event;
                award.save()
                return Response(AwardSerializer(award).data)

            # Handle pledgable badges
            if event.is_pledge:
                if settings.DEBUG:
                    print 'Creating pledgable badge for event'
                award = Award.objects.create(
                    user=request.user,
                    event=event,
                    issuer_org_name=registration.name,
                    badge_name=event.badge_name,
                    badge_description=event.badge_description,
                    badge_criteria=event.badge_criteria
                )

                handle_award_image(award, event.badge_image)
                return Response(AwardSerializer(award).data)

        return Response({})

    @list_route(methods=['post'])
    def claim_badge(self, request):
        """Claim a badge using a claim code"""
        userprofile = UserProfile.objects.get(user=request.user)

        claim_code = request.data.get('claim_code', '')
        if not claim_code:
            raise APIException("Expected 'claim_code'")

        registration = get_registration_for_claim_code(claim_code)

        jwt_token = create_jwt_token(registration.id, {
            'forallbackpack_user_id': str(userprofile.id),
            'user_id': ''
        })
        url = registration.url_for('award_claim')

        json_response = post_request(jwt_token, url, {
            'claim_code': claim_code,
            'forallbackpack_user_id': str(userprofile.id),
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'email': request.user.email,
        })

        # Make sure account is linked
        try:
            UserAccount.objects.get(user=request.user, registration=registration)
        except UserAccount.DoesNotExist:
            UserAccount.objects.create(user=request.user, registration=registration)

        award = handle_award_push(request, json_response)

        return Response(AwardSerializer(award).data)

class UserViewSet(LoggingMixin, viewsets.ViewSet):

    @list_route(methods=['get'], permission_classes=[IsAuthenticated])
    def details(self, request):
        """Return user details for social-app-django pipline"""
        user = request.user
        user_profile = UserProfile.objects.get(user=request.user)

        return Response({
            'id': user_profile.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name(),
            'accounts': user.useraccount_set.values_list('registration__prefix', flat=True)
        })

    @list_route(methods=['post'])
    def exists(self, request):
        """
        Return whether or not an account exists for an email address and is validated.  
        If account exists and connected to caller, also return associated id.
        """
        email = request.data.get('email', None)
        if not email:
            return Response("Expected 'email'", status=status.HTTP_400_BAD_REQUEST)
         
        try:
            useremail = UserEmail.objects.get(email=email)
            registration = get_registration(request) 
            
            try:
                UserAccount.objects.get(user=useremail.user, registration=registration)              
                return Response({
                    'exists': 1, 
                    'id': useremail.user.userprofile.id, 
                    'is_validated': useremail.is_validated
                })
            except UserAccount.DoesNotExist:
                return Response({
                    'exists': 1, 
                    'id': '', 
                    'is_validated': False
                })
        except UserEmail.DoesNotExist:
            pass

        return Response({'exists': 0, 'id': '', 'is_validated': False})

    @list_route(methods=['post'])
    def generate_username(self, request):
        """
        Generate a valid, unique username based on a first and last name.
        Note: Username must be at least 6 characters with only numbers, letters, and +/-/_/.
        """
        prefix = request.data.get('prefix', '')
        if not prefix:
            raise APIException('Expected "prefix"')
            
        first_name = request.data.get('first_name', '')        
        if not first_name:
            raise APIException('Expected "first_name"')
        
        last_name = request.data.get('last_name', '')
        if not last_name:
            raise APIException('Expected "last_name"')
        
        # Only valid chars
        first_name = re.sub('[^A-Za-z0-9+-_]', '', first_name)
        last_name = re.sub('[^A-Za-z0-9+-_]', '', last_name)
        
        # Pad with '0' as needed
        fragment = '%s%s' % (first_name[0].lower(), last_name.lower())  
        fragment += '0' * (5 - len(fragment))
        
        # Scope by prefix
        lookup_scope = '%s_%s' % (prefix, fragment)
          
        n = User.objects.filter(username__istartswith=lookup_scope).count()+1
        
        return Response({'username': '%s%d' % (fragment, n)})        
    
    @list_route(methods=['post'])
    def set_password(self, request):
        """Set user password"""   
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        
        try:
            userprofile = UserProfile.objects.get(pk=validated_data['forallbackpack_user_id'])
        except UserProfile.DoesNotExist:
            return Response('User account not found.', 
                status=status.HTTP_400_BAD_REQUEST)
            
        if not userprofile.user.is_active:
            return Response('User account is not active.', 
                status=status.HTTP_400_BAD_REQUEST)
        
        userprofile.user.set_password(validated_data['password'])
        userprofile.user.save()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
                    
    @list_route(methods=['post'])
    def reset_password(self, request):
        """Reset user password"""
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        try:
            user = UserEmail.objects.get(email=validated_data['email']).user
        except UserEmail.DoesNotExist:
            return Response('User account with this email address not found.',
                status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response('This user account is not active.',
                status=status.HTTP_400_BAD_REQUEST)

        # Generate message vars
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)

        # Process message
        message = validated_data['message']\
            .replace('{{UIDB64}}', uidb64)\
            .replace('{{TOKEN}}', token)

        # Send email to user
        send_mail(
            validated_data['subject'],
            message,
            '%s <%s>' % (validated_data['from_name'], settings.DEFAULT_FROM_EMAIL),
            [validated_data['email']],
            fail_silently=True
        )

        return Response({})

    @list_route(methods=['post'])
    def reset_password_confirm(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        try:
            # Lookup user
            uid = force_text(urlsafe_base64_decode(validated_data['uidb64']))
            user = User.objects.get(pk=uid)

            if not user.is_active:
                return Response('This user account is not active.',
                    status=status.HTTP_400_BAD_REQUEST)

            # Validate token
            if not token_generator.check_token(user, validated_data['token']):
                return Response('Unable to reset password (invalid token)')

            # Reset password
            user.set_password(validated_data['password'])
            user.save()

            return Response({})
        except User.DoesNotExist:
            return Response('User account with this email address not found.',
                status=status.HTTP_400_BAD_REQUEST)

    def verify_claim_code(self, registration, account_claim_code, email=''):
        """Verify `account_claim_code`."""        
        jwt_token = create_jwt_token(registration.id)
        url = registration.url_for('verify_account_claim_code')
               
        json_response = post_request(jwt_token, url, {
            'account_claim_code': account_claim_code,
            'email': email
        })
                
        return json_response.get('forallbackpack_user_id', '') 
       
    def do_link_account(self, registration, account_claim_code, user, **kwargs):
        """Link account via `account_claim_code`."""
        jwt_token = create_jwt_token(registration.id)
        url = registration.url_for('claim_account')

        request_data = dict(kwargs)
        request_data.update({
            'account_claim_code': account_claim_code,
            'forallbackpack_user_id': str(user.userprofile.id)
        })
                
        json_response = post_request(jwt_token, url, request_data)

        app_id = json_response['hub_id']
        app_name = json_response['hub_name']
        app_url = json_response['hub_url']

        # Link account
        try:
            UserAccount.objects.get(user=user, registration=registration)
        except UserAccount.DoesNotExist:
            UserAccount.objects.create(user=user, registration=registration)

        # Link app
        try:
            UserApp.objects.get(user=user, app_url=app_url)
        except UserApp.DoesNotExist:
            UserApp.objects.create(user=user, app_id=app_id, app_name=app_name, app_url=app_url)
        
        return Response({})
         
    @list_route(methods=['post'])
    def claim_link_account(self, request):
        """
        Link existing account identified by forallback_user_id or email using claim code.
        """
        serializer = ClaimAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Validate claim code format/prefix
        account_claim_code = serializer.validated_data.pop('claim_code')
        registration = get_registration_for_claim_code(account_claim_code)

        forallbackpack_user_id = str(serializer.validated_data.get('forallbackpack_user_id', '') or '')           
        email = serializer.validated_data.get('email')
               
        try:           
            # Verify claim code
            forallpathways_user_id = self.verify_claim_code(registration, account_claim_code)
                       
            # Verify id match
            if forallbackpack_user_id:
                if forallpathways_user_id and forallpathways_user_id != forallbackpack_user_id:
                    raise Exception('Invalid claim code for user account')  
            elif forallpathways_user_id:
                forallbackpack_user_id = forallpathways_user_id
           
            if forallbackpack_user_id:
                # Verify user id
                userprofile = UserProfile.objects.get(pk=forallbackpack_user_id)  
                
                # Verify that email not used or used by this user
                try:
                    useremail = UserEmail.objects.get(email=email) 
                
                    if useremail.user != userprofile.user:
                        raise Exception('Invalid email address for user account')
                except UserEmail.DoesNotExist:
                    useremail = None
            else:
                # Verify email
                useremail = UserEmail.objects.get(email=email)
                userprofile = useremail.user.userprofile

            # Authenticate user
            user = authenticate(
                username=userprofile.user.username, 
                password=serializer.validated_data['password']
            )
            
            if not user or not user.is_active:
                raise Exception('Please enter a correct username and password.')
                
            # Make sure validated UserEmail attached to user
            has_primary = user.useremail_set.filter(is_primary=True).count() > 0
            
            if useremail:
                useremail.is_validated = True
                useremail.is_primary = useremail.is_primary or not has_primary
            else:
                useremail = UserEmail(user=user, email=email, is_validated=True)
                useremail.is_primary = not has_primary
            
            useremail.save()
            
            # Make sure stored in User if primary
            if useremail.is_primary and user.email != email:
                user.email = email
                user.save()
                
            # Link account
            return self.do_link_account(registration, account_claim_code, user)            
        except APIException as e:
            if e.detail == 'connection error':
                return Response(
                    'We are unable to verify your claim code at this time.  Please contact technical support.',
                    status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except UserProfile.DoesNotExist:
            return Response('User account not found', status=status.HTTP_400_BAD_REQUEST)
        except UserEmail.DoesNotExist:
            return Response('User account for email address not found', status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(e.message, status=status.HTTP_400_BAD_REQUEST)

    @list_route(methods=['post'])
    def claim_new_account(self, request):
        """
        Create new account using claim code.
        """
        serializer = ClaimNewAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
 
        # Validate claim code format/prefix
        account_claim_code = serializer.validated_data.pop('claim_code')
        registration = get_registration_for_claim_code(account_claim_code)

        email = serializer.validated_data.get('user').get('email')

        try:
            # Verify claim code
            forallbackpack_user_id = self.verify_claim_code(registration, account_claim_code)
            
            if forallbackpack_user_id:
                # Get UserProfile
                userprofile = UserProfile.objects.get(pk=forallbackpack_user_id)
            
                # Verify that email not used or used by this user
                try:
                    useremail = UserEmail.objects.get(email=email) 
                    if useremail.user != userprofile.user:
                        raise Exception('Invalid email address for user account')                                        
                except UserEmail.DoesNotExist:
                    useremail = None
            
                # Authenticate user
                user = authenticate(
                    username=userprofile.user.username, 
                    password=serializer.validated_data.get('user').get('password')
                )
            
                if not user or not user.is_active:
                    raise Exception('Please enter a correct username and password.')
            
                # Make sure validated UserEmail attached to user
                has_primary = user.useremail_set.filter(is_primary=True).count() > 0
                                                
                if useremail:
                    useremail.is_validated = True
                    useremail.is_primary = useremail.is_primary or not has_primary
                else:
                    useremail = UserEmail(user=user, email=email, is_validated=True)
                    useremail.is_primary = not has_primary
                
                useremail.save()
                
                # Make sure stored in User if primary
                if useremail.is_primary and user.email != email:
                    user.email = email
                    user.save()                       
            else:
                # Verify that email not used
                try:
                    UserEmail.objects.get(email=email)
                    raise Exception('Invalid email address for user account')
                except UserEmail.DoesNotExist:
                    pass

                # Create UserProfile
                userprofile = serializer.save()
                user = userprofile.user
                           
            # Link account
            return self.do_link_account(registration, account_claim_code, user)             
        except APIException as e:
            if e.detail == 'connection error':
                return Response(
                    'We are unable to verify your claim code at this time.  Please contact technical support.',
                    status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except UserProfile.DoesNotExist:
            return Response('User account not found', status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(e.message, status=status.HTTP_400_BAD_REQUEST)

    @list_route(methods=['post'])
    def claim_new_account_code(self, request):
        """
        Create new account using claim code with username but (possibly) no email address.
        """
        serializer = ClaimCodeAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
           
        # Validate claim code format/prefix
        account_claim_code = serializer.validated_data.pop('claim_code')
        registration = get_registration_for_claim_code(account_claim_code)
                
        try:            
            username = serializer.validated_data.get('username')
            email = serializer.validated_data.get('email', '')

            # Verify claim code and email with FP
            forallbackpack_user_id = self.verify_claim_code(registration, account_claim_code, email=email)
            
            if forallbackpack_user_id:
                raise Exception('This account has already been claimed')
                         
            # Create UserProfile
            userprofile = serializer.save()
            user = userprofile.user
 
            # Link account
            if email:
                return self.do_link_account(registration, account_claim_code, user, email=email)  
            else:
                return self.do_link_account(registration, account_claim_code, user, username=username)  
        except APIException as e:
            if e.detail == 'connection error':
                return Response(
                    'We are unable to verify your claim code at this time.  Please contact technical support.',
                    status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(e.message, status=status.HTTP_400_BAD_REQUEST)

class UserEmailViewSet(LoggingMixin, viewsets.GenericViewSet,
                       mixins.CreateModelMixin,
                       mixins.UpdateModelMixin,
                       mixins.DestroyModelMixin):
    serializer_class = UserEmailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserEmail.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Override to send activation email if necessary"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        instance = serializer.save()

        if not instance.is_validated:
            send_activation_email(request, instance.id)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, pk=None):
        """Override to double-check for associated awards"""
        instance = self.get_object()

        if Award.objects.filter(student_email=instance.email).count():
            raise APIException("This email address is associated with awarded badges.")

        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @detail_route(methods=['get'])
    def send_verification(self, request, pk=None):
        """Resend activation email"""
        send_activation_email(request, pk)
        return Response(status=status.HTTP_200_OK)

class NotifyViewSet(LoggingMixin, viewsets.ViewSet):
    @list_route(methods=['post'])
    def email(self, request):
        """Send an email"""
        serializer = NotifyEmailSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        send_mail(
            validated_data['subject'],
            validated_data.get('message', ''),
            '%s <%s>' % (validated_data['from_name'], settings.DEFAULT_FROM_EMAIL),
            [validated_data['to_email']],
            fail_silently=True,
            html_message=validated_data.get('html_message', None)
        )

        return Response({})

    @list_route(methods=['post'])
    def notify(self, request):
        data = request.data

        try:
            up = UserProfile.objects.get(id=data['forallbackpack_user_id'])

            if up.notify_type in (UserProfile.SMS, UserProfile.EMAIL_SMS)\
            and up.phone_number:
                client = TwilioRestClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTO_TOKEN)

                client.sms.messages.create(
                    body=data['message'][0:159],
                    to=up.phone_number,
                    from_=settings.TWILIO_PHONE_NUMBER
                )

            if up.notify_type in (UserProfile.EMAIL, UserProfile.EMAIL_SMS):
                email = up.user.useremail_set.get(is_primary=True).email

                send_mail(data['subject'], data['message'], settings.DEFAULT_FROM_EMAIL,
                      [email], fail_silently=True)

        except UserProfile.DoesNotExist:
            print "NotifyViewSet.notify: UserProfile for '%(forallbackpack_user_id)s' not found" % data
        except UserEmail.DoesNotExist:
            print "NotifyViewSet.notify: UserEmail for '%(forallbackpack_user_id)s' not found" % data
        except Exception as e:
            print 'NotifyViewSet.notify: Unknown exception [%s]' % str(e)

        return Response({})


class TagViewSet(LoggingMixin, viewsets.GenericViewSet, mixins.ListModelMixin):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Only return Tags that are actually used by non-deleted instances.
        Case/When returns None for non-matching criteria, and Count will ignore.       
        """
        return Tag.objects.filter(user=self.request.user)\
            .annotate(
                n_awards=Count(
                    Case(
                        When(award__is_deleted=False, then=1),
                        output_field=IntegerField()
                    ),                    
                ),
                n_entries=Count(
                    Case(
                        When(entry__is_deleted=False, then=1),
                        output_field=IntegerField()
                    )                    
                )
            )\
            .filter(Q(n_awards__gt=0) | Q(n_entries__gt=0))\
            .order_by(Lower('name'))

class AwardViewSet(LoggingMixin, viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin,
                   mixins.DestroyModelMixin):
    parser_classes = (JSONParser, MultiPartParser,)
    serializer_class = AwardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action == 'verify':
            qs = Award.objects.all()
        else:
            qs = Award.objects.filter(user=self.request.user)

            if self.action == 'list':
                # Do not filter by is_deleted since Entries might need access
                qs = qs.order_by(F('issued_date').desc(nulls_first=True))

        return qs

    def destroy(self, request, pk=None):
        """Override to flag as deleted and destroy related shares"""
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()
        
        Share.objects.filter(object_id=instance.id).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @detail_route(methods=['post'])
    def tags(self, request, pk=None):
        """
        Set list of tags on `Award`
        Expects a list of tag names as request data
        """
        instance = self.get_object()
        name_list = request.data

        if not isinstance(name_list, list):
            raise ValidationError('Expected list of tag names')

        tag_list = []

        for name in name_list:
            try:
                tag = Tag.objects.get(user=request.user, name=name, type=Tag.AWARD)
            except Tag.DoesNotExist:
                tag = Tag.objects.create(user=request.user, name=name, type=Tag.AWARD)

            tag_list.append(tag)

        instance.tags.set(tag_list)

        return Response(AwardSerializer(instance).data)

    @detail_route(methods=['get'], permission_classes=[AllowAny])
    def verify(self, request, pk=None):
        """Verify awarded badge and update verification timestamp and revoked state."""
        instance = self.get_object()
        
        if instance.assertion_url:
            try:
                assertion.verify(instance.assertion_url)
                
                instance.verified_dt = timezone.now()
                instance.save()                
            except assertion.AssertionRevokedException as ae:
                instance.verified_dt = timezone.now()
                instance.revoked = True
                instance.revoked_reason = str(ae)
                instance.save()
            except Exception as e:
                raise APIException(str(e))
                
        return Response(AwardVerifySerializer(instance).data)
    
    @list_route(methods=['post'])
    def push(self, request):
        handle_award_push(request, request.data)
        return Response({}, status=status.HTTP_200_OK)
    
    @list_route(methods=['post'])
    def upload(self, request):
        uploaded_file = request.data['file']

        # Verify assertion content
        try:
            assertion_version = assertion.verify(uploaded_file)
        except assertion.AssertionRevokedException as ae:
            return Response(str(ae), status=status.HTTP_410_GONE)
        except Exception as e:
            raise APIException('Unable to verify badge assertion.')

        if assertion_version not in assertion.ALLOW_VERSIONS:
            raise APIException('Unknown badge assertion version "%s".' % assertion_version)

        if settings.DEBUG:     
            print 'api.views.upload(), assertion is valid', assertion_version
            
        # Read raw content
        try:
            uploaded_file.seek(0)
            assertion_content = openbadges_bakery.unbake(uploaded_file)
            if not assertion_content:
                raise APIException('Unable to read badge assertion.')
        except IOError as e:
            raise APIException('Unable to read badge assertion.')
                    
        # Parse content
        try:
            parsed_data = assertion.parse(assertion_content, assertion_version)
        except Exception as e:
            if settings.DEBUG:
                traceback.print_exc()
            raise APIException(e.message)   
                
        # Verify this user is the recipient
        if settings.DEBUG:
            print 'api.views.upload(), verifying recipient'
            
        email_list = UserEmail.objects.filter(user=request.user, is_validated=True)\
            .values_list('email', flat=True)

        try:
            student_email = assertion.verify_recipient(parsed_data.get('recipient'), email_list)
        except Exception as e:
            raise APIException('Could not verify recipient')
            
        if not student_email:
            raise APIException(
                'The recipient for this badge does not match any verified email address on your account.'
            )
    
        parsed_data['student_name'] = request.user.get_full_name()
        parsed_data['student_email'] = student_email
        parsed_data['verified_dt'] = timezone.now()
        
        # Save award
        award = handle_award_push(request, parsed_data)
        
        return Response(AwardSerializer(award).data)
       
    @detail_route(methods=['get'])
    def export_dropbox(self, request, pk=None):
        """
        Export to Dropbox, raises 403 if needs authorization
        """
        try:
            token = AuthToken.objects.get(user=request.user, type='Dropbox').token

            # Save baked image to tempfile
            award = self.get_object()
            award_id = str(award.id)

            baked_image_url = request.build_absolute_uri(
                reverse('downloadBadge', kwargs={'award_id':award_id}))
            temp_filepath, content_type = file_util.fetch_file(baked_image_url, '.png')

            # Load data
            with open(temp_filepath, 'rb') as f:
                data = f.read()

            # Compose file name
            name = '%s_%s.png' % (
                award.badge_name.replace(' ', '_'), award.issued_date.isoformat())

            # Send to Dropbox
            try:
                dbx = dropbox.Dropbox(token)
                res = dbx.files_upload(
                    data, '/'+name, dropbox.files.WriteMode.overwrite, mute=True)

                if settings.DEBUG:
                    print res

                return Response(status=status.HTTP_200_OK)
            except dropbox.exceptions.ApiError as e:
                print 'Dropbox exception', e
                raise APIException(str(e))
            finally:
                os.remove(temp_filepath)
        except AuthToken.DoesNotExist:
            raise PermissionDenied()

    @detail_route(methods=['get'])
    def export_googledrive(self, request, pk=None):
        """
        Export to GoogleDrive, raises 403 if needs authorization
        """
        try:
            # Create credentials from stored json
            # https://developers.google.com/api-client-library/python/auth/web-app
            auth_token = AuthToken.objects.get(user=request.user, type='GoogleDrive')

            credentials = client.OAuth2Credentials.from_json(auth_token.credentials)
            if credentials.access_token_expired:
                raise PermissionDenied()

            # Save baked image to tempfile
            award = self.get_object()
            award_id = str(award.id)

            baked_image_url = request.build_absolute_uri(
                reverse('downloadBadge', kwargs={'award_id':award_id}))
            temp_filepath, content_type = file_util.fetch_file(baked_image_url, '.png')

            # Compose file name
            name = '%s_%s.png' % (
                award.badge_name.replace(' ', '_'), award.issued_date.isoformat())

            # Send to GoogleDrive
            try:
                http_auth = credentials.authorize(httplib2.Http())
                drive = build('drive', 'v3', http=http_auth)

                response = drive.files()\
                    .create(media_body=temp_filepath, body={'name': name})\
                    .execute()

                return Response(status=status.HTTP_200_OK)
            except Exception as e:
                print 'GoogleDrive exception', e
                if e.status == 400:
                    auth_token.delete()
                    raise PermissionDenied()
                else:
                    raise APIException(str(e))
            finally:
                os.remove(temp_filepath)
        except AuthToken.DoesNotExist:
            raise PermissionDenied()

    @detail_route(methods=['get'])
    def export_onedrive(self, request, pk=None):
        """
        Export to OneDrive, raises 403 if needs authorization
        """
        try:
            # Create client from stored json
            auth_token = AuthToken.objects.get(user=request.user, type='OneDrive')

            client = getOneDriveClient()
            client.auth_provider.load_session(auth_token=auth_token)
            #client.auth_provider.refresh_token() <- this doesn't work

            # Save baked image to tempfile
            award = self.get_object()
            award_id = str(award.id)

            baked_image_url = request.build_absolute_uri(
                reverse('downloadBadge', kwargs={'award_id':award_id}))
            temp_filepath, content_type = file_util.fetch_file(baked_image_url, '.png')

            # Compose file name
            name = '%s_%s.png' % (
                award.badge_name.replace(' ', '_'), award.issued_date.isoformat())

            try:
                res = client.item(drive='me', id='root')\
                    .children[name].upload(temp_filepath)

                if settings.DEBUG:
                    print res

                return Response(status=status.HTTP_200_OK)
            except OneDriveError as ode:
                print 'OneDriveError', ode.status_code, ode.code
                if ode.status_code == 401:
                    auth_token.delete()
                    raise PermissionDenied()

            except Exception as e:
                raise APIException(str(e))
            finally:
                os.remove(temp_filepath)

            raise APIException('not implemented yet')
        except AuthToken.DoesNotExist:
            raise PermissionDenied()

class ShareViewSet(LoggingMixin, viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.CreateModelMixin,
                   mixins.RetrieveModelMixin,
                   mixins.DestroyModelMixin):
    serializer_class = ShareSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Share.objects.filter(user=self.request.user)

    def destroy(self, request, pk=None):
        """Override to just flag share as deleted"""
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

class EntryViewSet(LoggingMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'partial_update':
            return EntryPostSerializer

        return EntrySerializer

    def get_queryset(self):
        qs = Entry.objects.filter(user=self.request.user, is_deleted=False)

        if self.action == 'list':
            return qs.order_by('-created_dt')

        return qs

    def _send_pledge(self, request, instance):
        """Send pledge to FP"""
        userprofile = UserProfile.objects.get(user=request.user)
        section = instance.sections.last()

        attachment_list = []
        for attachment in section.attachments.all():
            if attachment.award:
                attachment_list.append({
                    'type': 'award',
                    'label': attachment.label,
                    'file_url': attachment.award.badge_image.url,
                    'hyperlink': request.build_absolute_uri(
                        reverse('viewBadge', kwargs={'award_id': str(attachment.award.id)})
                    )
                })
            elif attachment.file:
                attachment_list.append({
                    'type': 'file',
                    'label': attachment.label,
                    'file_url': attachment.file.url,
                    'hyperlink': ''
                })
            else:
                attachment_list.append({
                    'type': 'hyperlink',
                    'label': attachment.label,
                    'file_url': '',
                    'hyperlink': attachment.hyperlink
                })

        registration = instance.award.event.registration

        jwt_token = create_jwt_token(registration.id, {
            'forallbackpack_user_id': str(userprofile.id),
            'user_id': ''
        });

        url = registration.url_for('pledge')

        json_response = post_request(jwt_token, url, {
            'forallbackpack_user_id': str(userprofile.id),
            'event_id': str(instance.award.event.id),
            'pledge_id': str(instance.id),
            'description': section.text,
            'attachments': attachment_list
        })

        if settings.DEBUG:
            print 'json_response', json_response

    def _update_tags(self, instance, tag_name_list):
        """Update instance `tags` and return instance."""
        tag_list = []

        for name in tag_name_list:
            try:
                tag = Tag.objects.get(user=instance.user, name=name, type=Tag.ENTRY)
            except Tag.DoesNotExist:
                tag = Tag.objects.create(user=instance.user, name=name, type=Tag.ENTRY)

            tag_list.append(tag)

        instance.tags.set(tag_list)        
        return instance

    def create(self, request, *args, **kwargs):  
        # Handle tags separately  
        tag_name_list = request.data.pop('tags', None)
        if tag_name_list and not isinstance(tag_name_list, list):
            raise ValidationError('Expected "tags" as list of names')

        # We need to handle the case where app thinks entry was not saved, but it was.
        # `serializer.save()` calls `.create()` or `.update()` depending on whether
        # or not there is an `.instance`.  `.create()` ignores attachments, which is 
        # what we want, so pass special kwarg to `.save()`.
        instance = None
        
        id = request.data.get('id')
        if id:
            try:
                instance = Entry.objects.get(pk=id)    
            except Entry.DoesNotExist:
                pass
                
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
                
        instance = serializer.save(ignore_attachments=True)

        if tag_name_list:
            instance = self._update_tags(instance, tag_name_list)
            
        # If this is a pledge, send to FP
        if instance.award and instance.award.event:
            self._send_pledge(request, instance)

        return Response(
            EntrySerializer(instance, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        # Handle tags separately  
        tag_name_list = request.data.pop('tags', None)
        if tag_name_list and not isinstance(tag_name_list, list):
            raise ValidationError('Expected "tags" as list of names')

        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        instance = serializer.save()

        if tag_name_list:
            instance = self._update_tags(instance, tag_name_list)

        # If this is a pledge, send to FP
        if instance.award and instance.award.event:
            self._send_pledge(request, instance)

        return Response(
            EntrySerializer(instance, context=self.get_serializer_context()).data)
               
    def destroy(self, request, pk=None):
        """Override to flag as data deleted and destroy related shares"""
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()
                
        Section.objects.filter(entry=instance).update(is_deleted=True)
        Attachment.objects.filter(section__entry=instance).update(is_deleted=True)
                
        Share.objects.filter(object_id=pk).delete()

        # TODO: If this was a pledge, delete from FP

        return Response(status=status.HTTP_204_NO_CONTENT)

    @detail_route(methods=['post'])
    def copy(self, request, pk=None):
        """Duplicate an entry (tags, sections, attachments)"""
        instance = self.get_object()

        # Copy entry with tags
        new_instance = Entry.objects.create(user=request.user)
        new_instance.tags.set(instance.tags.all())

        # Copy sections with attachments
        for section in instance.sections.all():
            new_section = Section.objects.create(
                entry=new_instance, title=section.title+ ' (Copy)', text=section.text)

            for attachment in section.attachments.order_by('created_dt'):
                new_attachment = Attachment.objects.create(
                    user=request.user,
                    section=new_section,
                    label=attachment.label,
                    award=attachment.award,
                    hyperlink=attachment.hyperlink)

                if attachment.file:
                    content = ContentFile(attachment.file.read())
                    new_attachment.file.save(attachment.label, content)

        return Response(
            EntrySerializer(new_instance, context=self.get_serializer_context()).data)
                  
    @detail_route(methods=['post'])
    def tags(self, request, pk=None):
        """
        Set list of tags on `Entry`
        Expects a list of tag names as request data.
        """
        instance = self.get_object()
        tag_name_list = request.data

        if not isinstance(tag_name_list, list):
            raise ValidationError('Expected list of tag names')

        instance = self._update_tags(instance, tag_name_list)
        
        return Response(
            EntrySerializer(instance, context=self.get_serializer_context()).data)

class AttachmentViewSet(LoggingMixin, viewsets.GenericViewSet,
                        mixins.CreateModelMixin,
                        mixins.DestroyModelMixin):
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    serializer_class = AttachmentPostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Attachment.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        instance = serializer.save()

        return Response(
            AttachmentSerializer(instance, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """Override to delete actual file, if any"""
        instance = self.get_object()

        if instance.file:
            instance.file.delete()

        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @list_route(methods=['post'])
    def remove(self, request, *args, **kwargs):
        """
        Delete attachments
        Expects a list of attachment ids as request data
        """
        id_list = request.data

        if not isinstance(id_list, list):
            raise ValidationError('Expected list of attachment ids')

        for id in id_list:
            instance = Attachment.objects.get(pk=id)
            if instance.file:
                instance.file.delete()

            instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class EventViewSet(LoggingMixin, viewsets.ViewSet):
    permission_classes = []

    @list_route(methods=['post'])
    def validate_classcode(self, request):
        event_id = request.data['event_id']
        class_code = request.data['class_code']

        event = Event.objects.get(pk=event_id)

        registration = event.registration

        jwt_token = create_jwt_token(registration.id, {
            'forallbackpack_user_id': '',
            'user_id': ''
        })
        url = registration.url_for('verify_event_classcode')

        json_response = post_request(jwt_token, url, {
            'event_id': event_id,
            'class_code': class_code,
        })

        return Response(json_response)

    @list_route(methods=['post'])
    def validate_url(self, request):
        id = request.data['id']
        url = request.data['url']

        try:
            event = Event.objects.get(url=url)
            if id != str(event.id):
                raise APIException("This url is being used by another event.")
        except Event.DoesNotExist:
            pass

        return Response({})

    @list_route(methods=['post'])
    def register(self, request):
        id = request.data['id']
        url = request.data['url']

        if Event.objects.filter(url=url).exclude(pk=id).count():
            raise APIException("This url is being used by another event.")

        try:
            event = Event.objects.get(pk=id)
            event.url = url
            event.name = request.data['name']
            event.description = request.data['description']
            event.role = request.data['role']
            event.header_image = request.data['header_image']
            event.badge_name = request.data['badge_name']
            event.badge_description = request.data['badge_description']
            event.badge_criteria = request.data['badge_criteria']
            event.badge_image = request.data['badge_image']
            event.is_pledge = request.data['is_pledge']
        except:
            event = Event(
                id=id,
                registration=get_registration(request),
                url=url,
                name=request.data['name'],
                description=request.data['description'],
                role=request.data['role'],
                header_image=request.data['header_image'],
                badge_name=request.data['badge_name'],
                badge_description=request.data['badge_description'],
                badge_criteria = request.data['badge_criteria'],
                badge_image=request.data['badge_image'],
                is_pledge = request.data['is_pledge']
            )

        event.save()

        return Response({})

class PledgeViewSet(LoggingMixin, viewsets.GenericViewSet, mixins.UpdateModelMixin):
    permission_classes = [APIPermission]

    def get_queryset(self):
        return Entry.objects.filter(award__isnull=False, award__issued_date__isnull=True)

    def update(self, request, *args, **kwargs):
        """Accept or reject a pledge"""
        instance = self.get_object()

        if request.data.get('id', None):
            handle_award_push(request, request.data, instance.user)

            award = instance.award

            instance.delete()
            award.delete()

        return Response({}, status=status.HTTP_200_OK)
