import React from 'react'
import {Popover, Overlay} from 'react-bootstrap';
import moment from 'moment';
import * as constants from '../constants';
import {fetchGetJSON} from '../action_creators';
import {showErrorModal} from './Modals.jsx';

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

export function scrollTop() {
    document.getElementsByTagName('body')[0].scrollTop = 0;
    document.getElementById('contentContainer').scrollTop = 0;
}

export function isOnline(action, callback) {
    fetchGetJSON(constants.API_ROOT+'me/test/')
        .then(() => {
            callback();     
        })
        .catch((error) => {
            if(error instanceof TypeError) {
                error = 'You must be online to '+action+'.';
            }                    
            showErrorModal('No Network Connection', error);
        });
}

export function dataURItoBlob(dataurl) {
    var arr = dataurl.split(','), 
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while(n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

export function downloadAttachment(attachment) {
    if(window.navigator.msSaveOrOpenBlob) {
        var blob = dataURItoBlob(attachment.data_uri);
        window.navigator.msSaveBlob(blob, attachment.label);
    } else {
        var elem = window.document.createElement('a');
        elem.href = attachment.data_uri;
        elem.download = attachment.label;        
        document.body.appendChild(elem);
        elem.click();        
        document.body.removeChild(elem);
    }
}

export function isImageAttachment(item) {
    var label = item.label || '';
    
    return /\.(gif|jpeg|jpg|png|svg)$/.test(label.toLowerCase())
    || /\.+\.(gif|jpeg|jpg|png|svg)$/.test(item.file || item.hyperlink)
    || /^data:image\/(png|gif|jpeg|svg+xml);.+/.test(item.data_uri);
}

// @item = attachment or evidence object (JS)
// @award = award object (Map)
export function getAttachmentIcon(item, award, height, clsName) {
    if(award) {
        return (
            <img src={award.get('badge_image_data_uri')} height={height} />
        );
    }
               
    var label = item.label.toLowerCase();
    var uri = item.file || item.data_uri;
    
    if(/\.(gif|jpeg|jpg|png|svg)$/.test(label)
    || /^data:image\/(png|gif|jpeg|svg+xml);.+/.test(uri)) {
        return (
            <img src={uri} height={height} />
        );
    }
        
    if(/\.(pdf)$/.test(label) || label == 'certificate'
    || /^data:application\/pdf;.+/.test(uri)) {
        return (
            <i className={"fa fa-file-pdf-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(zip|gzip|gz|sit|sitx|tar|tgz)$/.test(label)
    || /^data:application\/(zip|x-tar);.+/.test(uri)) {
        return (
            <i className={"fa fa-file-zip-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(doc|docx|docm)$/.test(label)
    || /^data:application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document);.+/.test(uri)) {

        return (
            <i className={"fa fa-file-word-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(ppt|pptx|pptm)$/.test(label)
    || /^data:application\/vnd\.(ms-powerpoint|openxmlformats-officedocument\.presentationml\.presentation);.+/.test(uri)) {

        return (
            <i className={"fa fa-file-powerpoint-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(xlsx|xlsm|xltx|xltm)$/.test(label)
    || /^data:application\/vnd\.(ms-excel|openxmlformats-officedocument\.spreadsheetml\.sheet);.+/.test(uri)) {
        return (
            <i className={"fa fa-file-excel-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(aac|m4a|mp3|ogg|wav|wma)$/.test(label)
    || /^data:audio\/.+;.+/.test(uri)) {
        return (
            <i className={"fa fa-file-audio-o "+clsName} aria-hidden="true"></i>
        );
    }
    if(/\.(avi|flv|mov|mp4|mpeg|wmv)$/.test(label)
    || /^data:video\/.+;.+/.test(uri)) {
        return (
            <i className={"fa fa-file-video-o "+clsName} aria-hidden="true"></i>
        );
    }    

    return (
        <i className={"fa fa-file-text-o "+clsName} aria-hidden="true"></i>
    );
}

export function isAwardExpired(awardJSON) {
    return awardJSON.expiration_date 
        && awardJSON.expiration_date <= moment.utc().format('YYYY-MM-DD'); 
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
            <div className="text-center" 
                onClick={props.onClick}
                style={{
                    position: 'absolute',
                    top: '12px',
                    right: '30px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    backgroundColor: (isShared) ? '#ff5722' : '#a9a6a6',
                    color: '#ffffff',
                    paddingTop: '4px',
                    cursor: 'pointer'
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
        
        this.buildTypeMap(props, this.state.typeMap);
        
        this.handleShare = (shareType) => {
            this.props.handleShare(this.props.id, shareType, this.state.typeMap[shareType]);
        }  
    }

    componentWillReceiveProps(nextProps) {
        var typeMap = {};
        
        this.buildTypeMap(nextProps, typeMap);
        this.setState({typeMap: typeMap});
    }
    
    render() {
        return (
            <span className='shareOptions' style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                {constants.SHARE_TYPE_LIST.map(function(shareType, i) {
                    var color = (this.state.typeMap[shareType]) ? '#ff5722' : 
                        (this.props.isOffline || this.props.isInvalid) ? '#ccc' : '#333';
                        
                    return (
                        <a href="javascript:void(0);"
                            title={constants.SHARE_TYPE_NAME[shareType]}
                            onClick={(e) => { this.handleShare(shareType) }}
                            style={{color: color}}>
                            <i className={constants.SHARE_TYPE_ICON_CLASS[shareType]} />
                        </a>
                    );
                }, this)}
             </span>
        );
    }
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
    var overlayProps = Object.assign({}, props);
    
    delete overlayProps.onView;
    delete overlayProps.onTrash;
    delete overlayProps.onDownload;
    delete overlayProps.isOffline;
    delete overlayProps.attachment;
    
    var attachment = props.attachment;
    var viewDownload = null;
        
    if(props.isOffline) {
        if(!attachment.id) {
            if(isImageAttachment(attachment)) {
                // show image modal
                viewDownload = (
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onView}>
                            <i className="fa fa-search" /> View
                        </a>
                    </li>
                );
            } else if(!window.navigator.standalone && attachment.fileSize) {
                // link to download in new window
                viewDownload = (
                    <li style={{padding:'8px 0'}}>
                        <a href={attachment.data_uri} download={attachment.label} target="_blank" onClick={props.onDownload}>
                            <i className="fa fa-download" /> Download
                        </a>
                    </li>
                );
            } 
        }
    } else {
        if(isImageAttachment(attachment)) {
            // show image modal
            viewDownload = (
                <li style={{padding:'8px 0'}}>
                    <a href='javascript:void(0)' onClick={props.onView}>
                        <i className="fa fa-search" /> View
                    </a>
                </li>
            );
        } else if(attachment.id) {
            // link to view in new window
            viewDownload = (
                <li style={{padding:'8px 0'}}>
                    <a href={attachment.hyperlink} target="_blank" onClick={props.onView}>
                        <i className="fa fa-search" /> View
                    </a>
                </li>
            );
        } else if(!window.navigator.standalone && attachment.fileSize) {
            // link to download in new window
            viewDownload = (
                <li style={{padding:'8px 0'}}>
                    <a href={attachment.data_uri} download={attachment.label} target="_blank" onClick={props.onDownload}>
                        <i className="fa fa-download" /> Download
                    </a>
                </li>
            );
        }
    }
    
    return (
         <Overlay rootClose={true} animation={false} {...overlayProps}>
            <Popover id="attachment-popover" style={{background: '#fff'}}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    {viewDownload}
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onTrash}>
                            <i className="fa fa-trash"/> Remove
                        </a>
                    </li>
                </ul>
            </Popover>
        </Overlay>
    );
}


