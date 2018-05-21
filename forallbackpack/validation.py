import re
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import validate_email as _validate_email
from django.db.models import Q
from .models import UserEmail


def validate_username(username, user=None):
    if not re.match(r'^[\w.+-]{6,150}$', username):
        raise ValidationError(
            'Username must be at least 6 characters with only numbers, letters, and +/-/_/.',
            code='username_invalid')
                            
    try:
        found_user = User.objects.get(username=username)
        if found_user != user:
            raise ValidationError(
                'A user with this username already exists.',
                code='username_duplicate')
    except User.DoesNotExist:
        pass        
        
def validate_email(email, user=None):
    """Require unique email address"""
    try:
        _validate_email(email)            
    except ValidationError:
        raise ValidationError(
            'You must enter a valid email address',
            code='email_invalid')
     
    try:
        User.objects.get(Q(username=email) | Q(email=email))
        raise ValidationError(
            'A user with this email address already exists',
            code='email_duplicate')        
    except User.DoesNotExist:
        pass    
    
    try:
        UserEmail.objects.get(email=email)
        raise ValidationError(
            'A user with this email address already exists',
            code='email_duplicate')      
    except UserEmail.DoesNotExist:
        pass  
        

def validate_phone_number(phone_number, user=None):
    """Require unique phone number"""
    try:
        if re.match(r'^\d{3}-\d{3}-\d{4}$', phone_number):
            User.objects.get(userprofile__phone_number=phone_number) 
            raise ValidationError(
                'A user with this phone number already exists',
                code='phone_number_duplicate'
            )
        else:
            raise ValidationError(
                'Phone number must be in xxx-xxx-xxxx format',
                code='phone_number_invalid'
            )
    except User.DoesNotExist:
        pass        

        
class UpperAndNumberPasswordValidator(object):
    """
    Validate whether the password contains as uppercase character and and a number

    Note: Add this to `settings.AUTH_PASSWORD_VALIDATORS`
    """
    msg = 'Your password must contain an uppercase letter and a number'

    def validate(self, password, user=None):
        if not re.search(r'[A-Z]+', password) or not re.search(r'\d+', password):
            raise ValidationError(
                self.msg,
                code='password_upper_and_number',
            )

    def get_help_text(self):
        return self.msg
