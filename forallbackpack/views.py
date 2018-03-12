import base64, datetime, hashlib, io, json, os, re, tempfile, time, traceback, urllib, uuid
from urlparse import urlparse, parse_qs
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.views import LoginView
from django.contrib.auth import views as django_auth_views
from django.core.exceptions import ValidationError
from django.core.files import File
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect, resolve_url
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import APIException
import requests
import png
import dropbox
import onedrivesdk
from oauth2client import client
import httplib2
from apiclient.discovery import build
from PIL import Image
from .decorators import logging_decorator
from .forms import CustomAuthenticationForm, ClaimAccountForm, RegistrationForm
from .models import *
from .validation import validate_email
from .util import create_jwt_token, post_request, send_activation_email
from wsgiref.util import FileWrapper
import jwt

def get_image_data_uri(filepath, width=300, height=300):
    """
    Get data URL for thumbnail of image at `filepath` (assumes it is a valid image)
    ex: data:image/png;base64,....
    """
    image = Image.open(filepath)
    image.thumbnail((width, height), Image.ANTIALIAS)

    buffer = io.BytesIO()
    image.save(buffer, format=image.format)

    data_uri = 'data:image/%s;base64,%s' % (
        image.format.lower(),
        base64.b64encode(buffer.getvalue())
    )

    buffer.close()
    image.close()
    return data_uri

class CustomLoginView(LoginView):
    """
    Subclass to use CustomAuthenticationForm and add `register_next` to context
    """
    form_class = CustomAuthenticationForm
    redirect_authenticated_user = True

    def form_valid(self, form):
        if 'CLAIM_FS_BADGE' in self.request.session and self.request.session['CLAIM_FS_BADGE']:
            up = form.get_user().userprofile
            up.is_claimfs = True
            up.save()
            self.request.session['CLAIM_FS_BADGE'] = ''

        if 'CLAIM_RCOE_BADGE' in self.request.session and self.request.session['CLAIM_RCOE_BADGE']:
            up = form.get_user().userprofile
            up.is_claimrcoe = self.request.session['CLAIM_RCOE_BADGE']
            up.save()
            self.request.session['CLAIM_RCOE_BADGE'] = ''

        if 'EVENT_ID' in self.request.session and self.request.session['EVENT_ID']:
            up = form.get_user().userprofile
            up.event_id = self.request.session['EVENT_ID']
            up.event_class_code = self.request.session['EVENT_CLASS_CODE']
            up.save()
            self.request.session['EVENT_ID'] = ''
            self.request.session['EVENT_CLASS_CODE'] = ''

        return super(CustomLoginView, self).form_valid(form)

    def get_success_url(self):
        redirect_to = self.request.POST.get(
            self.redirect_field_name, 
            self.request.GET.get(self.redirect_field_name, None)
        )
        return redirect_to or resolve_url(settings.LOGIN_REDIRECT_URL+'?clear=1')

    def get_register_success_url(self, next):
        params = parse_qs(urlparse(next).query)
        redirect_to = params.get('register_next', [settings.LOGIN_REDIRECT_URL+'?clear=1'])[0]
        return redirect_to

    def get_context_data(self, **kwargs):
        context = super(CustomLoginView, self).get_context_data(**kwargs)
        context.update({
            'register_next': self.get_register_success_url(context.get('next', ''))
        })
        return context

