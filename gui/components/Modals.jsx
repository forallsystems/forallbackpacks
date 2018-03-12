import React from 'react';
import ReactDOM from 'react-dom';
import {Link} from 'react-router-dom';
import {List, Map, Set} from 'immutable';
import moment from 'moment';
import Cookies from 'js-cookie';
import * as constants from '../constants';
import {dispatchCustomEvent, LoadingIndicator, InfoAlert} from './common.jsx';

export class Modal extends React.Component {
    constructor(props) {
        super(props);

        this.dialogClassName = "modal-dialog";

        this.showModal = () => {
            $('#'+this.eventId).modal('show');
        }

        this.hideModal = () => {
            $('#'+this.eventId).modal('hide');
        }

        this.handleEvent = this.handleEvent.bind(this);

        this.state = {};
    }

    handleEvent(e) {
        switch(e.type) {
            case this.eventId:
                this.setState(e.detail);
                this.showModal();
                break;
        }
    }

    componentDidMount() {
        document.addEventListener(this.eventId, this, false);
    }

    componentWillUnmount() {
        document.removeEventListener(this.eventId, this, false);
    }

    renderContent() {
        return 'You must override renderContent() in subclass';
    }

    render() {
        return (
            <div className="modal fade" id={this.eventId}>
                <div className={this.dialogClassName}>
                    {this.renderContent()}
                </div>
            </div>
        );
    }

}

export function showInfoModal(title, msg) {
    dispatchCustomEvent('showInfoModal', {title: title, msg: msg});
}

export class InfoModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showInfoModal';
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">{this.state.title || ''}</h4>
                </div>
                <div className="modal-body">
                    <p>{this.state.msg}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={this.hideModal}
                        style={{width: '80px'}}>
                        Close
                    </button>
                </div>
            </div>
        );
    }
}

export function showConfirmModal(msg, onConfirm) {
    dispatchCustomEvent('showConfirmModal', {
        msg: msg, 
        onConfirm: onConfirm
    });
}

export class ConfirmModal extends Modal {
    constructor(props) {
        super(props);
    
        this.eventId = 'showConfirmModal';
        this.state = {
            msg: '',
            onConfirm: ''
        };

        this.confirm = (e) => {
            this.hideModal();
            this.state.onConfirm();
        }
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <h4 className="modal-title">Confirm</h4>
                </div>
                <div className="modal-body"style={{maxHeight: '420px', overflowY: 'scroll'}}>
                    {this.state.msg.split("\n").map(function(line, j) {
                        return (
                            <p key={j} dangerouslySetInnerHTML={{__html: line}}></p>
                        );                            
                    })}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={this.hideModal}
                        style={{width: '80px'}}>
                        No
                    </button>
                    <button type="button" className="btn btn-danger" onClick={this.confirm}
                        style={{width: '80px'}}>
                        Yes
                    </button>
                </div>
            </div>
        );
    }
}

export function showErrorModal(title, error) {
    var errorList = [];

    if(error.detail) {
        for(var key in error.detail) {
            errorList.push(error.detail[key]+': '+key);
        }
    } else if(error.statusText) {
        errorList.push(error.statusText);
    } else {
        errorList.push(error);
    }

    dispatchCustomEvent('showErrorModal', {title: title, msg: errorList.join(',')});
}

export class ErrorModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showErrorModal';
    }

    renderContent() {
        return (
            <div className="modal-content">
                {(this.state.title) ? (
                    <div className="modal-header">
                        <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                        <h4 className="modal-title">{this.state.title}</h4>
                     </div>
                ) : null}
                <div className="modal-body">
                    <p className="text-danger">{this.state.msg}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={this.hideModal}
                        style={{width: '80px'}}>
                        Close
                    </button>
                </div>
            </div>
        );
    }
}

export function showProgressModal(msg) {
    dispatchCustomEvent('showProgressModal', {msg: msg});
}

export function hideProgressModal() {
    dispatchCustomEvent('hideProgressModal', {});
}

