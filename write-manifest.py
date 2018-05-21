"""
USAGE:
    python write-manifest.py [OPTION] <directory> <output>

DESCRIPTION:
    Write a cache manifest for the files in <directory> to <directory>/<output>,
    where <output> defaults to 'cache.manifest'.
    
OPTIONS:
    -h, --help      Show this help information.
    -e, --exclude   Regex for filenames to exclude from manifest, defaults to:
                    '^(\..+|index.html|cache.manifest)$'
    -v, --version   Manifest version, defaults to seconds since the epoch    
"""
import getopt, glob, re, os, sys, time

def usage(error=None):
    if error:
        print error    
    print __doc__

if __name__ == '__main__':
    try:
        opts, args = getopt.getopt(sys.argv[1:], 'he:v:', ['help', 'exclude=', 'version='])
    except getopt.GetoptError as err:
        usage(str(err))
        sys.exit(2)
        
    exclude = '^(\..+|index.html|cache.manifest)$'  
    version = str(time.time())
    
    for o, a in opts:
        if o in ('-h', '--help'):
            usage()
            sys.exit()
        if o in ('-e', '--exclude'):
            exclude = a
        elif o in ('-v', '--version'):
            version = a
        else:
            assert False, "Unhandled option '%s'" % o
        
    if len(args) < 1 or len(args) > 2:
        usage('Expected 1 or 2 arguments')
        sys.exit(2)
    
    input = os.path.abspath(args[0])
    output = 'cache.manifest'
    
    if len(args) > 1:
        output = os.path.join(input, args[1])
    else:
        output = os.path.join(input, 'cache.manifest')
    
    print 'Writing manifest to %s' % output
    
    re_exclude = re.compile(r'%s' % exclude, re.I)
    
    asset_list = []
    
    for dirpath, dirnames, filenames in os.walk(input):
        for filename in [f for f in filenames if not re_exclude.match(f)]:
            asset_list.append(os.path.relpath(os.path.join(dirpath, filename), input))

    with open(output, 'w') as f:
        f.write('CACHE MANIFEST\n')
        f.write('#'+version+'\n')
        f.write('\n'.join(asset_list))
        f.write('\n\nNETWORK:\n*\n') # allow ajax calls to non-cached resources
        