@logging_decorator
def init(request):
    #See if they are claiming a badge
    claimfs = request.GET.get('claimfs', '')
    if claimfs:
        request.session['CLAIM_FS_BADGE'] = claimfs

    claimrcoe = request.GET.get('claimrcoe', '')
    if claimrcoe:
        request.session['CLAIM_RCOE_BADGE'] = claimrcoe

    event_id = request.GET.get('event', '')
    class_code = request.GET.get('class_code', '')
    if event_id:
        logout(request)
        request.session['EVENT_ID'] = event_id
        request.session['EVENT_CLASS_CODE'] = ''
    if class_code:
        request.session['EVENT_CLASS_CODE'] = class_code

    redirect_to = request.GET.get('redirect', '')
    if redirect_to:
        return redirect('/'+redirect_to+'/')

    if request.user.is_authenticated():
        if request.user.is_superuser:
            return redirect('/admin/')

        if 'CLAIM_FS_BADGE' in request.session and request.session['CLAIM_FS_BADGE']:
            up = request.user.userprofile
            up.is_claimfs = True
            up.save()
            request.session['CLAIM_FS_BADGE'] = ''

        if 'CLAIM_RCOE_BADGE' in request.session and request.session['CLAIM_RCOE_BADGE']:
            up = request.user.userprofile
            up.is_claimrcoe = request.session['CLAIM_RCOE_BADGE']
            up.save()
            request.session['CLAIM_RCOE_BADGE'] = ''

        if 'EVENT_ID' in request.session and request.session['EVENT_ID']:
            up = request.user.userprofile
            up.event_id = request.session['EVENT_ID']
            up.event_class_code = request.session['EVENT_CLASS_CODE']
            up.save()
            request.session['EVENT_ID'] = ''
            request.session['EVENT_CLASS_CODE'] = ''

        return redirect(settings.LOGIN_REDIRECT_URL+'?clear=1')
    else:
        return render(request, 'registration/home.html', {})

def validate_account_claim_code(request):
    """
    Validate account claim code with registrant.  If registrant returns email, 
    validate it.  If email address already exists, supply forallbackpack_user_id in 
    returned JSON.
    """
    claim_code = request.POST.get('claim_code', '').strip()
    
    try:
        m = re.match(r'^(.+)_(.+)$', claim_code)
        if not m:
            raise Exception('The Claim Code you entered is invalid.')
        
        registration = Registration.objects.get(prefix=m.group(1))        
        url = registration.url_for('verify_account_claim_code')
              
        r = requests.post(url, json={'account_claim_code': claim_code})
        
        if r.status_code == 400:
            raise Exception(r.content) 
        r.raise_for_status()
        
        json_data = r.json()
        json_data['registration_id'] = str(registration.id)
        json_data['registration_name'] = registration.name
        json_data['forallbackpack_user_id'] = ''
        
        email = json_data.get('email', '')        
        if email:
            try:
                validate_email(email)
            except ValidationError as ve:
                if ve.code == 'email_duplicate':
                    user = None
                    try:
                        user = User.objects.get(Q(username=email) | Q(email=email))
                    except User.DoesNotExist:                            
                        try:
                            UserEmail.objects.get(email=email).user
                        except UserEmail.DoesNotExist:
                            pass
                            
                    if user:
                        json_data['forallbackpack_user_id'] = user.userprofile.id
                        return JsonResponse(json_data)
                    
                    raise Exception(ve.message)
                
                raise Exception('We are unable to claim your account at this time.  '\
                    'The email address provided by your school is invalid.')                
                        
        return JsonResponse(json_data)          
    except Registration.DoesNotExist:
        return HttpResponse(status=400, reason='The Claim Code you entered is invalid.')    
    except (requests.ConnectionError, requests.RequestException):
        return HttpResponse(status=400, reason='')
    except Exception as e:
        return HttpResponse(status=400, reason=str(e))

