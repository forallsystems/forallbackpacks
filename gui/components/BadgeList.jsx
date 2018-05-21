import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {Link, withRouter} from 'react-router-dom';
import {List, Map, Set} from 'immutable';
import {Popover, Overlay} from 'react-bootstrap';
import moment from 'moment';
import Cookies from 'js-cookie';
import GooglePicker from 'react-google-picker';
import * as constants from '../constants';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON, fetchPostFormData,
    fetchUserSuccess, addAward, updateAwardTags, updateAwardStatus, deleteAward, 
    deleteEntry, setIsOffline
} from '../action_creators';
import {
    parseQueryString, isOnline, isAwardExpired, getShareWarning, getEntryWarning,
    ErrorAlert, InfoAlert, LoadingIndicator, ViewCount, SharePanel
} from './common.jsx';
import {FilterModal, FilterBar, filterBgColor} from './Filter.jsx';
import {
    showErrorModal, showInfoModal, showConfirmModal, showProgressModal, hideProgressModal,
    FsBadgeModal, WelcomeModal, ShareDetailsModal
} from './Modals.jsx';
import {Tags} from './Tags.jsx';
import {Exporter} from './Exporter.jsx'
import {Sharer} from './Sharer.jsx'


class CustomGooglePicker extends GooglePicker {
    constructor(props) {
        super(props);
    }

    doAuth(callback) {
        // Override to use stored token, if available
        // Not necessary, but lets us check if user is offline
        fetchGetJSON(constants.API_ROOT+'me/googletoken/')
            .then((json) => {
                console.debug('success', json);
                callback(json.access_token);
            })
            .catch((error) => {
                console.error('error', error);

                if(error.status == 403) {
                    window.gapi.auth.authorize({
                        client_id: this.props.clientId,
                        scope: this.props.scope,
                        immediate: this.props.authImmediate
                      },
                      callback
                    );
                } else {
                    if(error instanceof TypeError) {
                        error = 'You must be online to upload from Google Drive.';
                    }
                    showErrorModal('Error Uploading From Google Drive', error);
                }
            });
    }

    render() {
        // Override to not render picker around a trigger
        return null;
    }
}

class PledgeListItem extends React.Component {
    constructor(props) {
        super(props);

        this.saveTags = (value) => {
            this.props.onSaveTags(this.props.award.id, value);
        }

        this.onView = (e) => {
            this.props.onView(this.props.award.id);
        }

        this.onShowMenu = (e) => {
            this.props.onShowMenu(e, this.props.award.id);
        }

        this.onPledge = (e) => {
            this.props.onPledge(this.props.award.id);
        }
        
        this.state = {};
    }

    render() {
        var award = this.props.award;
        var nAttachments = 0;     
        var pledgeDate = null;
        
        if(this.props.entry) {
            var section = this.props.entry.sections[this.props.entry.sections.length - 1];
            nAttachments = section.attachments.length;
            pledgeDate = section.updated_dt;
        }

        return (
            <div className="list-group-item" style={{
                position: 'relative',
                padding:'10px 0',
                borderBottom:'1px solid rgba(0, 0, 0, 0.1)'
            }}>
                <div className="row-action-primary" onClick={this.onView} style={{cursor:"pointer"}} title="View Details">
                    <img src={award.badge_image_data_uri} />
                </div>
                <div className="row-content">
                    <div className="action-secondary" style={{right: 0}}>
                        <a href="javascript:void(0)" onClick={this.onShowMenu}>
                            <span className="glyphicon glyphicon-option-vertical" style={{
                                color: '#009688',
                                fontSize: '28px'
                            }}>
                            </span>
                        </a>
                    </div>
                    <div className="list-group-item-heading" style={{
                        height: '32px',
                        marginBottom: 0,
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                    }}>
                        <span onClick={this.onView} style={{
                            display: 'inline-block',
                            maxWidth: '-webkit-calc(100% - 24px)',
                            maxWidth: 'calc(100% - 24px)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor:"pointer"
                        }}>
                            {award.badge_name}
                        </span>
                        {(nAttachments) ? (
                            <i className="fa fa-paperclip fa-lg text-muted" style={{
                                marginLeft: '10px',
                                marginTop: '5px',
                                verticalAlign: 'top'
                            }}></i>
                        ) : null}
                    </div>
                    <div className="list-group-item-text" style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {(pledgeDate) ? 
                            'Pledged on '+moment(pledgeDate).format('MMMM Do, YYYY') 
                        : 'Not Pledged Yet'} &middot; {award.issuer_org_name}
                    </div>
                    <div>
                        <button className="btn btn-primary btn-raised pledgeButton" onClick={this.onPledge}>
                            Pledge
                        </button>
                    </div>
                    <Tags
                        attrs={null}
                        value={Set(award.tags)}
                        maxTags={10}
                        minTags={0}
                        onChange={this.saveTags}
                    />
                </div>
            </div>
        );
    }
}

