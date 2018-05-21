from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect, resolve_url
from django.contrib.auth import logout
from django.conf import settings
from django.utils import timezone
from .views import CustomLoginView
from forallbackpack import assertion  as fb_assertion
from api import views as api_views
from .openbadges.verifier import verifier as ob_verifier
from pprint import pprint as pp
from forallbackpack.models import *
import sys, traceback

class IssuerJSCustomLoginView(CustomLoginView):
    template_name = 'issuerjs/login.html'

    def get_success_url(self):
        return "/issuerjs/confirm/"

    def get_context_data(self, **kwargs):
        context = super(IssuerJSCustomLoginView, self).get_context_data(**kwargs)
        context.update({
            'embed': True
        })
        return context

def init(request):
    #Put assertion URLs in session
    assertions = request.GET.get('assertions','')
    embed = int(request.GET.get('embed','1'))
    assertionList = []
    if assertions:
        assertionList = assertions.split(",")

    request.session['ASSSERTION_LIST'] = assertionList
    request.session['EMBED'] = embed

    return redirect("/issuerjs/login/")

def custom_logout(request):
    assertionList = request.session['ASSSERTION_LIST']
    embed = request.session['EMBED']
    logout(request)
    request.session['ASSSERTION_LIST'] = assertionList
    request.session['EMBED'] = embed
    return redirect("/issuerjs/login/")

def confirm(request):
    #check if logged in TODO
    return render(request, 'issuerjs/confirm.html', {'embed':True if request.session['EMBED'] else False})

def verify(request):
    email_list = UserEmail.objects.filter(user=request.user, is_validated=True)\
        .values_list('email', flat=True)

    #Validate assertions
    assertionData = []

    try:
        for a in request.session['ASSSERTION_LIST']:
            a = a.strip()
            store = ob_verifier.verification_store(a, None, options=fb_assertion.OB_OPTIONS)
            results = ob_verifier.generate_report(store, options=fb_assertion.OB_OPTIONS)

            report = results['report']

            if not report.get('valid', False):
                for message in report['messages']:
                    if message['messageLevel'] == 'ERROR':
                        if message['name'] == 'VERIFY_HOSTED_ASSERTION_NOT_REVOKED'\
                        or message['name'] == 'VERIFY_SIGNED_ASSERTION_NOT_REVOKED':
                            raise AssertionRevokedException(message['result'])

                if settings.DEBUG:
                    print '\nRESULTS'
                    pp(results)
                raise Exception('Could not verify assertion')

            assertion_version = report.get('openBadgesVersion')

            # Parse content
            try:
                parsed_data = fb_assertion.parse(a, assertion_version)
            except Exception as e:
                if settings.DEBUG:
                    traceback.print_exc()
                raise Exception(e.message)

            # Verify this user is the recipient
            try:
                student_email = fb_assertion.verify_recipient(parsed_data.get('recipient'), email_list)
            except Exception as e:
                raise Exception('Could not verify recipient')

            if not student_email:
                raise Exception(
                    'The recipient for this badge does not match any verified email address on your account.'
                )

            parsed_data['student_email'] = student_email
            parsed_data['student_name'] = request.user.get_full_name()


            assertionData.append(parsed_data)

    except Exception as e:
        return render(request, 'issuerjs/verify_error.html', {'error':str(e),'embed':True if request.session['EMBED'] else False})

    request.session['ASSSERTION_DATA'] = assertionData
    return redirect("/issuerjs/accept/")

def accept(request):
    badgeList = []
    for parsed_data in request.session['ASSSERTION_DATA']:
        badgeList.append({'badge_image':parsed_data.get('badge_image_raw'),
                        'badge_name':parsed_data.get('badge_name'),
                        'badge_description':parsed_data.get('badge_description'),
                        'badge_criteria':parsed_data.get('badge_criteria'),
                        'issuer_org_name':parsed_data.get('issuer_org_name'),
                        'issuer_org_url':parsed_data.get('issuer_org_url'),
                        'student_email':parsed_data.get('student_email')
                        })


    return render(request, 'issuerjs/accept.html', {'badgeList':badgeList,'embed':True if request.session['EMBED'] else False})

def save(request):
    #Save badges
    for parsed_data in request.session['ASSSERTION_DATA']:
        parsed_data['verified_dt'] = timezone.now()
        if not parsed_data['issuer_org_email']:
            parsed_data['issuer_org_email'] = ''
        award = api_views.handle_award_push(request, parsed_data)

    return render(request, 'issuerjs/success.html', {'embed':True if request.session['EMBED'] else False})

def cancel(request):
    return render(request, 'issuerjs/fail.html', {'embed':True if request.session['EMBED'] else False})
