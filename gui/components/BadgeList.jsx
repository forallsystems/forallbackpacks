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
    fetchUserSuccess,
    addAward, updateAwardTags, deleteAward, deleteEntry,
    addShare, deleteShare} from '../action_creators';
import {
    parseQueryString, getShareWarning, getEntryWarning,
    ErrorAlert, InfoAlert, LoadingIndicator,
    ViewCount, SharePanel} from './common.jsx';
import {FilterModal, FilterBar, filterBgColor} from './Filter.jsx';
import {
    showErrorModal, showInfoModal, showConfirmModal,
    showProgressModal, hideProgressModal,
    SharePublicLinkModal, ShareEmbedModal, ShareBlockedModal,
    ExportAuthModal, ExportModal, FsBadgeModal, WelcomeModal} from './Modals.jsx';
import {Tags} from './Tags.jsx';


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

        this.onShowMenu = (e) => {
            this.props.onShowMenu(e, this.props.award.id);
        }

        this.state = {};
    }

    render() {
        var award = this.props.award;

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
                    <ViewCount shares={award.shares} shareMap={this.props.shareMap} />
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
                    <div>
                        <SharePanel
                            id={award.id}
                            shares={award.shares}
                            shareMap={this.props.shareMap}
                            handleShare={this.props.onShare}
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
                            <i className="fa fa-trash"/> Trash
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
                    <li style={{padding:'8px 0'}}>
                        <a href='javascript:void(0)' onClick={props.onExport}>
                            <i className="fa fa-download" /> Export
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

        this.isOnline = (action, callback) => {
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

        this.showAllBadgesPopoverMenu = (e, id) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling
        
            this.setState({
                showAllBadgesMenu: !this.state.showAllBadgesMenu,
                showBadgeMenu: false,
                showUnpledgedMenu: false,
                showPledgeMenu: false,
                menuTarget: e.target,
                curAwardId: id
            });
        
        }
        
        this.showBadgePopoverMenu = (e, id) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            this.setState({
                showAllBadgesMenu: false,
                showBadgeMenu: !this.state.showBadgeMenu,
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
                showUnpledgedMenu: !this.state.showUnpledgedMenu,
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
                showPledgeMenu: !this.state.showPledgeMenu,
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

        this.uploadFile = this.uploadFile.bind(this);

        this.showGooglePicker = (e) => {
            this.setState({showAllBadgesMenu: false});
            
            this.isOnline('upload a badge', () => {
                this.googlePicker.onChoose(e);
            });
        }

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
        this.deleteShareConfirm = (shareId) => {
            var created_dt = this.props.shareMap.getIn([shareId, 'created_dt']);

            showConfirmModal(
                "Do you want to delete the share you created on "+moment(created_dt).format('MM/DD/YYYY')+"?",
                this.deleteShare.bind(this, shareId)
            );
        }

        this.deleteShare = (shareId) => {
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

        this.handleShare = (id, shareType, shareId) => {
            var award = this.props.awardMap.get(id);

            if(shareId) {
                switch(shareType) {
                    case 'type_link':
                        var shareUrl = this.props.shareMap.getIn([shareId, 'url']);
                        SharePublicLinkModal.show(shareId, shareUrl);
                        break;

                    case 'type_embed':
                        var shareUrl = this.props.shareMap.getIn([shareId, 'url']);
                        ShareEmbedModal.show(shareId, shareUrl+'?embed=1');
                        break;

                    default:
                        this.deleteShareConfirm(shareId);
                        break;
                }
            } else {
                fetchPostJSON(constants.API_ROOT+'share/', {
                    content_type: 'award',
                    object_id: id,
                    type: shareType
                })
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(addShare(json));
                    this.handlePostShare(award, json.url, shareType);
                })
                .catch((error) => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to share a badge.';
                    }
                    showErrorModal('Error Creating Share', error);
                });
            }
        }

        this.handlePostShare = (award, shareUrl, shareType) => {
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
                    var badge_name = award.get('badge_name');
                    openService = 'Twitter';
                    openURL = 'https://twitter.com/intent/tweet?text='+encodeURIComponent(badge_name+' '+shareUrl);
                    break;

                case 'type_pinterest':
                    var badge_image = award.get('badge_image');
                    var url = encodeURIComponent(shareUrl);
                    var media = encodeURIComponent(badge_image);
                    openService = 'Pinterest';
                    openURL = 'https://pinterest.com/pin/create/button/'+'?url='+url+'&media='+media+'&description=';
                    break;

                case 'type_googleplus':
                    openService = 'Google Plus';
                    openURL = 'https://plus.google.com/share?url='+encodeURIComponent(shareUrl);
                    break;

                case 'type_linkedin':
                    var badge_name = award.get('badge_name');
                    var url = encodeURIComponent(shareUrl);
                    var title = encodeURIComponent(badge_name);

                    openService = 'LinkedIn';
                    openURL = 'https://www.linkedin.com/shareArticle?mini=true&url='+url+'&title='+title+'&summary=&source=';
                    break;
            }

            var newWindow = window.open(openURL, '_blank', 'width=600,height=600');

            if (newWindow == null || typeof(newWindow) == 'undefined') {
                ShareBlockedModal.show(openService, openURL);
            }
        }