class BadgeListItem extends React.Component {
    constructor(props) {
        super(props);

        this.saveTags = (value) => {
            this.props.onSaveTags(this.props.award.id, value);
        }

        this.onView = (e) => {
            this.props.onView(this.props.award.id);
        }

        this.onClickViewCount = (e) => {
            this.props.onShareDetails(this.props.award.id);
        }

        this.onShowMenu = (e) => {
            this.props.onShowMenu(e, this.props.award.id);
        }
        
        this.state = {};
    }

    render() {
        var award = this.props.award;        
        var status = null;
        
        if(award.revoked) {
            status = (
                <div className="list-group-item-text text-danger">
                    Badge Was Revoked
                </div>
            );    
        } else if(isAwardExpired(award)) {
            status = (
                <div className="list-group-item-text text-danger">
                    Awarded badge no longer valid
                </div>
            );    
        }
                            
        return (
            <div className="list-group-item" style={{
                position: 'relative',
                padding:'10px 0',
                borderBottom:'1px solid rgba(0, 0, 0, 0.1)'
            }}>
                <div className="row-action-primary" onClick={this.onView} style={{cursor:"pointer"}} title="View Details">
                    <img src={award.badge_image_data_uri} />
                </div>
                <div className="row-content">
                    <div className="action-secondary" style={{right: 0}}>
                        <a href="javascript:void(0)" onClick={this.onShowMenu}>
                            <span className="glyphicon glyphicon-option-vertical" style={{
                                color: '#009688',
                                fontSize: '28px'
                            }}>
                            </span>
                        </a>
                    </div>
                    <ViewCount 
                        shares={award.shares} 
                        shareMap={this.props.shareMap} 
                        onClick={this.onClickViewCount}
                    />
                    <div className="list-group-item-heading" style={{
                        height: '32px',
                        marginBottom: 0,
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                    }}>
                        <span onClick={this.onView} style={{
                            display: 'inline-block',
                            maxWidth: '-webkit-calc(100% - 24px)',
                            maxWidth: 'calc(100% - 24px)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor:"pointer"
                        }}>
                            {award.badge_name}
                        </span>
                        {(award.evidence.length) ? (
                            <i className="fa fa-paperclip fa-lg text-muted" style={{
                                marginLeft: '10px',
                                marginTop: '5px',
                                verticalAlign: 'top'
                            }}></i>
                        ) : null}
                    </div>
                    <div className="list-group-item-text" style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                       {moment(award.issued_date).format('MMMM Do, YYYY')} &middot; {award.issuer_org_name}
                    </div>
                    {status}
                    <div>
                        <SharePanel
                            id={award.id}
                            shares={award.shares}
                            shareMap={this.props.shareMap}
                            handleShare={this.props.onShare}
                            isOffline={this.props.isOffline}
                            isInvalid={award.revoked || isAwardExpired(award)}
                        />
                    </div>
                    <Tags
                        attrs={null}
                        value={Set(award.tags)}
                        maxTags={10}
                        minTags={0}
                        onChange={this.saveTags}
                    />

                </div>
            </div>
        );
    }
}

function PledgePopoverMenu(props) {
    return (
         <Overlay {...props}>
            <Popover id="award-list-popover" style={{
                background: '#fff',

            }}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onView}>
                            <i className="fa fa-search" /> View
                        </a>
                    </li>
                </ul>
            </Popover>
        </Overlay>
    );
}