export class ProgressModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showProgressModal';
    }

    handleEvent(e) {
        switch(e.type) {
            case this.eventId:
                this.setState(e.detail);
                this.showModal();
                break;

            case 'hideProgressModal':
                this.hideModal();
                break;
        }
    }

    componentDidMount() {
        document.addEventListener(this.eventId, this, false);
        document.addEventListener('hideProgressModal', this, false);
    }

    componentWillUnmount() {
        document.removeEventListener(this.eventId, this, false);
        document.removeEventListener('hideProgressModal', this, false);
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-body text-center" style={{padding: '24px'}}>
                    <h5>{this.state.msg}</h5>

                    <LoadingIndicator />
                </div>
            </div>
        );
    }
}

export class ExportAuthModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showExportAuthModal';
    }

    renderContent() {
        var authAurl = this.state.url
            +'?ref='+encodeURIComponent(location.href)+'&id='+this.state.id;

        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                 </div>
                <div className="modal-body text-center">
                    <h5>Exporting to {this.state.name} requires your authorization.</h5>

                    <a className="btn btn-warning btn-raised"
                        href={authAurl}>
                        Begin Authorization
                    </a>
                </div>
            </div>
        );
    }

}

ExportAuthModal.show = function(serviceConfig, id) {
    dispatchCustomEvent('showExportAuthModal', {
        name: serviceConfig.name,
        url: serviceConfig.url,
        id: id
    });
}

export class SharePublicLinkModal extends Modal {
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
                    {(this.state.id) ? (
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

export class ShareEmbedModal extends Modal {
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
                    {(this.state.id) ? (
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

export class ShareBlockedModal extends Modal {
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

export class ShareModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showShareModal';

        this.onLink = this.handleShare.bind(this, 'type_link');
        this.onEmbed = this.handleShare.bind(this, 'type_embed');
        this.onFacebook = this.handleShare.bind(this, 'type_facebook');
        this.onTwitter = this.handleShare.bind(this, 'type_twitter');
        this.onPinterest = this.handleShare.bind(this, 'type_pinterest');
        this.onGooglePlus = this.handleShare.bind(this, 'type_googleplus');
        this.onLinkedIn = this.handleShare.bind(this, 'type_linkedin');

        this.state.share = {};
    }

    handleShare(shareType, e) {
        this.hideModal();
        this.props.handleShare(this.state.id, shareType);
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header" style={{
                    padding: '10px',
                    borderBottom: '1px solid #bbb'
                }}>
                    <div className="row">
                        <div className="col-xs-offset-2 col-xs-8 text-center" style={{
                            fontWeight: 500,
                            fontSize: '1.2em',
                            lineHeight: 1.5,
                        }}>
                            Share {this.state.name} Badge
                        </div>
                        <div className="col-xs-2">
                            <button type="button" className="btn pull-right" onClick={this.hideModal} style={{
                                margin: 0,
                                padding: '4px'
                            }}>
                                <i className="fa fa-times fa-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="modal-body" style={{padding: 0, fontSize:'1.3em'}}>
                    <div className="list-group">
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onLink}
                                className={(this.state.share.type_link) ? "text-warning" : ""}>
                                <i className="fa fa-link" aria-hidden="true"></i> Public Link
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onEmbed}
                                className={(this.state.share.type_embed) ? "text-warning" : ""}>
                                <i className="fa fa-code" aria-hidden="true"></i> HTML Embed
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onFacebook}
                                className={(this.state.share.type_facebook) ? "text-warning" : ""}>
                                <i className="fa fa-facebook-square" aria-hidden="true"></i> Facebook
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onTwitter}
                                className={(this.state.share.type_twitter) ? "text-warning" : ""}>
                                <i className="fa fa-twitter-square" aria-hidden="true"></i> Twitter
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onPinterest}
                                className={(this.state.share.type_pinterest) ? "text-warning" : ""}>
                                <i className="fa fa-pinterest-square" aria-hidden="true"></i> Pinterest
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onGooglePlus}
                                className={(this.state.share.type_googleplus) ? "text-warning" : ""}>
                                <i className="fa fa-google-plus-square" aria-hidden="true"></i> Google Plus
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onLinkedIn}
                                className={(this.state.share.type_linkedin) ? "text-warning" : ""}>
                                <i className="fa fa-linkedin-square" aria-hidden="true"></i> LinkedIn
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ShareModal.show = function(id, name, share) {
    dispatchCustomEvent('showShareModal', {
        id: id,
        name: name,
        share: (share) ? share.toJS() : {}
    });
}