@logging_decorator
def claim_account(request):
    """Claim and account using a claim code"""
    form = None
    error_list = []

    try:
        logout(request)
    
        if request.method == 'POST':  
            form = ClaimAccountForm(request.POST)
           
            if form.is_valid():
                email = form.cleaned_data['email2']
                
                if form.user:
                    user = form.user
                   
                    # Auto-validate email
                    useremail = user.useremail_set.get(email=email)
                    useremail.is_validated = True
                    useremail.save()
                    
                    primary_useremail = user.useremail_set.filter(is_primary=True).first()
                    if not primary_useremail:
                        # If no primary email, make this one primary
                        useremail.is_primary = True
                        useremail.save()
                        
                        user.email = email
                        user.save()
                    elif not primary_useremail.is_validated:
                        # If primary email not validated, make this primary
                        primary_useremail.is_primary = False
                        primary_useremail.save()
                        
                        useremail.is_primary = True
                        useremail.save()
                else:
                    # Create new account                    
                    user = User.objects.create_user(
                        uuid.uuid4().hex, email, form.cleaned_data.get('password'))
                    user.first_name = form.cleaned_data.get('first_name')
                    user.last_name = form.cleaned_data.get('last_name')
                    user.save()
                           
                    UserEmail.objects.create(
                        user=user, email=email, is_validated=True, is_primary=True)
                   
                    UserProfile.objects.create(user=user)
                    
                # Link account
                registration = Registration.objects.get(pk=form.cleaned_data['registration_id'])
                jwt_token = create_jwt_token(registration)
                url = registration.url_for('claim_account')
                
                r = requests.post(registration.url_for('claim_account'), json={
                    'account_claim_code': form.cleaned_data.get('claim_code'),
                    'forallbackpack_user_id': str(user.userprofile.id),
                    'email': email
                })
                
                if r.status_code == 400:
                    raise Exception(r.content)
                r.raise_for_status()
                
                json_response = r.json()
                
                app_id = json_response['hub_id']
                app_name = json_response['hub_name']
                app_url = json_response['hub_url']
                
                try:
                    UserAccount.objects.get(user=user, registration=registration)
                except UserAccount.DoesNotExist:
                    UserAccount.objects.create(user=user, registration=registration)
               
                try:
                    UserApp.objects.get(user=user, app_url=app_url)
                except UserApp.DoesNotExist:
                    UserApp.objects.create(user=user, app_id=app_id, app_name=app_name, app_url=app_url)

                # Login the user and redirect to home
                login(request, user, 'django.contrib.auth.backends.ModelBackend')
                
                return redirect(settings.LOGIN_REDIRECT_URL+'?clear=1')
        else:
            form = ClaimAccountForm()            
            
    except APIException as err:
        if settings.DEBUG:
            print 'APIException', err.message
        if isinstance(err.detail, list):
            for msg in e.detail:
                form.add_error(None, msg)
        elif isinstance(err.detail, dict):
            for k, v in err.detail.iteritems():
                if isinstance(v, list):
                    for msg in v:
                        form.add_error(None, msg)
                else:   
                    form.add_error(None, v)
        elif err.detail == 'ConnectionError':
            form.add_error(None, 'We are unable to claim your account at this time.  Please contact technical support.')
        else:
            form.add_error(None, err.detail)
    except Exception as e:
        if settings.DEBUG:
            traceback.print_exc()
            print 'Exception', type(e), e
        form.add_error(None, 'We are unable to claim your account at this time.  Please contact technical support.')
    
    return render(request, 'claim_account.html', {
        'form': form,
        'error_list': error_list
    })
        