function UnpledgedPopoverMenu(props) {
    return (
         <Overlay {...props}>
            <Popover id="award-list-popover" style={{
                background: '#fff'
            }}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onView}>
                            <i className="fa fa-search" /> View
                        </a>
                    </li>
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

function BadgePopoverMenu(props) {
    return (
         <Overlay {...props}>
            <Popover id="award-list-popover" style={{
                background: '#fff'
            }}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onView}>
                            <i className="fa fa-search" /> View
                        </a>
                    </li>
                    {(props.isOffline) ? null : (
                        <li style={{padding:'8px 0'}}>
                            <a href='javascript:void(0)' onClick={props.onExport}>
                                <i className="fa fa-download" /> Export
                            </a>
                        </li>
                    )}
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

function AllBadgesPopoverMenu(props) {
    return (
         <Overlay {...props}>
            <Popover id="all-badges-popover" style={{
                background: '#fff'
            }}>
                <ul className="list-unstyled" style={{marginBottom: 0}}>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onUploadFromComputer}>
                            Upload From Computer
                        </a>
                    </li>
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onUploadFromGoogleDrive}>
                            Upload From Google Drive
                        </a>
                    </li>
                </ul>
            </Popover>
        </Overlay>
    );
}        

class _BadgeList extends React.Component {
    constructor(props) {
        super(props);

        this.onClaimFsBadge = () => {
            fetchGetJSON(constants.API_ROOT+'me/claim_fsbadge/')
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(addAward(json));
                })
                .catch((error) => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to claim a badge.';
                    }
                    showErrorModal('Error Claiming Badge', error);
                });
        }

        this.showAllBadgesPopoverMenu = (e) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling
        
            this.setState({
                showAllBadgesMenu: true,
                showBadgeMenu: false,
                showUnpledgedMenu: false,
                showPledgeMenu: false,
                menuTarget: e.target,
                curAwardId: ''
            });
        
        }
        
        this.showBadgePopoverMenu = (e, id) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            this.setState({
                showAllBadgesMenu: false,
                showBadgeMenu: true,
                showUnpledgedMenu: false,
                showPledgeMenu: false,
                menuTarget: e.target,
                curAwardId: id
            });
        }

        this.showUnpledgedPopoverMenu = (e, id) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            this.setState({
                showAllBadgesMenu: false,
                showBadgeMenu: false,
                showUnpledgedMenu: true,
                showPledgeMenu: false,
                menuTarget: e.target,
                curAwardId: id
            });
        }

        this.showPledgePopoverMenu = (e, id) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            this.setState({
                showAllBadgesMenu: false,
                showBadgeMenu: false,
                showUnpledgedMenu: false,
                showPledgeMenu: true,
                menuTarget: e.target,
                curAwardId: id
            });
        }

        // also used by BadgeListItem
        this.viewAward = (id) => {
            this.props.history.push('/badges/'+id);
        }

// Upload
        this.showUploadFile = (e) => {
            this.setState({showAllBadgesMenu: false});
            this.fileInput.click();
        }

        this.showGooglePicker = (e) => {
            this.setState({showAllBadgesMenu: false});
            
            isOnline('upload a badge', () => {
                this.googlePicker.onChoose(e);
            });
        }

        this.uploadFile = this.uploadFile.bind(this);       
        this.uploadGoogleFile = this.uploadGoogleFile.bind(this);
        this.onGooglePickerChange = this.onGooglePickerChange.bind(this);

// Pledge 
        this.viewPledge = (awardId) => {
            if(this.props.awardMap.getIn([awardId, 'entry'])) {
                this.props.history.push('/pledge/view/'+awardId);
            } else {
                this.props.history.push('/badges/'+awardId);
            }            
        }
        
        this.pledgeBadge = (awardId) => {
            this.props.history.push('/pledge/edit/'+awardId);
        }
        