// Export
        this.onExport = (e) => {
            this.setState({showBadgeMenu: false});

            ExportModal.show(
                this.state.curAwardId,
                this.props.awardMap.getIn([this.state.curAwardId, 'badge_name'])
            );
        }

        this.handleExportDownload = (id) => {
            fetchGetJSON(constants.API_ROOT+'me/test/')
                .then((unused) => {
                    location.href =  constants.SERVER_ROOT+'assertion/'+id+'/download/';
                })
                .catch((error) => {
                    showErrorModal(
                        'Error Exporting Badge',
                        'You must be online to download a badge.'
                    );
                });
        }

        this.handleExportDropbox = (id) => {
            showProgressModal('Sending Badge to Dropbox');

            fetchGetJSON(constants.API_ROOT+'award/'+id+'/export_dropbox/')
                .then((json) => {
                    console.debug('success', json);
                    hideProgressModal();
                    showInfoModal('Success!', 'Your badge has been exported to Dropbox.');
                })
                .catch((error) => {
                    console.error('error', error);
                    hideProgressModal();

                    if(error.status == 403) {
                        ExportAuthModal.show(constants.AUTH.service.Dropbox, id);
                    } else {
                        if(error instanceof TypeError) {
                            error = 'You must be online to export a badge.';
                        }
                        showErrorModal('Error Archiving Badge', error);
                    }
                });
        }

        this.handleExportGoogleDrive = (id) => {
            showProgressModal('Sending Badge to Google Drive');

            fetchGetJSON(constants.API_ROOT+'award/'+id+'/export_googledrive/')
                .then((json) => {
                    console.debug('success', json);
                    hideProgressModal();
                    showInfoModal('Success!', 'Your badge has been exported to Google Drive.');
                })
                .catch((error) => {
                    console.error('error', error);
                    hideProgressModal();

                    if(error.status == 403) {
                        ExportAuthModal.show(constants.AUTH.service.GoogleDrive, id);
                    } else {
                        if(error instanceof TypeError) {
                            error = 'You must be online to export a badge.';
                        }
                        showErrorModal('Error Archiving Badge', error);
                    }
                });
        }

        this.handleExportOneDrive = (id) => {
            showProgressModal('Sending Badge to OneDrive');

            fetchGetJSON(constants.API_ROOT+'award/'+id+'/export_onedrive/')
                .then((json) => {
                    console.debug('success', json);
                    hideProgressModal();
                    showInfoModal('Success!', 'Your badge has been exported to OneDrive.');
                })
                .catch((error) => {
                    console.error('error', error);
                    hideProgressModal();

                    if(error.status == 403) {
                        ExportAuthModal.show(constants.AUTH.service.OneDrive, id);
                    } else {
                        if(error instanceof TypeError) {
                            error = 'You must be online to export a badge.';
                        }
                        showErrorModal('Error Archiving Badge', error);
                    }
                });
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
            var id = this.props.awardMap.getIn([this.state.curAwardId, 'entry']);
            
            fetchDeleteJSON(constants.API_ROOT+'entry/'+id+'/')
                .then(json => {
                    this.props.dispatch(deleteEntry(id));
                })
                .catch(error => {
                    console.error('error deleting pledge', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to delete a pledge.';
                    }
                    showErrorModal('Error Deleting Pledge', error);
                });
        }

        this.trashAward = (confirm) => {
            var id = this.state.curAwardId;
            var shares = this.props.awardMap.getIn([id, 'shares']);

            fetchDeleteJSON(constants.API_ROOT+'award/'+id+'/')
                .then(json => {
                    this.props.dispatch(deleteAward(id));
                })
                .catch(error => {
                    console.error('error deleting award', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to delete a badge.';
                    }
                    showErrorModal('Error Deleting Badge', error);
                });
        }

