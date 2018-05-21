import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import moment from 'moment';
import * as constants from '../constants';
import {fetchPostJSON, fetchDeleteJSON, addShare, deleteShare} from '../action_creators';
import {dispatchCustomEvent} from './common.jsx';
import {Modal, showErrorModal, showInfoModal, showConfirmModal}  from './Modals.jsx';


class ShareBlockedModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showShareBlockedModal';

        this.openWindow = (e) => {
            this.hideModal();
            window.open(this.state.url, '_blank', 'width=600,height=600');
        }
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">Pop-up Blocker Detected</h4>
                </div>
                <div className="modal-body" style={{fontSize:'1.2em'}}>
                    <p><a href="javascript:void(0)" onClick={this.openWindow}>Click here to complete your share on {this.state.service}.</a></p>
                    <div className="bootstrap-well">
                        <i>To enable pop-ups, turn off "Block Pop-ups" in your browser settings.</i>
                    </div>
                </div>
            </div>
        );
    }
}

ShareBlockedModal.show = function(service, url) {
    dispatchCustomEvent('showShareBlockedModal', {service: service, url: url});
}

class SharePublicLinkModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showSharePublicLinkModal';
        
        this.onDelete = (e) => {
            this.hideModal();
            this.props.onDelete(this.state.id);
        };
        
        this.onCopy = (e) => {
            var successful = false;
            
            e.preventDefault();
                        
            if(navigator.userAgent.match(/ipad|ipod|iphone/i)) {
                var editable = this.textarea.contentEditable;
                var readOnly = this.textarea.readOnly;
                
                this.textarea.contentEditable = true;
                this.readOnly = false;
               
                var range = document.createRange();
                range.selectNodeContents(this.textarea);
                
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                
                this.textarea.setSelectionRange(0, 999999);
                this.textarea.contentEditable = editable;
                this.textarea.readOnly = readOnly;
                
                successful = document.execCommand('copy');
                
                this.textarea.blur();                
            } else {         
                this.textarea.select();
               
                successful = document.execCommand('copy');
                
                this.textarea.setSelectionRange(0, 0);
            }    
            
            if(successful) {
                this.hideModal();
                showInfoModal('Link Copied', 'The Link has been copied to your clipboard.');
            }
        };
    }
    
    renderContent() {
        var rows = (navigator.userAgent.match(/ipad|ipod|iphone/i)) ? 3 : 2;
    
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">Public Link</h4>
                </div>
                <div className="modal-body" style={{fontSize:'1.2em'}}>
                    <textarea ref={(el) => {this.textarea = el;}} readOnly={true} rows={rows} 
                        value={this.state.url} style={{
                            width: '100%',
                            border: '#ffffff',
                            fontSize:'1.1em',
                            resize: 'none'
                        }} 
                    />
                    <div className="bootstrap-well">
                        <i>Use this link to share your badge with the world.</i>
                    </div>
                </div>
                <div className="modal-footer">
                    {(this.state.id && !this.props.isOffline) ? (
                        <button type="button" className="btn btn-danger" onClick={this.onDelete}>
                            Delete Share
                        </button>
                    ) : null}
                    <button type="button" className="btn btn-success" onClick={this.onCopy}>
                        Copy Link
                    </button>
                </div>
            </div>
        );
    }
}

SharePublicLinkModal.show = function(id, url) {
    dispatchCustomEvent('showSharePublicLinkModal', {id: id, url: url});
}

class ShareEmbedModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showShareEmbedModal';
        
        this.onDelete = (e) => {
            this.hideModal();
            this.props.onDelete(this.state.id);
        };

        this.onCopy = (e) => {
            var successful = false;

            e.preventDefault();
                        
            if(navigator.userAgent.match(/ipad|ipod|iphone/i)) {
                var editable = this.textarea.contentEditable;
                var readOnly = this.textarea.readOnly;
                
                this.textarea.contentEditable = true;
                this.readOnly = false;
               
                var range = document.createRange();
                range.selectNodeContents(this.textarea);
                
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                
                this.textarea.setSelectionRange(0, 999999);
                this.textarea.contentEditable = editable;
                this.textarea.readOnly = readOnly;
                
                successful = document.execCommand('copy');
                                
                this.textarea.blur();                
            } else {         
                this.textarea.select();
                
                successful = document.execCommand('copy');

                this.textarea.setSelectionRange(0, 0);
            }        

            if(successful) {
                this.hideModal();
                showInfoModal('HTML Copied', 'The HTML has been copied to your clipboard.');
            }
        };        
    }

    renderContent() {
        var rows = (navigator.userAgent.match(/ipad|ipod|iphone/i)) ? 5 : 3;
        var value = "<iframe width='300' height='300' frameborder='0' src='"+this.state.url+"'></iframe>";
 
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">HTML Embed</h4>
                </div>
                <div className="modal-body" style={{fontSize:'1.2em'}}>
                     <textarea ref={(el) => {this.textarea = el;}} readonly={true} rows={rows} 
                        value={value} style={{
                            width: '100%',
                            border: '#ffffff',
                            fontSize:'1.1em',
                            resize: 'none'
                        }} />
                   <div className="bootstrap-well">
                        <i>Use this HTML to embed your badges on a web page.</i>
                    </div>
                </div>
                <div className="modal-footer">
                    {(this.state.id && !this.props.isOffline) ? (
                        <button type="button" className="btn btn-danger" onClick={this.onDelete}>
                            Delete Share
                        </button>                   
                    ) : null}
                    <button type="button" className="btn btn-success" onClick={this.onCopy}>
                        Copy HTML
                    </button>
                </div>
            </div>
        );
    }
}