@logging_decorator
def register(request):
    """Register for an account"""
    if request.user.is_authenticated():
        return redirect(settings.LOGIN_REDIRECT_URL)

    next = request.POST.get('next',
        request.GET.get('next', settings.LOGIN_REDIRECT_URL+'?clear=1'))

    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            username = uuid.uuid4().hex
            password = form.cleaned_data['password1']

            createdFromEvent = False

            # Create user
            user = User.objects.create_user(username, form.cleaned_data['email'], password)
            user.first_name = form.cleaned_data['first_name']
            user.last_name = form.cleaned_data['last_name']
            user.save()

            # Create user profile
            user_profile = UserProfile.objects.create(user=user, phone_number=form.cleaned_data['phone_number'])

            # Create user email record
            user_email = UserEmail.objects.create(user=user, email=form.cleaned_data['email'], is_validated=False, is_primary=True)

            if 'CLAIM_RCOE_BADGE' in request.session and request.session['CLAIM_RCOE_BADGE']:
                user_profile.is_claimrcoe = request.session['CLAIM_RCOE_BADGE']
                user_profile.save()
                request.session['CLAIM_RCOE_BADGE'] = ''

            if 'EVENT_ID' in request.session and request.session['EVENT_ID']:
                user_profile.event_id = request.session['EVENT_ID']
                user_profile.event_class_code = request.session['EVENT_CLASS_CODE'] if 'EVENT_CLASS_CODE' in request.session else ''
                user_profile.save()
                request.session['EVENT_ID'] = ''
                request.session['EVENT_CLASS_CODE'] = ''
                createdFromEvent = True #Auto Verify Email Address
                print "GOT HERE"


            # Log the user in
            new_user = authenticate(request, username=username, password=password)

            login(request, new_user)

            # Add default badges
            this_url = request.build_absolute_uri('/')

            image_path = os.path.join(settings.STATIC_ROOT, 'images', 'purple-star.png')

            award = Award.objects.create(
                user=new_user,
                issued_date='2015-09-01',
                student_name=new_user.get_full_name(),
                student_email=new_user.email,
                org_issued_name="ForAllSystems",
                badge_name="Thank You!",
                badge_description="Thank you for trying out ForAllBackpacks!  If you have any questions, feel free to email us at support@forallbackpacks.com.",
                badge_criteria="Creating a new ForAllBackpacks account.",
                issuer_org_url="http://www.forallsystems.com",
                issuer_org_name="ForAllSystems",
                issuer_org_email="info@forallsystems.com",
                issuer_org_origin="http://www.forallsystems.com"
            )

            award.badge_image.save('thankyou.png', File(open(image_path)))
            award.badge_image_data_uri = get_image_data_uri(image_path)
            award.save()

            image_path = os.path.join(settings.STATIC_ROOT, 'images', 'orange-star.png')

            award = Award.objects.create(
                user=new_user,
                issued_date='2016-06-01',
                student_name=new_user.get_full_name(),
                student_email=new_user.email,
                org_issued_name="ForAllSystems",
                badge_name="Welcome!",
                badge_description="Welcome to ForAllBackpacks!  This is a sample badge to help you explore the various features in ForAllBackpacks.",
                badge_criteria="Creating a new ForAllBackpacks account.",
                issuer_org_url="http://www.forallsystems.com",
                issuer_org_name="ForAllSystems",
                issuer_org_email="info@forallsystems.com",
                issuer_org_origin="http://www.forallsystems.com"
            )

            award.badge_image.save('welcome.png', File(open(image_path)))
            award.badge_image_data_uri = get_image_data_uri(image_path)
            award.save()

            logout(request)

            # Redirect
            return redirect('/sendActivation/'+user_email.id.__str__()+"/")

            #return redirect(next)
    else:
        form = RegistrationForm()

    return render(request, 'registration/register.html', {
        'form': form,
        'next': next
    })

@logging_decorator
def sendActivation(request, useremail_id):
    send_activation_email(request, useremail_id)

    return redirect(
        request.build_absolute_uri(
            reverse('activateSent', kwargs={'useremail_id': useremail_id})
        )
    )

@logging_decorator
def activateSent(request, useremail_id):
    return render(request, 'registration/activateSent.html', {'useremail_id':useremail_id})

@logging_decorator
def activate(request, useremail_id):
    try:
        user_email = UserEmail.objects.get(pk=useremail_id)

        if not user_email.is_validated:
            if timezone.now() > user_email.created_dt + datetime.timedelta(hours=24):
                return render(request, 'registration/activateInvalid.html', {})

            user_email.is_validated = True
            user_email.save()

        user_email.user.backend = 'django.contrib.auth.backends.ModelBackend'
        login(request, user_email.user)

        return render(request, 'registration/activateSuccess.html', {})
    except UserEmail.DoesNotExist:
        return render(request, 'registration/activateInvalid.html', {})

@logging_decorator
def rcoe_presenter(request):
    return render(request, 'rcoeevent/presenter.html', {})

@logging_decorator
def rcoe_participant(request):
    return render(request, 'rcoeevent/participant.html', {})