// Share
        this.showShareDetails = (awardId) => {    
            ShareDetailsModal.show(this.props.awardMap.getIn([awardId, 'shares']));
        }
               
        this.handleShare = (id, shareType, shareId) => {
            var award = this.props.awardMap.get(id);

            if(shareId) {
                this.sharer.viewShare(shareId);
            } else if(award.get('revoked')) {
                showErrorModal('Error Creating Share', 'You may not share revoked badges.'); 
            } else if(isAwardExpired(award.toJSON())) {
                showErrorModal('Error Creating Share', 'You may not share expired badges.');
            } else if(this.props.isOffline) {
                showErrorModal('Offline Mode', 'You must be online to share a badge.');
            } else {
                isOnline('create a share', () => {
                    showProgressModal('Creating share');
                
                    // Verify awarded badge
                    fetchGetJSON(constants.API_ROOT+'award/'+id+'/verify/') 
                        .then((json) => {
                            console.debug('success', json);     
                            hideProgressModal();

                            this.props.dispatch(updateAwardStatus(
                                json.id, json.verified_dt, json.revoked, json.revoked_reason
                            ));
                        
                            if(json.revoked) {
                                showErrorModal('Error Creating Share', 'You may not share revoked badges.');
                            } else {
                                this.sharer.createShare(shareType, award.toJSON());  
                            }
                        })
                        .catch((error) => {
                            console.error('error', error); // ignore
                            hideProgressModal();
                            
                            // Allow share if it was verified at some point
                            if(award.get('verified_dt')) {
                                this.sharer.createShare(shareType, award.toJSON());  
                            } else {
                                showErrorModal('Error Creating Share', 'Unable to verify your badge.');
                            }
                        });   
                });       
            }
        }

// Export
        this.onExport = (e) => {
            this.setState({showBadgeMenu: false});
            this.exporter.beginExport(
                this.state.curAwardId, 
                this.props.awardMap.getIn([this.state.curAwardId, 'badge_name'])
            );
        }

// Trash
        this.trashAwardConfirm = (e) => {
            this.setState({
                showBadgeMenu: false, 
                showUnpledgedMenu: false, 
                showPledgeMenu: false
            });
                       
            if(this.props.awardMap.getIn([this.state.curAwardId, 'entry'])) {
                 showConfirmModal(
                    'Are you sure you want to delete this pledge?',
                    this.trashPledge
                );           
            } else {
                // Compose warnings
                var shareWarning = getShareWarning(
                    'badge', 
                    this.props.awardMap.getIn([this.state.curAwardId, 'shares']),
                    this.props.shareMap
                );

                var entryWarning = getEntryWarning(
                    this.state.curAwardId,
                    this.props.awardMap,
                    this.props.entryList,
                    this.props.entryMap
                );
                                
                showConfirmModal(
                    'Are you sure you want to delete this badge?'+shareWarning+entryWarning,
                    this.trashAward
                );
            }
        }
        
        this.trashPledge = (confirm) => {
            var self = this;
            var id = this.props.awardMap.getIn([this.state.curAwardId, 'entry']);
            
            if(this.props.isOffline) {
                this.props.dispatch(deleteEntry(id));
            } else {
                fetchDeleteJSON(constants.API_ROOT+'entry/'+id+'/')
                    .then(json => {
                        this.props.dispatch(deleteEntry(id));
                    })
                    .catch(error => {
                        console.error('error deleting pledge', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to delete pledge.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(deleteEntry(id));                        
                                }
                            );                        
                        } else {
                            showErrorModal('Error Deleting Pledge', error);
                        }
                    });
            }
        }

        this.trashAward = (confirm) => {
            var self = this;
            var id = this.state.curAwardId;
            
            if(this.props.isOffline) {
                this.props.dispatch(deleteAward(id));
            } else {
                fetchDeleteJSON(constants.API_ROOT+'award/'+id+'/')
                    .then(json => {
                        this.props.dispatch(deleteAward(id));
                    })
                    .catch(error => {
                        console.error('error deleting award', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to delete badge.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.props.dispatch(deleteAward(id));                      
                                }
                            );                        
                        } else {
                            showErrorModal('Error Deleting Badge', error);
                        }
                    });
            }
        }

