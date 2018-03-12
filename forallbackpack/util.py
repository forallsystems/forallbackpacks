import time
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.urls import reverse
from django.utils import timezone
import jwt
import requests
from .models import UserEmail


def create_jwt_token(registration, payload_extras=None):
    """Create a JWT token"""
    t = time.time()

    payload = {
        #'exp': t + datetime.timedelta(minutes=15).total_seconds(),
        'nbf': t,
        'iss': t,
        'key': registration.key
    }
    if payload_extras:
        payload.update(payload_extras)

    return jwt.encode(payload, registration.secret, algorithm='HS256')

def post_request(auth_token, url, json_data):
    """Send POST request with Authorization header"""
    try:
        r = requests.post(url, json=json_data, headers={'Authorization': auth_token})

        # Handle error messages from FC
        if r.status_code == 400:
            raise Exception(r.json())

        try:
            r.raise_for_status()
            return r.json()
        except requests.RequestException as re:
            raise Exception("request exception")
    except requests.ConnectionError as ce:
        raise Exception("connection error")

def send_activation_email(request, useremail_id):
    """Send activation email"""
    user_email = UserEmail.objects.get(pk=useremail_id)

    activation_url = request.build_absolute_uri(
        reverse('activate', kwargs={'useremail_id': str(useremail_id)}))

    subject = "Verify Your ForAllBackpacks Account"
    message = "Hi "+user_email.user.first_name+" "+user_email.user.last_name+",\n\n"
    message += "Thank you for creating an account on ForAllBackpacks.  Click the link below to verify your account:\n\n"
    message += activation_url

    # Send email to user
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user_email.email],
        fail_silently=True
    )
    
    # Reset timestamp to extend expiration
    user_email.created_dt = timezone.now()
    user_email.save()