@logging_decorator
def view_event(request, url):
    try:
        event = Event.objects.get(url=url)
        if event.role == "Student" and event.is_pledge:
            return render(request, 'event/claim_student.html', {'event':event})
        else:
            return render(request, 'event/claim.html', {'event':event})
    except:
        return render(request, 'event/notfound.html', {})

@logging_decorator
@login_required
def dropboxAuthStart(request):
    """
    Begin Dropbox authorization, expects 'ref' and 'id' params
    """
    request.session['DROPBOX_REF'] = request.GET.get('ref', '')
    request.session['DROPBOX_ID'] = request.GET.get('id', '')

    redirect_uri = request.build_absolute_uri(reverse('dropboxAuthComplete'))

    return redirect(DropboxOAuth2Flow(
        settings.DROPBOX_APP_KEY, settings.DROPBOX_APP_SECRET, redirect_uri, request.session,
        "dropbox-auth-csrf-token").start())

@logging_decorator
@login_required
def dropboxAuthComplete(request):
    """
    Complete Dropbox authorization, redirect to referrer with params
    """
    referrer = request.session.get('DROPBOX_REF', '')
    id = request.session.get('DROPBOX_ID', '')

    redirect_uri = request.build_absolute_uri(reverse('dropboxAuthComplete'))

    try:
        oauth_result = DropboxOAuth2Flow(
            settings.DROPBOX_APP_KEY, settings.DROPBOX_APP_SECRET, redirect_uri, request.session,
            "dropbox-auth-csrf-token").finish(request.GET)
        token = oauth_result.access_token

        if token:
            AuthToken.objects.filter(user=request.user, type='Dropbox').delete()
            auth_token = AuthToken(user=request.user, type='Dropbox', token=token)
            auth_token.save()

            return redirect(referrer+'?oa=db&id='+id)
        else:
            return redirect(referrer+'?oa=db&err=1')
    except:
        return redirect(referrer+'?oa=db&err=2')

@logging_decorator
@login_required
def googleDriveAuthStart(request):
    """
    Begin Google Drive authorization, expects 'ref' and 'id' params
    """
    request.session['GOOGLEDRIVE_REF'] = request.GET.get('ref')
    request.session['GOOGLEDRIVE_ID'] = request.GET.get('id', '')

    redirect_uri = request.build_absolute_uri(reverse('googleDriveAuthComplete'))

    flow = client.flow_from_clientsecrets(
            os.path.join(settings.STATIC_ROOT, 'google_client_secret.json'),
            scope='https://www.googleapis.com/auth/drive',
            redirect_uri=redirect_uri)
    flow.params['access_type'] = 'offline'          # offline access

    return redirect(flow.step1_get_authorize_url())

@logging_decorator
@login_required
def googleDriveAuthComplete(request):
    """
    Complete GoogleDrive authorization, redirect to referrer with params
    """
    referrer = request.session.get('GOOGLEDRIVE_REF', '')
    id = request.session.get('GOOGLEDRIVE_ID', '')

    redirect_uri = request.build_absolute_uri(reverse('googleDriveAuthComplete'))

    code = request.GET.get('code','')
    if code:
        # Exchange code for credentials
        flow = client.flow_from_clientsecrets(
                os.path.join(settings.STATIC_ROOT, 'google_client_secret.json'),
                scope='https://www.googleapis.com/auth/drive',
                redirect_uri=redirect_uri)
        flow.params['access_type'] = 'offline'      # offline access

        try:
            credentials = flow.step2_exchange(code)

            AuthToken.objects.filter(user=request.user, type='GoogleDrive').delete()
            auth_token = AuthToken(
                user=request.user,
                type='GoogleDrive',
                token=code,
                credentials=credentials.to_json())
            auth_token.save()

            return redirect(referrer+'?oa=gd&id='+id)
        except Exception as e:
            print 'Error exchanging code for credentials', e
            return redirect(referrer+'?oa=gd&err=1')
    else:
        print 'Expected code'
        return redirect(referrer+'?oa=gd&err=2')

