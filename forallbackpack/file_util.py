"""
File-related utilities
"""
import base64, io, mimetypes, os, shutil, tempfile, traceback
import requests
from PIL import Image
from svglib.svglib import svg2rlg

MIME_TYPE_PNG = 'image/png'
MIME_TYPE_SVG = 'image/svg+xml'

IMAGE_MIME_TYPES = [MIME_TYPE_PNG, MIME_TYPE_SVG, 'image/gif', 'image/jpeg']

def guess_extension(mime_type, default=''):
    """
    Return file extension for `mime_type`.
    """
    if mime_type == 'image/jpeg':
        ext = '.jpg'    # avoid '.jpe'
    elif mime_type == 'image/svg+xml':
        ext = '.svg'    # avoid '.svgz'
    elif mime_type == 'text/plain':
        ext = '.txt'    # avoid '.conf'
    else:        
        mimetypes.init()
        ext = mimetypes.guess_extension(mime_type)
    
    return ext or default

def fetch_file(file_input, suffix=''):
    """
    Save `file_input` to temporary file and return (filepath, content-type).
    `file_input` = url or streamed request.
    If `suffix` not specified, will be determined from content-type header.
    """    
    if hasattr(file_input, 'iter_content'):
        r = file_input
    else:        
        r = requests.get(file_input, stream=True)

    if r.status_code != requests.codes.ok:
        raise Exception("could not retrieve '%s'" % url)

    content_type = r.headers.get('content-type')  
    if content_type:  
        suffix = guess_extension(content_type) or suffix

    (fd, filepath) = tempfile.mkstemp(suffix=suffix)

    with os.fdopen(fd, 'wb') as f:
        for chunk in r.iter_content(chunk_size=128):
            f.write(chunk)

    return (filepath, content_type)

def fetch_image(file_input):
    """
    Save `file_input` to temporary file and return (filepath, content-type).
    `file_input` = url or streamed request.
    """
    filepath, content_type = fetch_file(file_input)
    
    if content_type not in IMAGE_MIME_TYPES:
        try:
            image = Image.open(filepath)
            content_type = 'image/%s' % image.format.lower()
            image.close()
        except IOError:
            try:
                drawing = svg2rlg(filepath)
                content_type = MIME_TYPE_SVG
            except:
                pass
            
        if content_type:
            # Rewrite with proper file extension
            old_filepath = filepath            
            suffix = guess_extension(content_type)            
            (fd, filepath) = tempfile.mkstemp(suffix=suffix)
            
            with os.fdopen(fd, 'wb') as f_dst:
                with open(old_filepath, 'rb') as f_src:
                    f_dst.write(f_src.read())
            
            os.remove(old_filepath)

    return (filepath, content_type)
  
def make_image_data_uri(filepath, resize_to=None):
    """
    Get data URL for thumbnail of image at `filepath` (assumes it is a valid image)
    """    
    try:
        image = Image.open(filepath)
        image_format = image.format
        
        if resize_to:
            image.thumbnail(resize_to, Image.ANTIALIAS)
        
        buffer = io.BytesIO()
        image.save(buffer, format=image_format)
      
        data_uri = 'data:image/%s;base64,%s' % (
            image_format.lower(),
            base64.b64encode(buffer.getvalue())
        )
        
        buffer.close()
        image.close()
    except IOError:   
        try:    
            drawing = svg2rlg(filepath)
        
            with open(filepath, 'rb') as f:
                data = f.read()
        
            data_uri = 'data:%s;base64,%s' % (
                MIME_TYPE_SVG,
                base64.b64encode(data)
            )    
        except:
            traceback.print_exc()
            raise Exception('unknown image format')  
    
    return data_uri