// Tags (called from BadgeListItem)
        this.saveTags = (awardId, value) => {
            fetchPostJSON(constants.API_ROOT+'award/'+awardId+'/tags/', value)
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(updateAwardTags(awardId, json.tags));
                })
                .catch((error) => {
                    console.log('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to modify tags.'
                    }
                    showErrorModal('Error Saving tags', error);
                });
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
        
        var filterShared = isShared || wasShared || neverShared;

        var awardMap = props.awardMap;
        var shareMap = props.shareMap;
        
        return props.awardList.filter(function(itemId) {
            var item = awardMap.get(itemId);
            var issued_date = item.get('issued_date');

            if(item.get('is_deleted')) {
                return false;
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
                      
            return true;
        }, this);
    }

    componentDidMount() {
        var params = parseQueryString(this.props.location.search);

        // Clear any params
        this.props.history.replace(this.props.history.location.pathname);

        // Check for post-auth params
        if(params.oa) {
            if(params.err) {
                // Report error
                var name = '<unknown service>';

                switch(params.oa) {
                    case 'db': name = 'Dropbox'; break;
                    case 'gd': name = 'Google Drive'; break;
                    case 'od': name = 'OneDrive'; break;
                }

                showErrorModal(null, 'We were unable to send your badge to '+name);
            } else {
                // Resume export
                switch(params.oa) {
                    case 'db': this.handleExportDropbox(params.id); break;
                    case 'gd': this.handleExportGoogleDrive(params.id); break;
                    case 'od': this.handleExportOneDrive(params.id); break;
                }
            }
        } else if(this.props.user.get('is_new')) {
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
                    console.error('error', error);
                    this.fileInputForm.reset();                   
                    
                    if(error instanceof TypeError) {
                        error = 'You must be online to upload a badge.';
                    } else {
                        // standard error message only
                        error = 'Unable to upload your badge.  '
                              + 'Please verify that it is an Open Badge and that '
                              + 'the email address associated with the badge has been added to your account.';                              
                    }
                    
                    hideProgressModal();
                    showErrorModal('Error Uploading Badge', error);
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
                     if(error instanceof TypeError) {
                        error = 'You must be online to upload a badge.';
                    } else {
                        // standard error message only
                        error = 'Unable to upload your badge.  '
                              + 'Please verify that it is an Open Badge and that '
                              + 'the email address associated with the badge has been added to your account.';                              
                    }
                    
                    hideProgressModal();
                    showErrorModal('Error Uploading Badge', error);
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
                self.isOnline('upload a file', () => {
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
                    <div className="pull-right filterBarMenuTrigger" style={{
                        marginTop:'9px'
                    }}>
                        <a href="javascript:void(0)" onClick={this.showAllBadgesPopoverMenu}>
                            <span className="glyphicon glyphicon-option-vertical" style={{
                                color: '#000000',
                                fontSize: '16px'                                
                            }}>
                            </span>
                        </a>
                    </div>
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
                <input ref={(el) => {this.fileInput = el;}} type="file" accept="image/png, image/svg+xml" style={{display: 'none'}}
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

            <SharePublicLinkModal onDelete={this.deleteShareConfirm} />
            <ShareEmbedModal onDelete={this.deleteShareConfirm} />
            <ShareBlockedModal />

            <ExportAuthModal />

            <ExportModal
                handleDownload={this.handleExportDownload}
                handleDropbox={this.handleExportDropbox}
                handleGoogleDrive={this.handleExportGoogleDrive}
                handleOneDrive={this.handleExportOneDrive}
            />

            <FsBadgeModal />
            <WelcomeModal />

            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
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
