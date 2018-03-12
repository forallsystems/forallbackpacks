"""
Make a sample baked SVG badge.  Based on openbadges_bakery.svg_bakery.

Create an Award instance on FB, and then update the ASSERTION_JSON below as follows:
- Replace recipient identity with your hashed email address.
- Replace the UUID with your Award UUID.

Adjust EMAIL, SRC_FILEPATH, and DST_FILEPATH accordingly.
"""
import hashlib, json, os
from xml.dom.minidom import parseString

EMAIL = 'teststudent@fab.com'

m = hashlib.sha256()
m.update(EMAIL+'')
IDENTITY_HASH = 'sha256$'+m.hexdigest()

AWARD_UUID = '2f0bac6f-668e-412d-9d94-cfe2a5b004f1'

ASSERTION_JSON =  {
    '@context': 'https://w3id.org/openbadges/v2',
    'id': 'http://0.0.0.0:5000/assertion/%s/' % AWARD_UUID,
    'issuedOn': '2018-01-01T23:59:59+00:00',
    'revoked': False,
    'type': 'Assertion',
    'recipient': {
        'type': 'email',
        'hashed': True,
        'identity': IDENTITY_HASH
    },
    'verification': {
        'type': 'HostedBadge'
    },
    'badge': {
        '@context': 'https://w3id.org/openbadges/v2',
        'type': 'BadgeClass',
        'id': 'http://0.0.0.0:5000/assertion/%s/badge/' % AWARD_UUID,
        'name': 'My Badge',
        'image': 'http://127.0.0.1/forallbackpack/media/files/badges/badge-image.svg',
        'description': 'This is My Badge description',
        'criteria': {
            'narrative': 'This is My Badge Criteria'
        },
        'issuer': {
            'id': 'http://0.0.0.0:5000/assertion/%s/issuer/' % AWARD_UUID,
            '@context': 'https://w3id.org/openbadges/v2',
            'name': 'ForAllSystems',
            'url': 'http://www.forallsystems.com',
            'type': 'Issuer',
            'email': 'info@forallbackpack.com'
        }
    },
    'evidence': [
        {
            'id': 'http://0.0.0.0:5000/assertion/%s/view/' % AWARD_UUID,
            'name': 'Public Award View',
            'description': 'Webpage of the public award view'
        }
    ]
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SRC_FILEPATH = os.path.join(BASE_DIR, 'badge-image.svg')
DST_FILEPATH = os.path.join(BASE_DIR, 'badge-image-baked.svg')


def _populate_assertion_node(assertion_node, assertion_string, svg_doc):
    print 'assertion_string', assertion_string
    try:
        assertion = json.loads(assertion_string)
    except ValueError:
        assertion = None

    if assertion:
        verify_url = assertion.get('verify', {}).get('url')
        if not verify_url:
            verify_url = assertion.get('id', '')
        
        if verify_url:
            assertion_node.setAttribute('verify', verify_url)

        character_data = svg_doc.createCDATASection(assertion_string)
        assertion_node.appendChild(character_data)
    else:
        assertion_node.setAttribute('verify', assertion_string)

    return assertion_node

def bake_svg(src_file, dst_file, assertion_string):
    """Make assertion string into `src_file` and save to `dst_file`"""   
    svg_doc = parseString(src_file.read())
    src_file.close()

    assertion_node = svg_doc.createElement('openbadges:assertion')
    assertion_node = _populate_assertion_node(assertion_node, assertion_string, svg_doc)

    svg_body = svg_doc.getElementsByTagName('svg')[0]
    svg_body.setAttribute('xmlns:openbadges', "http://openbadges.org")
    svg_body.insertBefore(assertion_node, svg_body.firstChild)

    dst_file.write(svg_doc.toxml('utf-8'))
    dst_file.seek(0)
    return dst_file


def dump_file(filepath):
    print '\nDumping %s\n' % filepath
    with open(filepath, 'rb') as f:
        print f.read()

#
# Main
#

dump_file(SRC_FILEPATH)

with open(SRC_FILEPATH, 'rb') as src:
    with open(DST_FILEPATH, 'wb') as dst:
        bake_svg(src, dst, json.dumps(ASSERTION_JSON))

dump_file(DST_FILEPATH)