ShareEmbedModal.show = function(id, url) {
    dispatchCustomEvent('showShareEmbedModal', {id: id, url: url});
}

export class Sharer extends React.Component {
    constructor(props) {
        super(props);
                
        this.deleteShare = this.deleteShare.bind(this);
        this.deleteShareConfirm = this.deleteShareConfirm.bind(this);
        this.viewShare = this.viewShare.bind(this);
        this.postCreateShare = this.postCreateShare.bind(this);
 
        if(props.contentType == 'award') {
            this.createShare = this.shareAward.bind(this);
        } else if(props.contentType == 'entry') {
            this.createShare = this.shareEntry.bind(this);
        } else {
            this.createShare = () => {
                showErrorAlert('Unknown content type');
            }
        }
    }

    deleteShare(shareId) {
        fetchDeleteJSON(constants.API_ROOT+'share/'+shareId+'/')
            .then(() => {
                console.debug('success');
                this.props.dispatch(deleteShare(shareId));
            })
            .catch((error) => {
                console.error('error', error);
                if(error instanceof TypeError) {
                    error = 'You must be online to delete a share.';
                }
                showErrorModal('Error Deleting Share', error);
            });
    }
    
    deleteShareConfirm(shareId) {
        var created_dt = this.props.shareMap.getIn([shareId, 'created_dt']);
        
        showConfirmModal(
            "Do you want to delete the share you created on "+moment(created_dt).format('MM/DD/YYYY')+"?",
            this.deleteShare.bind(this, shareId)
        );
    }

    viewShare(shareId) {
        var share = this.props.shareMap.get(shareId);
        
        switch(share.get('type')) {
            case 'type_link':
                SharePublicLinkModal.show(shareId, share.get('url'));
                break;

            case 'type_embed':
                ShareEmbedModal.show(shareId, share.get('url')+'?embed=1');
                break;

            default:
                if(this.props.isOffline) {
                    showErrorModal('Offline Mode', 'You must be online to delete a share.'); 
                } else {
                    this.deleteShareConfirm(shareId);
                }
                break;
        }
    }

    postCreateShare(shareUrl, shareType, title, mediaUrl) {
        var openService = '';
        var openURL = '';

        switch(shareType) {
            case 'type_link':
                SharePublicLinkModal.show(null, shareUrl);
                return;

            case 'type_embed':
                ShareEmbedModal.show(null, shareUrl+'?embed=1');
                return;

            case 'type_facebook':
                openService = 'Facebook';
                openURL = 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(shareUrl);
                break;

            case 'type_twitter':
                openService = 'Twitter';
                openURL = 'https://twitter.com/intent/tweet?text='+encodeURIComponent(title+' '+shareUrl);
                break;

            case 'type_pinterest':
                var url = encodeURIComponent(shareUrl);
                var media = encodeURIComponent(mediaUrl);
                openService = 'Pinterest';
                openURL = 'https://pinterest.com/pin/create/button/'+'?url='+url+'&media='+media+'&description=';
                break;

            case 'type_googleplus':
                openService = 'Google Plus';
                openURL = 'https://plus.google.com/share?url='+encodeURIComponent(shareUrl);
                break;

            case 'type_linkedin':
                var url = encodeURIComponent(shareUrl);
                var title = encodeURIComponent(title);
                openService = 'LinkedIn';
                openURL = 'https://www.linkedin.com/shareArticle?mini=true&url='+url+'&title='+title+'&summary=&source=';
                break;
        }

        var newWindow = window.open(openURL, '_blank', 'width=600,height=600');

        if (newWindow == null || typeof(newWindow) == 'undefined') {
            ShareBlockedModal.show(openService, openURL);
        }
    }

    shareAward(shareType, awardJSON) {
        fetchPostJSON(constants.API_ROOT+'share/', {
            content_type: 'award',
            object_id: awardJSON.id,
            type: shareType
        })
        .then((json) => {
            console.debug('success', json);
            this.props.dispatch(addShare(json));            
            this.postCreateShare(json.url, shareType, awardJSON.badge_name, awardJSON.badge_image);
        })
        .catch((error) => {
            console.error('error', error);
            if(error instanceof TypeError) {
                error = 'You must be online to share a badge.';
            }
            showErrorModal('Error Creating Share', error);
        });
    }
    
    shareEntry(shareType, entryJSON) {
        fetchPostJSON(constants.API_ROOT+'share/', {
            content_type: 'entry',
            object_id: entryJSON.id,
            type: shareType
        })
        .then((json) => {
            console.debug('success', json);
            this.props.dispatch(addShare(json));
        
            var title = entryJSON.sections[0].title;
            var mediaUrl = '';
        
            if(/\/$/.test(constants.APP_ROOT)) {
                mediaUrl = constants.APP_ROOT+'img/ePortfolioPinterestImage.png';
            } else {
                mediaUrl = constants.APP_ROOT+'/img/ePortfolioPinterestImage.png';
            }
        
            this.postCreateShare(json.url, shareType, title, mediaUrl);
        })
        .catch((error) => {
            console.error('error', error);
            if(error instanceof TypeError) {
                error = 'You must be online to share an entry.';
            }
            showErrorModal('Error Creating Share', error);
        }); 
    }
       
    render() {
        return (
            <span>
            <ShareBlockedModal />
            <SharePublicLinkModal onDelete={this.deleteShareConfirm} isOffline={this.props.isOffline} />
            <ShareEmbedModal onDelete={this.deleteShareConfirm}  isOffline={this.props.isOffline} />
            </span>
        );
    }
}
