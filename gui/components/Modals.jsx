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

        this.dataBackdrop = "true"; // "static"
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
            <div className="modal" id={this.eventId} data-backdrop={this.dataBackdrop}>
                <div className={this.dialogClassName}>
                    {this.renderContent()}
                </div>
            </div>
        );
    }

}

export function showInfoModal(title, msg) {
    if(arguments.length < 2) {
        dispatchCustomEvent('showInfoModal', {title: '', msg: title});
    } else {
        dispatchCustomEvent('showInfoModal', {title: title, msg: msg});
    }
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

export function showConfirmModal(title, msg, onConfirm) {
    if(arguments.length < 3) {
        // Support default title
        dispatchCustomEvent('showConfirmModal', {
            msg: title, 
            onConfirm: msg
        });
    } else {
        dispatchCustomEvent('showConfirmModal', {
            title: title,
            msg: msg, 
            onConfirm: onConfirm
        });
    }
}

export class ConfirmModal extends Modal {
    constructor(props) {
        super(props);
    
        this.eventId = 'showConfirmModal';
        this.state = {
            title: '',
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
                    <h4 className="modal-title">{this.state.title || 'Confirm'}</h4>
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

export class LoginModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showLoginModal';
        
        this.state = {
            title: '',
            msg: ''
        }
        
        this.onLogin = (e) => {
            this.hideModal();
            this.props.onLogin();
        }
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
                        Cancel
                    </button>
                    <button type="button" className="btn btn-danger" onClick={this.onLogin}
                        style={{width: '80px'}}>
                        Login
                    </button>
                </div>
            </div>
        );
    }
}

export function showLoginModal(title, msg) {
    dispatchCustomEvent('showLoginModal', {title: title, msg: msg});
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
        this.dataBackdrop = 'static';
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

export class ShareDetailsModal extends Modal {
    constructor(props) {
        super(props);

        this.dialogClassName = "modal-dialog modal-sm";

        this.eventId = 'showShareDetailsModal';

        this.state = {shareList: []};
    }
    
    renderContent() {  
        var typeMap = {};
        
        constants.SHARE_TYPE_LIST.forEach(function(share_type) {
            typeMap[share_type] = {views: 0, active: false, exists: false};
        });
        
        this.state.shareList.forEach(function(shareId) {
            var share = this.props.shareMap.get(shareId);
            
            if(share) {
                var info = typeMap[share.get('type')];
                
                info.views += share.get('views');
                info.active = info.active || !share.get('is_deleted');
                info.exists = true;
            }
        }, this);

        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">Share Details</h4>
                </div>
                <div className="modal-body">
                    <div className="row">
                        <div className="col-xs-offset-8 col-xs-4 text-right" style={{padding:'4px 16px 4px 0'}}>
                        <span style={{color: 'rgba(0,0,0,.87)', fontWeight: 500}}>Views</span>
                        </div>
                    </div>
                    {constants.SHARE_TYPE_LIST.map(function(share_type, i) {
                        var info = typeMap[share_type];
                        
                        return (
                            <div className="row">
                                <div className="col-xs-8" style={{padding:'4px 0 4px 16px'}}>
                                    <i className={constants.SHARE_TYPE_ICON_CLASS[share_type]} 
                                        aria-hidden="true" 
                                        style={{color: (info.active) ? '#ff5722' : '#000'}}
                                    />
                                    &nbsp;
                                    {constants.SHARE_TYPE_NAME[share_type]}
                                </div>
                                <div className="col-xs-4 text-right" style={{padding:'4px 16px 4px 0'}}>
                                {(info.exists) ? (
                                    <span>{info.views}</span>
                                ) : (
                                    <span className="text-muted">&mdash;</span>                                
                                )}                                
                                </div>
                            </div>
                        );                   
                    }, this)}
                </div>
                <div className="modal-footer">
                    <button data-dismiss="modal" className="btn btn-default">Done</button>
                </div>
            </div>
        );
    }
}

ShareDetailsModal.show = function(shareList) {
    dispatchCustomEvent('showShareDetailsModal', {
        shareList: shareList.toJS()
    });
}

export class ImageModal extends Modal {
    constructor(props) {
        super(props);

        this.eventId = 'showImageModal';
        this.state = {label: '', src: ''};
    }
    
    renderContent() {  
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">{this.state.label}</h4>
                </div>
                <div className="modal-body">
                    <img className="img-responsive" src={this.state.src} alt={this.state.label} style={{
                        maxWidth:'100%'
                    }}/>
                </div>
            </div>
        );
    }
}

export function showImageModal(label, src) {
    dispatchCustomEvent('showImageModal', {label: label, src: src});
}
