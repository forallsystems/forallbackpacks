import re
from django import forms
from django.contrib.auth import authenticate, password_validation
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.urls import reverse
from .models import UserProfile, Registration, UserEmail
from .validation import validate_email, validate_phone_number


class CustomAuthenticationForm(AuthenticationForm):
    """
    Allow login with email or phone number as 'username'
    """
    def clean(self):
        username = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if username is not None and password:
            try:
                user_email = UserEmail.objects.get(email=username)
            except UserEmail.DoesNotExist:
                raise forms.ValidationError(
                    "Your email address and password didn't match.",
                    code='invalid_login',
                    params={'username': 'email address'}
                )

            self.user_cache = authenticate(
                self.request,
                username=user_email.user.username,
                password=password
            )
            if self.user_cache is None:
                raise forms.ValidationError(
                    "Your email address and password didn't match.",
                    code='invalid_login',
                    params={'username': 'email address'},
                )

            if not user_email.is_validated:
                send_activation_url = self.request.build_absolute_uri(
                    reverse('sendActivation', kwargs={'useremail_id': str(user_email.id)}))

                raise forms.ValidationError(
                    "Your email address hasn't been verified.<br/><a href='"+send_activation_url+"' style='text-decoration:underline;'>Click here to re-send the verification email.</a>",
                    code='not_verified',
                )

            self.confirm_login_allowed(self.user_cache)

        return self.cleaned_data

class ClaimAccountForm(forms.Form):
    error_messages = {
        'password_invalid': "Please enter the correct account password.",
        'password_mismatch': "The two password fields didn't match."
    }
        
    claim_code = forms.CharField(required=True, widget=forms.HiddenInput)
    registration_id = forms.CharField(required=True, widget=forms.HiddenInput)
    registration_name = forms.CharField(required=True, widget=forms.HiddenInput)
    id = forms.CharField(required=False, widget=forms.HiddenInput)
    first_name = forms.CharField(required=True, widget=forms.HiddenInput)
    last_name = forms.CharField(required=True, widget=forms.HiddenInput)
    email = forms.CharField(required=False, widget=forms.HiddenInput)
    email2 = forms.EmailField(required=True, max_length=254)
    password = forms.CharField(
        strip=False,
        widget=forms.PasswordInput(),
        help_text=password_validation.password_validators_help_text_html())
    password2 = forms.CharField(
        strip=False,
        widget=forms.PasswordInput(),
        help_text=password_validation.password_validators_help_text_html())

    def __init__(self, *args, **kwargs):
        self.user = None
        super(ClaimAccountForm, self).__init__(*args, **kwargs)
        
    def clean_password2(self):
        password = self.cleaned_data.get("password")
        password2 = self.cleaned_data.get("password2")

        if password and password2 and password != password2:
            raise forms.ValidationError(
                self.error_messages['password_mismatch'],
                code='password_mismatch',
            )

        user = User(
            username=self.cleaned_data.get('username'),
            first_name = self.cleaned_data.get('first_name'),
            last_name = self.cleaned_data.get('last_name'))

        password_validation.validate_password(password2, user)
        return password2
 
    def clean(self):        
        id = self.cleaned_data.get('id')
        
        if id:
            # Authenticate password
            userprofile = UserProfile.objects.get(pk=id)
            self.user = authenticate(
                username=userprofile.user.username, 
                password=self.cleaned_data['password']
            )
            if not self.user or not self.user.is_active:
                raise ValidationError(
                    self.error_messages['password_invalid'], code='password_invalid')
        else:
             # Validate email           
            email2 = self.cleaned_data.get('email2')
            validate_email(email2)

        return self.cleaned_data
 
class RegistrationForm(forms.Form):
    error_messages = {
        'password_mismatch': "The two password fields didn't match."
    }

    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)
    email = forms.EmailField(required=True, max_length=254)
    phone_number = forms.CharField(required=False, max_length=12)
    password1 = forms.CharField(
        strip=False,
        widget=forms.PasswordInput(),
        help_text=password_validation.password_validators_help_text_html())
    password2 = forms.CharField(
        strip=False,
        widget=forms.PasswordInput(),
        help_text=password_validation.password_validators_help_text_html())

    def clean_email(self):
        email = self.cleaned_data.get('email')
        validate_email(email)
        return email

    def clean_phone_number(self):
        phone_number = self.cleaned_data.get('phone_number')

        if phone_number:
            validate_phone_number(phone_number)
        return phone_number

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            raise forms.ValidationError(
                self.error_messages['password_mismatch'],
                code='password_mismatch',
            )

        user = User(
            username=self.cleaned_data.get('username'),
            first_name = self.cleaned_data.get('first_name'),
            last_name = self.cleaned_data.get('last_name'))

        password_validation.validate_password(password2, user)
        return password2