export class ExportModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showExportModal';

        this.onDownload = (e) => {
            this.hideModal();
            this.props.handleDownload(this.state.id);
        }

        this.onDropbox = (e) => {
            this.hideModal();
            this.props.handleDropbox(this.state.id);
        }

        this.onGoogleDrive = (e) => {
            this.hideModal();
            this.props.handleGoogleDrive(this.state.id);
        }

        this.onOneDrive = (e) => {
            this.hideModal();
            this.props.handleOneDrive(this.state.id);
        }
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header" style={{
                    padding: '10px',
                    borderBottom: '1px solid #bbb'
                }}>
                    <div className="row">
                        <div className="col-xs-offset-2 col-xs-8 text-center" style={{
                            fontWeight: 500,
                            fontSize: '1.2em',
                            lineHeight: 1.5,
                        }}>
                            Export {this.state.name} Badge
                        </div>
                        <div className="col-xs-2">
                            <button type="button" className="btn pull-right" onClick={this.hideModal} style={{
                                margin: 0,
                                padding: '4px'
                            }}>
                                <i className="fa fa-times fa-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="modal-body" style={{padding: 0, fontSize:'1.3em'}}>
                    <div className="list-group">
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onDownload}>
                                <i className="fa fa-download" aria-hidden="true"></i> Download
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onDropbox}>
                                <i className="fa fa-dropbox" aria-hidden="true"></i> Send to Dropbox
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onGoogleDrive}>
                                <i className="fa fa-google" aria-hidden="true"></i> Send to Google Drive
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onOneDrive}>
                                <i className="fa fa-cloud" aria-hidden="true"></i> Send to OneDrive
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ExportModal.show = function(id, name) {
    dispatchCustomEvent('showExportModal', {id: id, name: name});
}

export class ClaimedAccountModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showClaimedAccountModal';

        this.onYes = (e) => {
            this.setState({isLoading: true});
            document.location.href = this.state.accountUrl;
        }
    }

    renderContent() {
        if(this.state.isLoading) {
            return (
                <div className="modal-content">
                    <div className="modal-header">
                        <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                        <h4 className="modal-title">Account Claimed</h4>
                    </div>
                    <div className="modal-body">
                        <LoadingIndicator />
                    </div>
                    <div className="modal-footer">
                        <button data-dismiss="modal" className="btn btn-default" disabled="disabled">No</button>
                        <button className="btn btn-danger" onClick={this.onYes} disabled="disabled">Yes</button>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="modal-content">
                    <div className="modal-header">
                        <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                        <h4 className="modal-title">Account Claimed</h4>
                    </div>
                    <div className="modal-body">
                        <p>Your account has been claimed with {this.state.org}.  Would you like to access your account now?</p>
                    </div>
                    <div className="modal-footer">
                        <button data-dismiss="modal" className="btn btn-default">No</button>
                        <button className="btn btn-danger" onClick={this.onYes}>Yes</button>
                    </div>
                </div>
            );
        }
    }
}

ClaimedAccountModal.show = function(org, accountUrl) {
    dispatchCustomEvent('showClaimedAccountModal', {
        org: org,
        accountUrl: accountUrl,
        isLoading: false
    });
}

