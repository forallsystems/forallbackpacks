"""
ref: versions 0.5, 1.0, 1.1, 2.0:

https://github.com/mozilla/openbadges-backpack/wiki/Assertions/74c4d43f1a3f2db478fdfe2491b5c748ce8a7314
https://github.com/mozilla/openbadges-specification/blob/master/Assertion/latest.md
https://www.imsglobal.org/sites/default/files/Badges/OBv2p0/history/1.1.html
https://www.imsglobal.org/sites/default/files/Badges/OBv2p0/index.html

Using local copy of https://github.com/IMSGlobal/openbadges-validator-core
"""
import base64, io, os, random, re, string, tempfile
from urlparse import urlparse
from django.conf import settings
from pyld import jsonld
import six
from .openbadges.verifier import verifier as ob_verifier
from .openbadges.verifier.openbadges_context import OPENBADGES_CONTEXT_V2_URI
from .openbadges.verifier.tasks import input as ob_input
from .openbadges.verifier.tasks import utils as ob_utils
from .openbadges.verifier.utils import jsonld_no_cache
from .openbadges.verifier.utils import identity_hash
from PIL import Image
import jwt
import requests
from dateutil.parser import parse as parse_datetime
from . import file_util
from pprint import pprint as pp

ALLOW_VERSIONS = ('0.5', '1.0', '1.1', '2.0')

# data:[<mediatype>][;base64],<data>
#
# If omitted, mediatype should be interpreted as 'text/plain'.
#
#   data:,Hello
#   data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D
#   data:text/plain,hello

RE_DATA_URI = re.compile(r'^data:(?P<mediatype>[^\;]*)(;(?P<encoding>base64))?,(?P<data>.*)')

# Options for openbadges.verifier.verify [see verify()]
OB_OPTIONS = {
    'include_original_json': True, # temp
    'use_cache': False,
    'cache_backend': 'memory',
    'cache_expire_after': 300,
    'jsonld_options': jsonld_no_cache
}

class AssertionRevokedException(Exception):
    """Raise when badge has been revoked."""
    pass

def detect_raw_type(raw_content, allowed_types=None):
    """
    Detect type of `raw_content`, optionally subject to `allowed_types`.
    Return tuple of detected value and type.
    ref: openbadges.verifier.tasks.input.detect_input_type()
    """
    detected_value = raw_content
    detected_type = None

    if ob_utils.is_url(raw_content):
        detected_type = 'url'
    elif ob_input.input_is_json(raw_content):
        detected_type = 'json'

        for url_finder in [ob_input.find_id_in_jsonld, ob_input.find_1_0_verify_url]:
            id_url = url_finder(raw_content, OB_OPTIONS.get('jsonld_options'))

            if ob_utils.is_url(id_url):
                detected_value = id_url
                detected_type = 'url'
                break;
    elif ob_input.input_is_jws(raw_content):
        detected_type = 'jws'
    elif isinstance(raw_content, six.string_types) and RE_DATA_URI.match(raw_content):
        detected_type = 'datauri'

    if not detected_type:
        raise Exception('unknown type')

    if allowed_types:
        assert detected_type in allowed_types, 'unhandled type "%s"' % detected_type

    return (detected_value, detected_type)

def detect_type(value, allowed_types=None):
    """
    Detect type of `value`, optionally subject to `allowed_types`.
    Return tuple of detected value and type.
    """
    detected_value = value
    detected_type = None

    if isinstance(value, six.string_types):
        return detect_raw_type(value, allowed_types)

    if isinstance(value, dict):
        detected_type = 'json'

        result = jsonld.compact(
            value, OPENBADGES_CONTEXT_V2_URI, options=OB_OPTIONS.get('jsonld_options')
        )

        id_url = result.get('id','')

        if ob_utils.is_url(id_url):
            detected_value = id_url
            detected_type = 'url'

    if not detected_type:
        raise Exception('unknown type')

    if allowed_types:
        assert detected_type in allowed_types, 'unhandled type "%s"' % detected_type

    return (detected_value, detected_type)

