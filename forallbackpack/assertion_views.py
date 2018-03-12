import base64, hashlib, io, json, mimetypes, os, re, tempfile
from urlparse import urljoin, urlparse
from xml.dom.minidom import parseString
from wsgiref.util import FileWrapper
from django.conf import settings
from django.forms.models import model_to_dict
from django.http import HttpResponse, Http404, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.clickjacking import xframe_options_exempt
from openbadges_bakery import png_bakery
import png
import requests
from . import file_util
from .decorators import logging_decorator
from .models import Award, Evidence, Entry, Section, Attachment, Share


def truncate(s, max_len=256):
    if len(s) > max_len:
        return '%s...' % s
    
    return s

def make_data_uri(file_input, mediatype):
    """
    Return data URI with base64 encoding for `file_input`.
    `file_input` = filepath, url, or streamed request
    """
    if hasattr(file_input, 'iter_content'):
        buffer = io.BytesIO()
        for chunk in r.iter_content(chunk_size=128):
            buffer.write(chunk)
    elif re.match(r'https?://.+', file_input, re.I):
        r = requests.get(file_input, stream=True)
        buffer = io.BytesIO()
        for chunk in r.iter_content(chunk_size=128):
            buffer.write(chunk)
    else:
        with open(file_input, 'rb') as f:
            buffer = io.BytesIO()
            buffer.write(f.read())
    
    data_uri = 'data:%s;base64,%s' % (mediatype, base64.b64encode(buffer.getvalue()))
    
    buffer.close()
    return data_uri

def _populate_assertion_node(assertion_node, assertion_string, svg_doc):
    """
    Based on openbadges_bakery.svg_bakery
    """
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

def _bake_svg(src_file, assertion_string, dst_file):
    """
    Bake assertion string into `src_file` and save to `dst_file`,
    Based on openbadges_bakery.svg_bakery.
    """   
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
  
def get_assertion_issuer_json(request, award, version):
    """Return assertion issuer JSON"""
    award_id = str(award.id)
    
    if award.assertion_url:
        # External hosting
        issuer_url = award.issuer_org_url
    else:
        # Internal hosting
        issuer_url = request.build_absolute_uri(
            reverse('viewAssertionIssuer', kwargs={'award_id':award_id})
        )
    
        if version != '2.0':
            issuer_url += '?v='+version
        
    if version == '0.5':
        return {
            'url': award.issuer_org_url,
            'name': award.issuer_org_name,
            'origin': award.issuer_org_origin
        }
    elif version == '1.0':
        return {
            'name': award.issuer_org_name,
            'url': award.issuer_org_url
        }   
    elif version == '1.1':
        return {
            '@context': 'https://w3id.org/openbadges/v1',
            'type': 'Issuer',
            'id': issuer_url,
            'name': award.issuer_org_name,
            'url': award.issuer_org_url
        }  
    elif version == '2.0':
         return {
            '@context': 'https://w3id.org/openbadges/v2',
            'type': 'Issuer',
            'id': issuer_url,
            'name': award.issuer_org_name,
            'url': award.issuer_org_url,
            'email': award.issuer_org_email or 'info@forallbackpacks.com'
        }  
    
    raise Exception('Invalid version "%s"' % version)
                         
