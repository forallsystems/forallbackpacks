import React from 'react'
import {Popover, Overlay} from 'react-bootstrap';
import moment from 'moment';
import * as constants from '../constants';


export function parseQueryString(qs) {
    var parsedParameters = {};
    var queryString = qs || location.search;

    if(queryString.length) {
        var uriParameters = queryString.substr(1).split('&');

        for(var i = 0; i < uriParameters.length; i++) {
            var parameter = uriParameters[i].split('=');
            parsedParameters[parameter[0]] = decodeURIComponent(parameter[1]);
        }
    }

    return parsedParameters;
}

export function dispatchCustomEvent(eventType, detail) {
    var event = new CustomEvent('build', {'detail': detail});
    event.initEvent(eventType, true, true);
    document.dispatchEvent(event);
}

export function getAttachmentIcon(url, label, height, clsName) {
    var label = label.toLowerCase();

    if(/\.(gif|jpeg|jpg|png)$/.test(label)) {
        return (
            <img src={url} height={height} />
        );
    }
    if(/\.(pdf)$/.test(label) || label == 'certificate') {
        return (
            <i className={"fa fa-file-pdf-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(zip|gzip|gz|sit|sitx|tar|tgz)$/.test(label)) {
        return (
            <i className={"fa fa-file-zip-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(doc|docx|docm)$/.test(label)) {
        return (
            <i className={"fa fa-file-word-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(ppt|pptx|pptm)$/.test(label)) {
        return (
            <i className={"fa fa-file-powerpoint-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(xlsx|xlsm|xltx|xltm)$/.test(label)) {
        return (
            <i className={"fa fa-file-excel-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(aac|m4a|mp3|ogg|wav|wma)$/.test(label)) {
        return (
            <i className={"fa fa-file-audio-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(avi|flv|mov|mp4|mpeg|wmv)$/.test(label)) {
        return (
            <i className={"fa fa-file-video-o "+clsName} aria-hidden="true"></i>
        );
    }
    return (
        <i className={"fa fa-file-o "+clsName} aria-hidden="true"></i>
    );
}

// Compose share warning for trash item confirmation
export function getShareWarning(itemType, itemShareList, shareMap) {
    var shareList = [];
    var shareWarning = '';

    itemShareList.map(function(shareId) {
        var share = shareMap.get(shareId);
        
        if(!share.get('is_deleted')) { 
            shareList.push(constants.SHARE_TYPE_NAME[share.get('type')]);
        } 
    }, this);

    if(shareList.length) {
        var shareListText = '';
        
        if(shareList.length == 1) {
            shareListText = shareList[0];
        } else if(shareList.length == 2) {
            shareListText = shareList.join(' and ');
        } else {
            shareList[shareList.length - 1] = 'and '+ shareList[shareList.length - 1];
            shareListText = shareList.join(', ')
        }
        shareWarning = '\n'
            + 'This '+itemType+' is currently shared via '+shareListText+'.'
            + '  <b>Deleting this '+itemType+' will also delete your shares.</b>';
    }
    
    return shareWarning;
}

// Compose pledge and entry warnings for trash award confirmation
export function getEntryWarning(awardId, awardItemMap, entryItemList, entryItemMap) {
    var warning = '';    
    var pledgeList = [];
    var entryList = [];
                
    entryItemList.forEach(function(entryId) {
        var entry = entryItemMap.get(entryId);
        var section = entry.get('sections').last().toJS();
                                                                                                              
        if(section.attachments.find(function(attachment) {
            return attachment.award == awardId;
        })) {
            var refAwardId = entry.get('award');
        
            if(refAwardId) {
                pledgeList.push(awardItemMap.getIn([refAwardId, 'badge_name']));
            } else {
                entryList.push(section.title+' ('+moment(section.updated_dt).format('M/D/YY')+')');
            }
        }
                    
        return true;
    }, this);

    if(pledgeList.length) {
        warning = '\n'
            + 'This badge is currently attached to pledges for the following badges,'
            + ' but deleting it will <b>not</b> have any affect on them:\n'
            + '<ul><li>'+pledgeList.join('</li><li>')+'</li></ul>';
    }

    if(entryList.length) {        
        warning += '\n'
            + 'This badge is currently attached to the following ePortfolio entries,'
            + ' but deleting it will <b>not</b> have any affect on them:\n'
            + '<ul><li>'+entryList.join('</li><li>')+'</li></ul>';
    }
    
    return warning;
 }

export function LoadingIndicator(props) {
    return (
        <div className="text-center" style={{
            display: 'table',
            width: '100%',
            height: '100%',
            textAlign: 'center'
        }}>
            <span style={{display: 'table-cell', verticalAlign: 'middle'}}>
                 <i className="fa fa-spinner fa-spin fa-5x fa-fw text-muted" style={{
                    width: '70px'
                }}></i>
            </span>
        </div>
    );
}

export function InfoAlert(props) {
    return (
        <div className="alert alert-success" role="alert" style={{marginTop:20}}>
            <span className="glyphicon glyphicon-info-sign"></span>
            &nbsp;{props.msg}
        </div>
    );
}

export function ErrorAlert(props) {
    return (
        <div className="alert alert-danger" role="alert">
            {(props.onClose) ? (
                <button type="button" className="close" onClick={props.onClose}>
                    <span aria-hidden="true">&times;</span>
                </button>
            ) : null}
            <span className="glyphicon glyphicon-exclamation-sign"></span>
            &nbsp;{props.msg}

        </div>
    );
}

export function ViewCount(props) {
    if(props.shares.length) {
        var isShared = false;
        
        var nViews = props.shares.reduce(function(sum, shareId) {
            var share = props.shareMap.get(shareId);
            
            isShared = isShared || !share.get('is_deleted');
            return sum + share.get('views');
        }, 0);

        return (
            <div className="text-center" style={{
                position: 'absolute',
                top: '12px',
                right: '30px',
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                backgroundColor: (isShared) ? '#ff5722' : '#a9a6a6',
                color: '#ffffff',
                paddingTop: '4px'
            }}>
                <div style={{fontSize: '1.1em'}}>{nViews}</div>
                <div style={{fontSize: '0.8em', marginTop: '-4px'}}>
                    {(nViews == 1) ? 'View': 'Views'}
                </div>
            </div>
        );
    }

    return null;
}

export class SharePanel extends React.Component {
    constructor(props) {
        super(props);

        this.state = {typeMap: {}}; // map share type to share id

        this.buildTypeMap = (nextProps, typeMap) => {
            nextProps.shares.forEach(function(shareId) {
                var share = nextProps.shareMap.get(shareId);
                
                if(!share.get('is_deleted')) {
                    typeMap[share.get('type')] = shareId;
                }
            }, this);        
        }
        
        this.onLink = this.handleShare.bind(this, 'type_link');
        this.onEmbed = this.handleShare.bind(this, 'type_embed');
        this.onFacebook = this.handleShare.bind(this, 'type_facebook');
        this.onTwitter = this.handleShare.bind(this, 'type_twitter');
        this.onPinterest = this.handleShare.bind(this, 'type_pinterest');
        this.onGooglePlus = this.handleShare.bind(this, 'type_googleplus');
        this.onLinkedIn = this.handleShare.bind(this, 'type_linkedin');

        this.buildTypeMap(props, this.state.typeMap);
    }

    handleShare(shareType, e) {
        this.props.handleShare(this.props.id, shareType, this.state.typeMap[shareType]);
    }

    componentWillReceiveProps(nextProps) {
        var typeMap = {};
        
        this.buildTypeMap(nextProps, typeMap);
        this.setState({typeMap: typeMap});
    }

    render() {
        var pinterest = null;

        if(this.props.pinterest) {
            pinterest = (
                <a href="javascript:void(0)" title="Pinterest" onClick={this.onPinterest}
                    style={{
                        color: (this.state.typeMap.type_pinterest) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-pinterest-square fa-lg"></i>
                </a>
            );
        }

        return (
            <span className='shareOptions' style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                <a href="javascript:void(0)" title="Public Link" onClick={this.onLink}
                    style={{
                        color: (this.state.typeMap.type_link) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-link"></i>
                </a>
                <a href="javascript:void(0)" title="HTML Embed" onClick={this.onEmbed}
                    style={{
                        color: (this.state.typeMap.type_embed) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-code fa-lg"></i>
                </a>
                <a href="javascript:void(0)" title="Facebook" onClick={this.onFacebook}
                    style={{
                        color: (this.state.typeMap.type_facebook) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-facebook-square fa-lg"></i>
                </a>
                <a href="javascript:void(0)" title="Twitter" onClick={this.onTwitter}
                    style={{
                        color: (this.state.typeMap.type_twitter) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-twitter-square fa-lg"></i>
                </a>

                {(this.props.pinterest) ? (
                    <a href="javascript:void(0)" title="Pinterest" onClick={this.onPinterest}
                        style={{
                            color: (this.state.typeMap.type_pinterest) ? '#ff5722' : '#333'
                        }}
                    >
                        <i className="fa fa-pinterest-square fa-lg"></i>
                    </a>
                ) : null}
                <a href="javascript:void(0)" title="Google Plus" onClick={this.onGooglePlus}
                    style={{
                        color: (this.state.typeMap.type_googleplus) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-google-plus-square fa-lg"></i>
                </a>
                <a href="javascript:void(0)" title="LinkedIn" onClick={this.onLinkedIn}
                    style={{
                        color: (this.state.typeMap.type_linkedin) ? '#ff5722' : '#333'
                    }}
                >
                    <i className="fa fa-linkedin-square fa-lg"></i>
                </a>
            </span>
        );
    }
}

SharePanel.defaultProps = {
    pinterest: true
}

export function UploadPopoverMenu(props) {
    return (
         <Overlay {...props}>
            <Popover id="upload-popover" style={{
                background: '#fff',
            }}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onComputer}>
                            From My Computer
                        </a>
                    </li>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onGoogleDrive}>
                            From Google Drive
                        </a>
                    </li>
                </ul>
            </Popover>
        </Overlay>
    );
}

export function AttachmentPopoverMenu(props) {
    return (
         <Overlay {...props}>
            <Popover id="attachment-popover" style={{
                background: '#fff',
            }}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onView}>
                            <i className="fa fa-search" /> View
                        </a>
                    </li>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onTrash}>
                            <i className="fa fa-trash"/> Trash
                        </a>
                    </li>
                </ul>
            </Popover>
        </Overlay>
    );
}