def save_data_uri(data_uri, suffix=''):
    """
    Save data from data_uri to temp file and return (filepath, mediatype).
    """
    if not isinstance(data_uri, six.string_types):
        raise Exception('invalid data URI')

    m = RE_DATA_URI.match(data_uri)
    if not m:
        raise Exception('invalid data URI')

    mediatype = m.group('mediatype') or 'text/plain'
    encoding = m.group('encoding') or None
    data = m.group('data')

    if not suffix:
        suffix = file_util.guess_extension(mediatype) or ''
    (fd, filepath) = tempfile.mkstemp(suffix=suffix)

    with os.fdopen(fd, 'wb') as f:
        if encoding:
            f.write(base64.b64decode(data))
        else:
            f.write(data)

    return (filepath, mediatype)

def fetch_json(url):
    """Fetch JSON at `url`"""
    try:
        r = requests.get(url)
        r.raise_for_status()
        return r.json()
    except requests.ConnectionError:
        raise Exception('connection error')
    except requests.exceptions.HTTPError:
        raise Exception('could not complete request')
    except ValueError:
        raise Exception('invalid response content')

def verify_recipient(recipient, allowed_identity_list):
    """
    `recipient` = v1.0+ IdentityObject
    `identity_list` = list of valid email addresses

    Notes for parsing:

    0.5: `recipient`, `salt` at top-level

    1.0+: `recipient` is IdentityObject
        `type` = 'email'
        `identity` = hash or plaintext value
        'hashed` = bool
        `salt` = if hashed, then the salt, if any (else not salted)
    """
    identity = recipient.get('identity')

    if recipient.get('hashed', False):
        salt = recipient.get('salt', '')

        if identity.startswith('md5'):
            alg = 'md5'
        elif identity.startswith('sha256'):
            alg = 'sha256'
        else:
            raise Exception('unknown hash type')

        for allowed_identity in allowed_identity_list:
            if identity_hash(allowed_identity, salt, alg) == identity:
                return allowed_identity
    else:
        if identity in allowed_identity_list:
            return identity

    return False

def parse_endorsement(content):
    """
    Parse content into list of endorsements
    """
    data_list = []

    if content:
        if isinstance(content, list):
            for item in content:
                data_list.extend(parse_endorsement(item))
        elif isinstance(content, dict):
            endorsement_value, value_type = detect_type(content, ['url', 'json'])

            if value_type == 'url':
                endorsement_value = fetch_json(endorsement_value)

            issuer_value, value_type = detect_type(endorsement_value.get('issuer'), ['url', 'json'])
            if value_type == 'url':
                issuer_value = fetch_json(issuer_value)

            try:
                issued_on = parse_datetime(endorsement_value.get('issuedOn'))\
                    .strftime('%Y-%m-%dT%H:%M:%S%z')
            except Exception as e:
                raise Exception('invalid issuedOn; %s' % str(e))

            issuer_image = issuer_value.get('image', '')
            if issuer_image:
                filepath, content_type = file_util.fetch_image(issuer_image)

                if content_type not in file_util.IMAGE_MIME_TYPES:
                    os.remove(filepath)
                    raise Exception('unhandled image format; %s' % content_type)

                issuer_image = filepath

            data_list.append({
                'issued_on': issued_on,
                'issuer_name': issuer_value.get('name'),
                'issuer_url': issuer_value.get('url'),
                'issuer_email': issuer_value.get('email', ''),
                'issuer_image': issuer_image
            })

    return data_list