def get_assertion_badge_json(request, award, version):
    """Return assertion badge JSON"""
    award_id = str(award.id)

    if award.assertion_url:
        # External hosting
        badge_url = urljoin(award.assertion_url, 'view/')
        issuer_url = request.build_absolute_uri(
            reverse('viewAssertionIssuer', kwargs={'award_id':award_id})
        )    
        public_url = urljoin(award.assertion_url, 'view/')
    else:
        # Internal hosting
        badge_url = request.build_absolute_uri(
            reverse('viewAssertionBadge', kwargs={'award_id':award_id})
        )
        issuer_url = request.build_absolute_uri(
            reverse('viewAssertionIssuer', kwargs={'award_id':award_id})
        )    
        public_url = request.build_absolute_uri(
            reverse('viewBadge', kwargs={'award_id':award_id})
        )
    
        if version != '2.0':
            badge_url += '?v='+version
            issuer_url += '?v='+version 

    if version == '0.5':
        return {
            'uid': award.badge_id,
            'name': award.badge_name,
            'image': award.badge_image.url,
            'description': truncate(award.badge_description),
        # Criteria URL
            'criteria': public_url,
            'description_text': award.badge_description,
            'critera_text': award.badge_criteria,
        # Embed issuer
            'issuer': get_assertion_issuer_json(request, award, version)
        }        
    elif version == '1.0':
        return {
            'name': award.badge_name,
            'description': truncate(award.badge_description),
            'image': award.badge_image.url,
        # Criteria URL
            'criteria': public_url,
        # Issuer URL
            'issuer': issuer_url
        }
    elif version == '1.1':
        return {
            '@context': 'https://w3id.org/openbadges/v1',
            'type': 'BadgeClass',
            'id': badge_url,
            'name': award.badge_name,
            'description': truncate(award.badge_description),
            'image': award.badge_image.url,
        # Criteria URL
            'criteria': public_url,
        # Issuer URL
            'issuer': issuer_url
        }     
    elif version == '2.0':
        return {
            '@context': 'https://w3id.org/openbadges/v2',
            'id': badge_url,
            'type': 'BadgeClass',
            'name': award.badge_name,
            'description': award.badge_description,
            'image': award.badge_image.url,
        # Embed criteria
            'criteria': {
                'narrative': award.badge_criteria
            },
        # Embed Issuer
            'issuer': get_assertion_issuer_json(request, award, version)
        }   
    
    raise Exception('Invalid version "%s"' % version)
   
def get_assertion_json(request, award, version):
    """Return assertion JSON"""    
    award_id = str(award.id)

    m = hashlib.sha256()
    m.update(award.student_email+'')
    identity_hash = 'sha256$'+m.hexdigest()
    
    if award.assertion_url:
        # External hosting
        assertion_url = award.assertion_url
        badge_url = urljoin(assertion_url, 'view/')
        public_url = urljoin(assertion_url, 'view/')
    else:
        # Internal hosting
        assertion_url = request.build_absolute_uri(
            reverse('viewAssertion', kwargs={'award_id':award_id})
        )
        badge_url = request.build_absolute_uri(
            reverse('viewAssertionBadge', kwargs={'award_id':award_id})
        )
        public_url = request.build_absolute_uri(
            reverse('viewBadge', kwargs={'award_id':award_id})
        )
        
        if version != '2.0':
            assertion_url += '?v='+version
            badge_url += '?v='+version

    if version == '0.5':
        assertion = {
            'uid': award_id,
            'recipient': identity_hash,
            '_originalRecipient': {
                'type': 'email',
                'hashed': True,
                'identity': identity_hash,
            },
            'issuedOn': award.issued_date.strftime("%Y-%m-%d"),
            'image': award.badge_image.url,
        # Embed badge
            'badge': get_assertion_badge_json(request, award, version),
            'verify': {
                'type': 'hosted',
                'url': assertion_url
            }
        }
    elif version == '1.0':
        assertion = {
            'uid': award_id,
            'recipient': {
                'type': 'email',
                'identity': identity_hash,
                'hashed': True
            },  
        # Badge URL              
            'badge': badge_url,
            'verify': {
                'type': 'hosted',
                'url': assertion_url
            },
            'issuedOn': award.issued_date.strftime("%Y-%m-%d"),
            'image': award.badge_image.url
        }
    elif version == '1.1':
        assertion = {
            '@context': 'https://w3id.org/openbadges/v1',
            'type': 'Assertion',
            'id': assertion_url,
            'uid': award_id,
            'recipient': {
                'type': 'email',
                'identity': identity_hash,
                'hashed': True
            },
        # Badge URL
            'badge': badge_url,
            'verify': {
                'type': 'hosted',
                'url': assertion_url
            },
            'issuedOn': award.issued_date.strftime("%Y-%m-%d"),
            'image': award.badge_image.url
        }   
    elif version == '2.0':         
        assertion = {
            '@context': 'https://w3id.org/openbadges/v2',
            'type': 'Assertion',
            'revoked': False,
            'id': assertion_url,
            'uid': award_id, # deprecated
            'recipient': {
                'type': 'email',
                'hashed': True,
                'identity': identity_hash,
             },
             'issuedOn': award.issued_date.strftime('%Y-%m-%d')+'T23:59:59+00:00',
             'verification': {
                'type': 'HostedBadge'
              },
        # Embed badge
              'badge':  get_assertion_badge_json(request, award, version),
        }
    else:
        raise Exception('Invalid version "%s"' % version)
    
    # Build evidence
    if version == '2.0':   
        evidence = []
        
        for ev in award.evidence_set.all():
            if ev.file:
                file_url = ev.file.url
                mimetype = mimetypes.guess_type(file_url)[0]
                
                if mimetype:
                    evidence.append({
                        'id': file_url,
                        'name': ev.label,
                        'description': ev.description,
                        'schema:alternateName': os.path.basename(file_url),
                        'schema:contentUrl': make_data_uri(file_url, mimetype) 
                    })
                else:
                    evidence.append({
                        'id': file_url,
                        'name': ev.label,
                        'description': ev.description                    
                    })
            else:               
                evidence.append({
                    'id': ev.hyperlink or public_url,
                    'name': ev.label,
                    'description': ev.description
                })
    else:
        evidence = None
        
        # Link directly to evidence, if possible
        n_evidence = award.evidence_set.count() 
        
        if n_evidence == 1:
            ev = award.evidence_set.first()
            if ev.file:
                assertion['evidence'] = ev.file.url
            elif ev.hyperlink:
                assertion['evidence'] = ev.hyperlink
        elif n_evidence > 1:
            assertion['evidence'] = public_url
    
    if evidence:
        assertion['evidence'] = evidence
        
    if award.expiration_date:
        assertion['expires'] = award.expiration_date.isoformat()
              
    return assertion