class OneDriveSession(onedrivesdk.session.Session):
    def __init__(self, *args, **kwargs):
        super(OneDriveSession, self).__init__(*args, **kwargs)

    def save_session(self, auth_token=None):
        """Save session state to `AuthToken.credentials`"""
        if not auth_token:
            raise Exception("Expected 'auth_token' to save session")

        json_data = {
            'token_type': self.token_type,
            'expires_at': self._expires_at,
            'scope_string': ' '.join(self.scope),
            'access_token': self.access_token,
            'client_id': self.client_id,
            'auth_server_url': self.auth_server_url,
            'redirect_uri': self.redirect_uri,
            'refresh_token': self.refresh_token,
            'client_secret': self.client_secret
        }

        auth_token.credentials = json.dumps(json_data)
        auth_token.save()

    @staticmethod
    def load_session(auth_token=None):
        """Create Session from from `AuthToken.credentials`"""
        if not auth_token:
            raise Exception("Expected 'auth_token' to load session")

        d = json.loads(auth_token.credentials)

        return OneDriveSession(
            d['token_type'],
            d['expires_at'] - time.time(), # expects interval
            d['scope_string'],
            d['access_token'],
            d['client_id'],
            d['auth_server_url'],
            d['redirect_uri'],
            d['refresh_token'],
            d['client_secret']
        )

def getOneDriveClient():
    http_provider = onedrivesdk.HttpProvider()

    auth_provider = onedrivesdk.AuthProvider(
        http_provider=http_provider,
        client_id=settings.ONEDRIVE_API_CLIENTID,
        scopes=['onedrive.readwrite'],
        session_type=OneDriveSession)

    return onedrivesdk.OneDriveClient(
        'https://api.onedrive.com/v1.0/', auth_provider, http_provider)

@logging_decorator
@login_required
def onedriveAuthStart(request):
    """
    Begin OneDrive authorization, expects 'ref' and 'id' params
    """
    request.session['ONEDRIVE_REF'] = request.GET.get('ref')
    request.session['ONEDRIVE_ID'] = request.GET.get('id', '')

    redirect_uri = request.build_absolute_uri(reverse('onedriveAuthComplete'))

    client = getOneDriveClient()
    return redirect(client.auth_provider.get_auth_url(redirect_uri))

@logging_decorator
@login_required
def onedriveAuthComplete(request):
    """
    Complete OneDrive authorization, redirect to referrer with params
    """
    referrer = request.session.get('ONEDRIVE_REF', '')
    id = request.session.get('ONEDRIVE_ID', '')

    redirect_uri = request.build_absolute_uri(reverse('onedriveAuthComplete'))

    code = request.GET.get('code','')
    if code:

        try:
            client = getOneDriveClient()
            client.auth_provider.authenticate(code, redirect_uri, settings.ONEDRIVE_API_SECRET)

            AuthToken.objects.filter(user=request.user, type='OneDrive').delete()
            auth_token = AuthToken(user=request.user, type='OneDrive', token=code)

            client.auth_provider.save_session(auth_token=auth_token)

            return redirect(referrer+'?oa=od&id='+id)
        except Exception as e:
            print 'Error authenticating code', e
            return redirect(referrer+'?oa=od&err=1')
    else:
        print 'Expected code'
        return redirect(referrer+'?oa=od&err=2')


def sso(request):
    token = request.GET.get('token')

    payload = jwt.decode(token, verify=False)
    try:
        registration = Registration.objects.get(key=payload['key'])
        payload = jwt.decode(token, registration.secret)
        up = UserProfile.objects.get(pk=payload['forallbackpack_user_id'])

        #LOG USER INTO FB
        logout(request)
        up.user.backend = 'django.contrib.auth.backends.ModelBackend'
        django_auth_views.auth_login(request, up.user)
        if request.session.test_cookie_worked():
            request.session.delete_test_cookie()

        for ua in UserApp.objects.filter(app_id=payload['hub_id'], user=up.user_id):
            return redirect(ua.app_url+"relogin/forallbackpack/")

        return redirect("/")

    except:
        return redirect("/")