def parse_evidence(content):
    """
    Parse content into list of evidence

    1.0: URL to the work or webpage
    1.1: same as 1.0?
    2.0: as follows:

    https://www.imsglobal.org/sites/default/files/Badges/OBv2p0/examples/index.html

    The issuer may provide a text/markdown narrative describing the evidence:
    {
        "@context": "https://w3id.org/openbadges/v2",
        "id": "https://example.org/beths-robotics-badge.json",
        "narrative": "This student invented her own type of robot. This included: \n\n  * Working robot arms\n  * Working robot legs"
    }

    Evidence may be referenced by URI id:
    {
        "@context": "https://w3id.org/openbadges/v2",
        "id": "https://example.org/beths-robotics-badge.json",
        "evidence": "https://example.org/beths-robot-work.html"
    }

    Evidence may be more fully described by using the Evidence class:
    {
        "@context": "https://w3id.org/openbadges/v2",
        "id": "https://example.org/beths-robotics-badge.json",
        "evidence": {
            "id": "https://example.org/beths-robot-work.html",
            "name": "My Robot",
            "description": "A webpage with a photo and a description of the robot the student built for this project.",
            "narrative": "The student worked very hard to assemble and present a robot. She documented the process with photography and text.",
            "genre": "ePortfolio"
        }
    }

    And evidence may be a list of Evidence objects.
    """
    data_list = []

    if content:
        if isinstance(content, list):
            for item in content:
                data_list.extend(parse_evidence(item))
        elif isinstance(content, six.string_types):
            if ob_utils.is_url(content):
                # Save as hyperlink
                data_list.append({
                    'hyperlink': content,
                    'label': '',
                    'description': ''
                })
            else:
                # Save as plain text in description
                data_list.append({
                    'hyperlink': '',
                    'label': '',
                    'description': content
                })
        elif isinstance(content, dict):
            description = content.get('description', '')
            narrative = content.get('narrative', '')

            if description and narrative:
                description = "%s\n\n%s" % (description, narrative)
            elif not description and narrative:
                description = narrative

            # Check for optional custom fields
            data_uri = content.get('schema:contentUrl', '')
            filename = content.get('schema:alternateName', '')

            if data_uri:
                # Get suffix from filename
                _, suffix = os.path.splitext(filename)

                # Save as file
                filepath, content_type = save_data_uri(data_uri, suffix=suffix)

                data_list.append({
                    'hyperlink': '',
                    'label': content.get('name', ''),
                    'description': description,
                    'filepath': filepath,
                    'filename': filename
                })
            else:
                # Save as hyperlink
                data_list.append({
                    'hyperlink': content.get('id', ''),
                    'label': content.get('name', ''),
                    'description': description
                })

    return data_list

def parse_badge_05(badge_json):
    data = {
        'badge_id': badge_json.get('uid', ''),
        'badge_name': badge_json.get('name'),
        'badge_version': badge_json.get('version', ''),
        'badge_description': badge_json.get('description'),
        'badge_criteria': badge_json.get('criteria')
    }

    try:
        filepath, content_type = file_util.fetch_image(badge_json.get('image'))

        if content_type not in [file_util.MIME_TYPE_PNG, file_util.MIME_TYPE_SVG]:
            os.remove(filepath)
            raise Exception('unhandled format "%s"' % content_type)

        data['badge_image'] = filepath
        data['badge_image_raw'] = badge_json.get('image')
    except Exception as e:
        raise Exception('invalid badge image; %s' % str(e))

    try:
        value = badge_json.get('issuer')

        issuer_org_origin = value.get('origin')
        issuer_org_name = value.get('name')

        data['org_issued_name'] = issuer_org_name
        data['issuer_org_url'] = issuer_org_origin
        data['issuer_org_name'] = issuer_org_name
        data['issuer_org_email'] = value.get('contact')
        data['issuer_org_origin'] = issuer_org_origin
    except Exception as e:
        raise Exception('invalid issuer; %s' % str(e))

    return data

