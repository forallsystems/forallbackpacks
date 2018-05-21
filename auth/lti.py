from lti_provider.auth import LTIBackend

class CustomLTIBackend(LTIBackend):
    def create_user(self, request, lti, username):
        return None