def get_award(award_id):
    """Allow if award is not deleted or attached to un-deleted attachment"""
    award = Award.objects.get(pk=award_id)

    if award.is_deleted and not award.attachments.filter(is_deleted=False).first():
        raise Http404()
        
    return award
    
def get_award_logo(request, award):
    try:
        r = requests.get(urljoin(award.assertion_url, 'details/'))
        r.raise_for_status()
    
        response_json = r.json()
        return response_json.get('primary_logo', None)
    except:
        return None
 
@logging_decorator
def view_assertion_issuer(request, award_id):
    """Return assertion issuer JSON"""
    try:
        award = Award.objects.get(pk=award_id)
        version = request.GET.get('v', '2.0')
        json_data = get_assertion_issuer_json(request, award, version)
        return JsonResponse(json_data)
    except Award.DoesNotExist:
        raise Http404()
    except Exception as e:
        return HttpResponse(status=400, reason=str(e))
          
@logging_decorator
def view_assertion_badge(request, award_id):
    """Return assertion badge JSON"""
    try:
        award = Award.objects.get(pk=award_id)
        version = request.GET.get('v', '2.0')
        json_data = get_assertion_badge_json(request, award, version)
        return JsonResponse(json_data)
    except Award.DoesNotExist:
        raise Http404()
    except Exception as e:
        return HttpResponse(status=400, reason=str(e))
               
@logging_decorator
def view_assertion(request, award_id):
    """Return assertion JSON"""
    try:
        award = Award.objects.get(pk=award_id)
        version = request.GET.get('v', '2.0')
        json_data = get_assertion_json(request, award, version)
        return JsonResponse(json_data)
    except Award.DoesNotExist:
        raise Http404()
    except Exception as e:
        return HttpResponse(status=400, reason=str(e))

@logging_decorator
def download_badge(request, award_id):    
    try:
        award = get_award(award_id)
        version = request.GET.get('v', '2.0')
                     
        # Fetch copy of badge image to tempfile
        temp_filepath, content_type = file_util.fetch_image(award.badge_image.url)

        if content_type == file_util.MIME_TYPE_PNG:
            suffix = 'png'
        else:
            suffix = 'svg'

        baked_filename, ext = os.path.splitext(os.path.basename(award.badge_image.url))
        baked_filename = '%s_baked%s.%s' % (baked_filename, award.id, suffix)
            
        baked_filepath = os.path.join(settings.LOCAL_MEDIA_ROOT, baked_filename)

        assertion_string = json.dumps(get_assertion_json(request, award, version))

        # Bake it
        with open(temp_filepath, 'rb') as src:
            with open(baked_filepath, 'wb') as dst:
                if content_type == file_util.MIME_TYPE_PNG:
                    png_bakery.bake(src, assertion_string, dst)
                else:
                    _bake_svg(src, assertion_string, dst)

        # Delete tempfile
        os.remove(temp_filepath)

        # Return image as attachment
        response_filename = '%s_%s.%s' % (
            award.badge_name.replace(' ', '_'), award.issued_date.isoformat(), suffix)

        wrapper = FileWrapper(file(baked_filepath))
        response = HttpResponse(wrapper, content_type=content_type)
        response['Content-Disposition'] = 'attachment; filename='+response_filename
        return response
    except Award.DoesNotExist:
        raise Http404()
    #except Exception as e:
    #    return HttpResponse(status=400, reason=str(e))