def parse_badge_10(badge_json):
    data = {
        'badge_name': badge_json.get('name'),
        'badge_version': badge_json.get('version', ''),
        'badge_description': badge_json.get('description'),
        'badge_criteria': badge_json.get('criteria')
    }

    try:
        value, value_type = detect_type(badge_json.get('image'), ['url', 'datauri'])

        if value_type == 'url':
            filepath, content_type = file_util.fetch_image(value)
        else:
            filepath, content_type = save_data_uri(value)

        if content_type not in [file_util.MIME_TYPE_PNG, file_util.MIME_TYPE_SVG]:
            os.remove(filepath)
            raise Exception('unhandled format "%s"' % content_type)

        data['badge_image'] = filepath
        data['badge_image_raw'] = badge_json.get('image')
    except Exception as e:
        raise Exception('invalid badge image; %s' % str(e))

    try:
        value = fetch_json(badge_json.get('issuer'))

        issuer_org_name = value.get('name')
        issuer_org_url = value.get('url')

        pr = urlparse(issuer_org_url)
        issuer_org_origin = '%s://%s' % (pr.scheme, pr.netloc)

        data['org_issued_name'] = issuer_org_name
        data['issuer_org_url'] = issuer_org_url
        data['issuer_org_name'] = issuer_org_name
        data['issuer_org_email'] = value.get('email', '')
        data['issuer_org_origin'] = issuer_org_origin
    except Exception as e:
        raise Exception('invalid issuer; %s' % str(e))

    return data

def parse_badge_20(badge_json):
    data = {
        'badge_id': badge_json.get('id'),
        'badge_name': badge_json.get('name'),
        'badge_version': '',
        'badge_description': badge_json.get('description')
    }

    try:
        value, value_type = detect_type(badge_json.get('criteria'), ['json', 'url'])

        if value_type == 'json':
            value = value.get('narrative')

        data['badge_criteria'] = value
    except Exception as e:
        raise Exception('invalid badge criteria; %s' % str(e))

    try:
        value, value_type = detect_type(badge_json.get('image'), ['url', 'datauri'])

        if value_type == 'url':
            filepath, content_type = file_util.fetch_image(value)
        else:
            filepath, content_type = save_data_uri(value)

        if content_type not in [file_util.MIME_TYPE_PNG, file_util.MIME_TYPE_SVG]:
            os.remove(filepath)
            raise Exception('unhandled format "%s"' % content_type)

        data['badge_image'] = filepath
        data['badge_image_raw'] = badge_json.get('image')
    except Exception as e:
        raise Exception('invalid badge image; %s' % str(e))

    try:
        value, value_type = detect_type(badge_json.get('issuer'), ['url', 'json'])

        if value_type == 'url':
            value = fetch_json(value)

        issuer_org_url = value.get('url')

        pr = urlparse(issuer_org_url)
        issuer_org_origin = '%s://%s' % (pr.scheme, pr.netloc)

        issuer_org_name = value.get('name')

        data['org_issued_name'] = issuer_org_name
        data['issuer_org_url'] = issuer_org_url
        data['issuer_org_name'] = issuer_org_name
        data['issuer_org_email'] = value.get('email')
        data['issuer_org_origin'] = issuer_org_origin
    except Exception as e:
        raise Exception('invalid issuer; %s' % str(e))

    # == optional fields ==
    try:
        data['endorsements'] = parse_endorsement(
            badge_json.get('endorsement', None)
        )
    except Exception as e:
        raise Exception('invalid endorsement (%s)' % str(e))

    return data

def parse_assertion_05(assertion_json):
    # Re-fetch assertion json if hosted
    verify = assertion_json.get('verify')

    if verify.get('type') == 'hosted':
        try:
            assertion_json = fetch_json(verify.get('url'))
        except Exception as e:
            raise Exception('Unable to retrieve assertion json (%s).' % str(e))

    data = {
        'id': assertion_json.get('uid', ''),
        # Use 1.0+ format
        'recipient': {
            'identity': assertion_json.get('recipient'),
            'hashed': True,
            'salt': assertion_json.get('salt', '')
        }
    }

    verify = assertion_json.get('verify')

    if verify.get('type') == 'hosted':
        data['assertion_url'] = verify.get('url')

    try:
        value = assertion_json.get('badge')
        data.update(parse_badge_05(value))
    except Exception as e:
        raise Exception('Error parsing badge data (%s)' % str(e))

    # == optional fields ==
    try:
        data['evidence'] = parse_evidence(assertion_json.get('evidence', None))
    except Exception as e:
        raise Exception('Error parsing evidence (%s)' % str(e))

    value = assertion_json.get('expires', None)
    if value:
        try:
            value = parse_datetime(value).strftime("%Y-%m-%d")
        except Exception as e:
            raise Exception('Error parsing expiration date (%s)' % str(e))
    data['expiration_date'] = value

    value = assertion_json.get('issuedOn', None)
    if value:
        try:
            data['issued_date'] = parse_datetime(value).strftime("%Y-%m-%d")
        except Exception as e:
            raise Exception('Error parsing issued date (%s)' % str(e))
    data['issued_on'] = value
    return data