// Tags (called from BadgeListItem)
        this.saveTags = (awardId, value) => {
            var self = this;
            
            if(this.props.isOffline) {
                this.props.dispatch(updateAwardTags(awardId, value.toJSON().sort()));
            } else {                        
                fetchPostJSON(constants.API_ROOT+'award/'+awardId+'/tags/', value)
                    .then((json) => {
                        console.debug('success', json);
                        this.props.dispatch(updateAwardTags(awardId, json.tags));
                    })
                    .catch((error) => {
                        console.log('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to update tags.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(updateAwardTags(awardId, value.toJSON().sort()));                         
                                }
                            );                        
                        } else {
                            showErrorModal('Error Saving Tags', error);
                        }
                    });
            }
        }

// Filter
        this.showFilterModal = (e) => {
            FilterModal.show(this.props.filter);
        }

        this.filterAwards = this.filterAwards.bind(this);

        this.state = {
            showAllBadgesMenu: false,
            showBadgeMenu: false,
            showUnpledgedMenu: false,
            showPledgeMenu: false,
            menuTarget: null,
            curAwardId: '', // active award for BadgePopoverMenu
            awardList: this.filterAwards(props)
        };
    }

    filterAwards(props) {
        var filter = props.filter;

        var startDate = filter.get('startDate');
        var endDate = filter.get('endDate');
        var issuerSet = Set(filter.get('issuers'));
        var tagSet = Set(filter.get('tags'));
        
        var isShared = filter.get('isShared');
        var wasShared = filter.get('wasShared');
        var neverShared = filter.get('neverShared');

        var isValid = filter.get('isValid');
        var isRevoked = filter.get('isRevoked');
        var isExpired = filter.get('isExpired');
        
        var filterShared = isShared || wasShared || neverShared;
        var filterStatus = isValid || isRevoked || isExpired;

        var awardMap = props.awardMap;
        var shareMap = props.shareMap;
        
        return props.awardList.filter(function(itemId) {
            var item = awardMap.get(itemId);
            var issued_date = item.get('issued_date');

            if(item.get('is_deleted')) {
                return false;   // Never show deleted
            }
            
            if(startDate && (issued_date < startDate)) {
                return false;
            }
            if(endDate && (issued_date > endDate)) {
                return false;
            }

            if(issuerSet.size && !issuerSet.has(item.get('issuer_org_name'))) {
                return false;
            }

            if(tagSet.subtract(item.get('tags')).size) {
                return false;
            }
            
            if(filterShared) {
                if(neverShared && item.get('shares').size < 1) {
                    return true;
                }
                
                var _isShared = item.get('shares').find(function(shareId) {
                    return !shareMap.getIn([shareId, 'is_deleted']);
                });
                
                if(isShared && _isShared) {
                    return true;
                }
                
                if(wasShared && !_isShared && item.get('shares').size) {
                    return true;
                }
                
                return false;
            }
            
            if(filterStatus) {
                var _isExpired = isAwardExpired(item.toJSON());
                var _isRevoked = item.get('revoked');
                
                if(isExpired && _isExpired) {
                    return true;
                }
                
                if(isRevoked && _isRevoked) {
                    return true;
                }
                
                if(isValid && !(_isExpired || _isRevoked)) {
                    return true;
                }
                
                return false;
            }
                      
            return true;
        }, this);
    }

    componentDidMount() {
        if(this.exporter.handleQueryString(this.props))  {  
            return; // noop
        }
        
        if(this.props.isOffline) {
            return; // don't try to claim anything if offline
        }
        
        if(this.props.user.get('is_new')) {
            WelcomeModal.show(this.onClaimFsBadge);

            fetchPostJSON(constants.API_ROOT+'me/account/', {
                    is_new: false,
                    is_claimfs: false
                })
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(fetchUserSuccess(json));
                })
                .catch((error) => {
                    console.error('error', error);
                });
        } else if(this.props.user.get('is_claimfs')) {
            FsBadgeModal.show(this.onClaimFsBadge);

            fetchPostJSON(constants.API_ROOT+'me/account/', {
                    is_claimfs: false
                })
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(fetchUserSuccess(json));
                })
                .catch((error) => {
                    console.error('error', error);
                });
        }

        if(this.props.user.get('is_claimrcoe')) {
            console.debug("Claiming RCOE Badge");

            var rcoebadgetype = this.props.user.get('is_claimrcoe');
            var code = '';
            if(rcoebadgetype == 1) { //Presenter
                code = 'RCOE_1UQE4KF';
            } else { //Particiapnt
                code = 'RCOE_ZTAR7FH';
            }

            const json_data = {
                claim_code: code
            };

            fetchPostJSON(constants.API_ROOT+'me/claim_badge/', json_data)
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(addAward(json));
                })
                .catch((error) => {
                    console.error('error', error);
                });

            fetchPostJSON(constants.API_ROOT+'me/account/', {
                    is_claimrcoe: 0
                })
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(fetchUserSuccess(json));
                })
                .catch((error) => {
                    console.error('error', error);
                });
        }

        if(this.props.user.get('event')) {
            console.debug("Claiming Event");
            
            showProgressModal('Claiming your event badge');

            fetchPostJSON(constants.API_ROOT+'me/claim_event/', {})
                .then(json => {
                    console.debug('success claiming event', json);
                  
                    if(json.id) {
                        this.props.dispatch(addAward(json));
                    }
                    
                    hideProgressModal();
            
                    fetchPostJSON(constants.API_ROOT+'me/account/', {
                            event: ''
                        })
                        .then(json => {
                            console.debug('success', json);
                            this.props.dispatch(fetchUserSuccess(json));
                        })
                        .catch((error) => {
                            console.error('error', error);
                        });
                })
                .catch((error) => {
                    hideProgressModal();
                    console.error('error claiming event', error);
                });
            }
     }

    componentWillReceiveProps(nextProps) {
        this.setState({awardList: this.filterAwards(nextProps)})
    }

    uploadFile(e) {
        var self = this;

        if(this.fileInput.files.length) {            
            var errors = [];
            var file = this.fileInput.files[0];

            showProgressModal('Uploading badge');
                        
            var formData = new FormData();
            formData.append('label', file.name);
            formData.append('file', file, file.name);
                       
            fetchPostFormData(constants.API_ROOT+'award/upload/', formData)
                .then((json) => {
                    console.debug('success', json);
                    this.fileInputForm.reset();
                    
                    this.props.dispatch(addAward(json));

                    hideProgressModal();
                    showInfoModal('Success!', 'Your badge has beed uploaded!');
                })
                .catch((error) => {
                    console.error('error', typeof(error), error);
                    this.fileInputForm.reset();    
                    
                    var errorMsg = '';               
                    
                    if(error instanceof TypeError) {
                        errorMsg = 'You must be online to upload a badge.';
                    } else if(error.status == 410) {
                        errorMsg = 'Unable to upload your badge.  ';
                        
                        if(error.statusText) {
                            errorMsg += 'This badge was revoked ('+error.statusText+').';
                        } else {
                            errorMsg += 'This badge was revoked.';
                        }                            
                    } else {
                        // standard error message only
                        errorMsg = 'Unable to upload your badge.  '
                            + 'Please verify that it is an Open Badge and that '
                            + 'the email address associated with the badge has been added to your account.';                              
                    }
                    
                    hideProgressModal();
                    showErrorModal('Error Uploading Badge', errorMsg);
                });
        }
    }

    uploadGoogleFile(file, responsejs) {
        var self = this;
        var errors = [];
 
        showProgressModal('Uploading badge');
        
        var accessToken = gapi.auth.getToken().access_token;
        var xhr = new XMLHttpRequest();

        xhr.open('GET', responsejs.downloadUrl);
        xhr.setRequestHeader('Authorization', 'Bearer '+accessToken);
        xhr.responseType = "blob";

        xhr.onload = function() {
            var formData = new FormData();
            formData.append('label', file.name);
            formData.append('file', xhr.response, file.name);

            fetchPostFormData(constants.API_ROOT+'award/upload/', formData)
                .then((json) => {
                    console.debug('success', json);

                    self.props.dispatch(addAward(json));
                    
                    hideProgressModal();
                    showInfoModal('Success!', 'Your badge has beed uploaded!');
                })
                .catch((error) => {
                    console.error('error', error);

                    var errorMsg = '';               

                    if(error instanceof TypeError) {
                        errorMsg = 'You must be online to upload a badge.';
                    } else if(error.status == 410) {
                        errorMsg = 'Unable to upload your badge.  ';

                        if(error.statusText) {
                            errorMsg += 'This badge was revoked ('+error.statusText+').';
                        } else {
                            errorMsg += 'This badge was revoked.';
                        }                            
                    
                    } else {
                        // standard error message only
                        errorMsg = 'Unable to upload your badge.  '
                            + 'Please verify that it is an Open Badge and that '
                            + 'the email address associated with the badge has been added to your account.';                              
                    }
                    
                    hideProgressModal();
                    showErrorModal('Error Uploading Badge', errorMsg);
                });
        };

        xhr.send();
    }    

    onGooglePickerChange(data) {
        var self = this;
        var errors = [];
        
        if(data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
            var docs = data[google.picker.Response.DOCUMENTS];

            docs.forEach(function(file) {
                isOnline('upload a badge', () => {
                    gapi.client.request({
                        'path': '/drive/v2/files/'+file.id,
                        'method': 'GET',
                        callback: function (responsejs, responsetxt) {
                            if(responsejs.fileExtension) {
                                self.uploadGoogleFile(file, responsejs);
                            } else {
                                showErrorModal('Error Uploading Badge', 'Unable to upload Google Docs.');
                            }
                        }
                    });
                });
            });
        }
    }

    render() {
        var awardsContent = null;

        if(this.props.error) {
            awardsContent = (
                <ErrorAlert msg={this.props.error} />
            );
        } else if(this.props.loading) {
            awardsContent = (
                <LoadingIndicator />
            );
        } else if(this.state.awardList.size) {
            var awardMap = this.props.awardMap;

            awardsContent = this.state.awardList.map(function(id, i) {
                var awardJS = awardMap.get(id).toJS();
                
                if(awardJS.issued_date) {
                    return (
                        <BadgeListItem key={i}
                            award={awardJS}
                            shareMap={this.props.shareMap}
                            onView={this.viewAward}
                            onShowMenu={this.showBadgePopoverMenu}
                            onSaveTags={this.saveTags}
                            onShare={this.handleShare}
                            onShareDetails={this.showShareDetails}
                            isOffline={this.props.isOffline}
                        />
                    );
                } else {                              
                    return (
                        <PledgeListItem key={i}
                            award={awardJS}
                            entry={(awardJS.entry) ? this.props.entryMap.get(awardJS.entry).toJS() : null}
                            onView={this.viewPledge}
                            onShowMenu={(awardJS.entry) ? this.showPledgePopoverMenu : this.showUnpledgedPopoverMenu}
                            onSaveTags={this.saveTags}
                            onShare={this.handleShare}
                            onShareDetails={this.showShareDetails}
                            onPledge={this.pledgeBadge}
                        />
                    );
                }
            }, this);
        } else {
            awardsContent = (
                <InfoAlert msg="No badges found" />
            );
        }

        return (
            <span>

             <div className="row">
                <div className="filterBarContainer" style={{backgroundColor: filterBgColor}}>
                    <FilterBar
                        dispatch={this.props.dispatch}
                        tagType={constants.TAG_TYPE.Award}
                        count={this.state.awardList.size}
                        filter={this.props.filter}
                        onClickFilter={this.showFilterModal}
                        hasMenu={true}
                    />
                    {(this.props.isOffline) ? null : (
                        <div className="pull-right filterBarMenuTrigger">
                            <a href="javascript:void(0)" onClick={this.showAllBadgesPopoverMenu}>
                                <span className="glyphicon glyphicon-option-vertical" style={{
                                    color: '#000000',
                                    fontSize: '16px',
                                    minHeight: '37px',
                                    lineHeight: '37px'
                                }}>
                                </span>
                            </a>
                        </div>
                    )}
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12 filteredContentContainer">
                    <div className="list-group">
                        {awardsContent}
                    </div>
                </div>
                <BadgePopoverMenu
                    rootClose={true}
                    animation={false}
                    show={this.state.showBadgeMenu}
                    onHide={() => this.setState({showBadgeMenu: false})}
                    target={this.state.menuTarget}
                    placement="left"
                    container={this}
                    onView={(e) => this.viewAward(this.state.curAwardId)}
                    onExport={this.onExport}
                    onTrash={this.trashAwardConfirm}
                    isOffline={this.props.isOffline}
                />
                <UnpledgedPopoverMenu
                    rootClose={true}
                    animation={false}
                    show={this.state.showUnpledgedMenu}
                    onHide={() => this.setState({showUnpledgedMenu: false})}
                    target={this.state.menuTarget}
                    placement="left"
                    container={this}
                    onView={(e) => this.viewPledge(this.state.curAwardId)}
                    onTrash={this.trashAwardConfirm}
                />
                <PledgePopoverMenu
                    rootClose={true}
                    animation={false}
                    show={this.state.showPledgeMenu}
                    onHide={() => this.setState({showPledgeMenu: false})}
                    target={this.state.menuTarget}
                    placement="left"
                    container={this}
                    onView={(e) => this.viewPledge(this.state.curAwardId)}
                    onTrash={this.trashAwardConfirm}
                />
            </div>

            <AllBadgesPopoverMenu
                rootClose={true}
                animation={false}
                show={this.state.showAllBadgesMenu}
                onHide={() => this.setState({showAllBadgesMenu: false})}
                target={this.state.menuTarget}
                placement="left"
                container={this}
                onUploadFromComputer={this.showUploadFile}
                onUploadFromGoogleDrive={this.showGooglePicker}
            />

            <form ref={(el) => {this.fileInputForm = el;}}>
                <input ref={(el) => {this.fileInput = el;}} type="file" accept="image/png, image/svg+xml" style={{display:'none'}}
                    onChange={this.uploadFile}
                />           
            </form>

            <CustomGooglePicker ref={(el) => {this.googlePicker = el;}}
                clientId={constants.AUTH.service.GoogleDrive.client_id}
                developerKey={constants.AUTH.service.GoogleDrive.developer_key}
                scope={['https://www.googleapis.com/auth/drive.readonly']}
                onChange={this.onGooglePickerChange}
                multiselect={false}
                navHidden={true}
                authImmediate={false}
                viewId={'DOCS'}
            >
                <label style={{
                    color: '#009688',
                    margin: '0 10px 0 0',
                    padding: '6px 4px 6px 0',
                    cursor: 'pointer'
                }}>
                    <i className="fa fa-plus" aria-hidden="true"></i> Upload File
                </label>
            </CustomGooglePicker>
            
            <FilterModal
                type='Badges'
                dispatch={this.props.dispatch}
                tagType={constants.TAG_TYPE.Award}
                issuers={this.props.issuers}
                tags={this.props.tags}
                attrs={this.props.attrs}
            />

            <Sharer ref={(el) => {this.sharer = el;}}
                contentType='award' 
                dispatch={this.props.dispatch}
                shareMap={this.props.shareMap} 
                isOffline={this.props.isOffline}
            />
            
            <Exporter ref={(el) => {this.exporter = el;}} />

            <FsBadgeModal />
            <WelcomeModal />
            <ShareDetailsModal shareMap={this.props.shareMap} />

            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        isOffline: state.get('isOffline', false),
        user: state.get('user', new Map()),
        filter: state.getIn(['filter', constants.TAG_TYPE.Award], new Map()),
        issuers: state.get('issuers', new List()),
        tags: state.getIn(['tags', constants.TAG_TYPE.Award], new List()),
        attrs: state.getIn(['attrs', constants.TAG_TYPE.Award], {}),
        loading: state.getIn(['awards', 'loading'], false),
        error: state.getIn(['awards', 'error'], null),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        awardList: state.getIn(['awards', 'items'], new List()),
        entryList: state.getIn(['entries', 'items'], new List()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map()),
        shareMap: state.getIn(['shares', 'itemsById'], new Map())
    };
}

export const BadgeList = connect(mapStateToProps)(_BadgeList);