@logging_decorator
def view_badge(request, award_id):
    try:        
        award = get_award(award_id)
        award_data = model_to_dict(award)
        award_data['badge_image'] = award.badge_image.url
        return render(request, "public_award_details.html", {'award': award_data})
    except Award.DoesNotExist:
        raise Http404()

@logging_decorator
@xframe_options_exempt
def view_share(request, share_id):
    try:
        share = Share.objects.get(pk=share_id, is_deleted=False)
    except:
        return render(request, "public_share_details_not_valid.html")

    embed = request.GET.get('embed', None)
    if embed == '0':
        embed = None

    if isinstance(share.content_object, Award):        
        award = share.content_object
        award_data = model_to_dict(award)
        award_data['badge_image'] = award.badge_image.url

        evidence_list = []
        for e in Evidence.objects.filter(award=award).order_by('created_date'):
            data = model_to_dict(e)
            data['file'] = e.file.url if e.file else None
            evidence_list.append(data)

        award_data['evidence'] = evidence_list

        primary_logo = get_award_logo(request, award)

        return render(request, "public_award_details.html", {
            'award': award_data,
            'embed': embed,
            'primary_logo': primary_logo
        })

    if isinstance(share.content_object, Entry):
        entry = share.content_object
        entry_data = model_to_dict(share)

        first_section = entry.sections.first()
        entry_data['title'] = first_section.title
        entry_data['text'] = first_section.text

        section_list = []
        for section in entry.sections.order_by('created_dt'):
            section_data = model_to_dict(section)
            section_data['created_dt'] = section.created_dt

            attachment_list = []
            for attachment in section.attachments.order_by('created_dt'):
                attachment_data = model_to_dict(attachment)

                attachment_data['file'] = attachment.file.url if attachment.file else None

                if attachment.award:
                    award = attachment.award

                    award_data = model_to_dict(award)
                    award_data['view_url'] = request.build_absolute_uri(
                        reverse('viewBadge', kwargs={'award_id': str(award.id)}))
                    attachment_data['award'] = award_data
                elif attachment.hyperlink:
                    attachment_data['icon'] = 'fa-file-o'
                else:
                    label = attachment.label.lower()

                    if re.search('\.(gif|jpeg|jpg|png)', label):
                        attachment_data['image_url'] = attachment_data['file']
                    elif re.search('\.pdf$', label):
                        attachment_data['icon'] = 'fa-file-pdf-o'
                    elif re.search('\.(zip|gzip|gz|sit|sitx|tar|tgz)$', label):
                        attachment_data['icon'] = 'fa-file-zip-o'
                    elif re.search('\.(doc|docx|docm)$', label):
                        attachment_data['icon'] = 'fa-file-word-o'
                    elif re.search('\.(ppt|pptx|pptm)$', label):
                        attachment_data['icon'] = 'fa-file-powerpoint-o'
                    elif re.search('\.(xlsx|xlsm|xltx|xltm)$', label):
                        attachment_data['icon'] = 'fa-file-excel-o'
                    elif re.search('\.(aac|m4a|mp3|ogg|wav|wma)$', label):
                        attachment_data['icon'] = 'fa-file-audio-o'
                    elif re.search('\.(avi|flv|mov|mp4|mpeg|wmv)$', label):
                        attachment_data['icon'] = 'fa-file-video-o'
                    else:
                        attachment_data['icon'] = 'fa-file-o'

                attachment_list.append(attachment_data)

            section_data['attachments'] = attachment_list
            section_list.append(section_data)

        entry_data['sections'] = section_list

        return render(request, "public_entry_details.html", {
            'meta_image': urljoin(settings.LOGIN_REDIRECT_URL, 'img/ePortfolioPinterestImage.png'),
            'entry': entry_data,
            'embed': embed,
            'award': True
        })

    raise Http404('Unknown share type')