def parse_assertion_10(assertion_json):
    # Re-fetch assertion json if hosted
    verify = assertion_json.get('verify')

    if verify.get('type') == 'hosted':
        try:
            assertion_json = fetch_json(verify.get('url'))
        except Exception as e:
            raise Exception('Unable to retrieve assertion json (%s).' % str(e))

    data = {
        'id': assertion_json.get('uid'),
        'recipient': assertion_json.get('recipient')
    }

    verify = assertion_json.get('verify')

    if verify.get('type') == 'hosted':
        data['assertion_url'] = verify.get('url')

    try:
        badge_id = assertion_json.get('badge')
        badge_json = fetch_json(badge_id)

        # 1.1 has badge JSON has id field; default to url for 1.0
        data['badge_id'] = badge_json.get('id', badge_id)
        data.update(parse_badge_10(badge_json))
    except Exception as e:
        raise Exception('Error parsing badge data (%s)' % str(e))

    try:
        data['issued_date'] = parse_datetime(assertion_json.get('issuedOn'))\
            .strftime("%Y-%m-%d")
    except Exception as e:
        raise Exception('Error parsing issued date (%s)' % str(e))

    # == optional fields ==
    try:
        data['evidence'] = parse_evidence(assertion_json.get('evidence', None))
    except Exception as e:
        raise Exception('Error parsing evidence (%s)' % str(e))

    value = assertion_json.get('expires', '')
    if value:
        try:
            value = parse_datetime(value).strftime("%Y-%m-%d")
        except Exception as e:
            raise Exception('Error parsing expiration date (%s)' % str(e))
    data['expiration_date'] = value

    return data

def parse_assertion_11(assertion_json):
    return parse_assertion_10(assertion_json)

def parse_assertion_20(assertion_json):
    # Re-fetch assertion json if hosted
    verify = assertion_json.get('verification', assertion_json.get('verify'))

    if verify.get('type') in ['HostedBadge', 'hosted']:
        try:
            assertion_json = fetch_json(assertion_json.get('id'))
        except Exception as e:
            raise Exception('Unable to retrieve assertion json (%s).' % str(e))

    data = {
        'id': assertion_json.get('uid', assertion_json.get('id')), # uid is deprecated
        'recipient': assertion_json.get('recipient'),
        'endorsements': []
    }

    verify = assertion_json.get('verification', assertion_json.get('verify'))

    if verify.get('type') in ['HostedBadge', 'hosted']:
        data['assertion_url'] = assertion_json.get('id')

    try:
        value, value_type = detect_type(assertion_json.get('badge'), ['url', 'json'])

        if value_type == 'url':
            value = fetch_json(value)

        badge_json = parse_badge_20(value)
        if 'endorsements' in badge_json:
            data['endorsements'].extend(badge_json['endorsements'])
            del badge_json['endorsements']

        data.update(badge_json)
    except Exception as e:
        raise Exception('Error parsing badge data (%s)' % str(e))

    try:
        data['issued_date'] = parse_datetime(assertion_json.get('issuedOn'))\
            .strftime("%Y-%m-%d")
    except Exception as e:
        raise Exception('Error parsing issued date (%s)' % str(e))

    # == optional fields ==
    try:
        data['evidence'] = parse_evidence(
            assertion_json.get('evidence', assertion_json.get('narrative', None))
        )
    except Exception as e:
        raise Exception('Error parsing evidence (%s)' % str(e))

    try:
        data['endorsements'].extend(parse_endorsement(
            assertion_json.get('endorsement', None)
        ))
    except Exception as e:
        raise Exception('Error parsing endorsement (%s)' % str(e))

    value = assertion_json.get('expires', '')
    if value:
        try:
            value = parse_datetime(value).strftime("%Y-%m-%d")
        except Exception as e:
            raise Exception('Error parsing expiration date (%s)' % str(e))
    data['expiration_date'] = value

    return data

