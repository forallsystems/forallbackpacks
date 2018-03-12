import time
import jwt
from rest_framework import permissions
from forallbackpack.models import Registration


def get_token(request):
    """
    Get JWT token from HTTP headers or query params
    """
    token = request.META.get('HTTP_AUTHORIZATION')
    if not token:
        token = request.GET.get('jwt')
    if not token:
        raise Exception('No JWT token found')
    return token

def get_registration(request):
    """
    Get Registration instance based on JWT token.
    Assumes JWT has already been verified using one of the Permission classes below.
    """
    token = get_token(request)
    payload = jwt.decode(token, verify=False)
    return Registration.objects.get(key=payload['key'])

def create_jwt_token(registration_id, payload_extras=None):
    """
    Create a JWT token for a `Registration`
    """
    try:
        registration = Registration.objects.get(id=registration_id)

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
    except Registration.DoesNotExist:
        raise Exception('Registration does not exist')

class APIPermission(permissions.BasePermission):
    """
    Default API permission allows if authenticated or has valid JWT
    """
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True

        try:
            token = get_token(request)

            # Decode payload without validation to get registration
            payload = jwt.decode(token, verify=False)

            # Lookup registration
            registration = Registration.objects.get(key=payload['key'])

            # Decode payload with validation
            payload = jwt.decode(token, registration.secret, algorithms=['HS256'])

            return True
        except Exception as e:
            return False

class HasForallPermission(APIPermission):
    """
    Allows if has JWT and `Registration.has_forall_permission` = True
    """
    def has_permission(self, request, view):
        try:
            token = get_token(request)

            # Decode payload without validation to get registration
            payload = jwt.decode(token, verify=False)

            # Lookup registration
            registration = Registration.objects.get(key=payload['key'])

            # Decode payload with validation
            payload = jwt.decode(token, registration.secret, algorithms=['HS256'])

            return registration.has_forall_permissions
        except Exception as e:
            return False