export class FsBadgeModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showFsBadgeModal';

        this.confirm = (e) => {
            this.hideModal();
            this.state.onConfirm();
        }
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header" style={{backgroundColor:"#04c086",color:"#fff",paddingTop:15,paddingBottom:15}}>

                    <h4 className="modal-title">Claim Your Badge!</h4>
                 </div>
                <div className="modal-body">
                    <p><img src='img/FSBadge.png' style={{width:50, float:"left",paddingRight:10}}/>
                    <b>Congratulations!</b> For creating your personal Open
                    Backpack, you've earned the ForAllSystems Badge.
                    Would you like to claim it now?</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={this.hideModal}
                        style={{width: '80px'}}>
                        No
                    </button>
                    <button type="button" className="btn btn-primary" onClick={this.confirm}
                        style={{width: '80px'}}>
                        Yes
                    </button>
                </div>
            </div>
        );
    }
}

FsBadgeModal.show = function(onConfirm) {
    dispatchCustomEvent('showFsBadgeModal', {onConfirm: onConfirm});
}

export class WelcomeModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showWelcomeModal';

        this.confirm = (e) => {
            this.hideModal();
            this.state.onConfirm();
        }
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header" style={{backgroundColor:"#04c086",color:"#fff",paddingTop:15,paddingBottom:15}}>

                    <h4 className="modal-title"><b>Welcome to ForAllBackpacks!</b></h4>
                 </div>
                <div className="modal-body">
                    
                      <p>
                        <img src='img/FSBadge.png' style={{width:50, float:"left",paddingRight:10}}/>
                        <b>Congratulations!</b> For creating your personal Open
                        Backpack, you've earned the ForAllSystems Badge.
                        Would you like to claim it now?
                      </p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={this.hideModal}
                        style={{width: '80px'}}>
                        No
                    </button>
                    <button type="button" className="btn btn-primary" onClick={this.confirm}
                        style={{width: '80px'}}>
                        Yes
                    </button>
                </div>
            </div>
        );
    }
}

WelcomeModal.show = function(onConfirm) {
    dispatchCustomEvent('showWelcomeModal', {onConfirm: onConfirm});
}

export class SelectBadgeModal extends Modal {
    constructor(props) {
        super(props);

        this.eventId = 'showSelectBadgeModal';

        this.state = {
            awardList: [],
            awardMap: {}
        };
    }

    onSelect(awardId) {
        this.hideModal();
        this.props.onSelect(awardId);
    }

    renderContent() {
        var content = this.state.awardList.map(function(id, i) {
            var award = this.state.awardMap[id];

            return (
                <div key={i} className="list-group-item"
                    onClick={(e) => { this.onSelect(id); }}
                    style={{
                        padding: '10px',
                        borderBottom:'1px solid rgba(0, 0, 0, 0.1)',
                        cursor: 'pointer'
                    }}
                >
                    <div className="row-action-primary">
                        <img src={award.badge_image_data_uri} />
                    </div>
                    <div className="row-content">
                        <div className="list-group-item-heading">
                            {award.badge_name}
                        </div>
                        <div className="list-group-item-text" style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                           {moment(award.issued_date).format('MMMM Do, YYYY')} &middot; {award.issuer_org_name}
                        </div>
                    </div>
                </div>
            );
        }, this);

        return (
            <div className="modal-content">
                <div className="modal-header" style={{
                    padding: '10px',
                    borderBottom: '1px solid #bbb'
                }}>
                    <div className="row">
                        <div className="col-xs-offset-2 col-xs-8 text-center" style={{
                            fontWeight: 500,
                            fontSize: '1.2em',
                            lineHeight: 1.5,
                        }}>
                            Select Badge
                        </div>
                        <div className="col-xs-2">
                            <button type="button" className="btn pull-right" onClick={this.hideModal} style={{
                                margin: 0,
                                padding: '4px'
                            }}>
                                <i className="fa fa-times fa-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="modal-body" style={{maxHeight: '420px', overflowY: 'scroll', padding: 0}}>
                    {(this.state.awardList.length) ? (
                        <div className="list-group" style={{marginBottom: 0}}>
                        {content}
                        </div>
                    ) : (
                        <InfoAlert msg="No awards found." />
                    )}
                </div>
            </div>
        );
    }
}

SelectBadgeModal.show = function(awardList, awardMap) {
    dispatchCustomEvent('showSelectBadgeModal', {
        awardList: awardList.toJS(),
        awardMap: awardMap.toJS()
    });
}