def parse(raw_content, version):
    """
    Parse assertion content into flat dict with keys:

        id = <str> (saved to Award.external_id)
        recipient = 1.0-style recipient structure, see verify_recipient(), above
        assertion_url = <str> (if hosted)
        badge_id = <str> or '' (saved to badge_id)
        issued_date = 'YYYY-MM-DD' | ''
        org_issued_name = <string>
        issuer_org_url = <str>
        issuer_org_name = <str>
        issuer_org_email = <str>
        issuer_org_origin = <str>
        badge_version = <str>
        badge_name = <str>
        badge_description = <str>
        badge_criteria = <str>
        badge_image = <str>, temp filepath containing image data
        expiration_date = 'YYYY-MM-DD' | ''
        evidence = [{
            hyperlink = <str>,
            label = <str>,
            description: <str>,
            filepath = <str> (temp filepath containing file data, if available)
            filename = <str> (intended destination filename, if filepath is set)
        }]
        endorsements = [{
            issuer_name = <str>,
            issuer_url = <str> or ''
            issuer_email = <str> or '',
            issuer_image = <str> (URL or temp filepath containing image data, if available)
            issued_on = 'YYY-MM-DDTHH:MM:SS+0000'
        }]

    Caller should add additional fields not available from JSON:

        student_name = <str>, not available in assertion JSON
        student_email = <str>, unhashed version likely not available in JSON

    Caller should separately verify recipient with verify_recipient().
    """
    if settings.DEBUG:
        print 'forallbackpack.assertion.parse()', version

    try:
        value, value_type = detect_raw_type(raw_content, ['url', 'json', 'jws'])

        if value_type == 'url':
            assertion_json = fetch_json(value)
        elif value_type == 'jws':
            assertion_json = json.loads(jwt.decode(raw_content, verify=False))
        else:
            assertion_json = value
    except Exception as e:
        raise Exception('Error processing raw assertion (%s).' % str(e))

    if version == '0.5':
        parsed_data = parse_assertion_05(assertion_json)
    elif version == '1.0':
        parsed_data = parse_assertion_10(assertion_json)
    elif version == '1.1':
        parsed_data = parse_assertion_11(assertion_json)
    elif version == '2.0':
        parsed_data = parse_assertion_20(assertion_json)
    else:
        raise Exception('Unknown assertion version "%s"' % version)

    return parsed_data

def verify(badge_input, recipient_profile=None):
    """
    Verify `badge_input` and return version.
    ref: openbadges.verifier.verify.py
    """
    if settings.DEBUG:
        print 'forallbackpack.assertion.verify()'

    store = ob_verifier.verification_store(badge_input, recipient_profile, options=OB_OPTIONS)
    results = ob_verifier.generate_report(store, options=OB_OPTIONS)

    report = results['report']
    if not report.get('valid', False):
        for message in report['messages']:
            if message['messageLevel'] == 'ERROR':
                if message['name'] == 'VERIFY_HOSTED_ASSERTION_NOT_REVOKED'\
                or message['name'] == 'VERIFY_SIGNED_ASSERTION_NOT_REVOKED':
                    raise AssertionRevokedException(message['result'])

        print '\nRESULTS'
        pp(results)
        raise Exception('Could not verify assertion')

    return report.get('openBadgesVersion')
