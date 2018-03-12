import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import moment from 'moment';
import * as constants from '../constants';
import {
    parseQueryString, getAttachmentIcon, getShareWarning, getEntryWarning, 
    SharePanel
} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    updateAwardTags, deleteAward,
    addShare, deleteShare} from '../action_creators';
import {
    showErrorModal, showInfoModal, showConfirmModal,
    showProgressModal, hideProgressModal,
    SharePublicLinkModal, ShareEmbedModal, ShareBlockedModal,
    ExportAuthModal, ExportModal} from './Modals.jsx';
import {Tags} from './Tags.jsx';


class _Badge extends React.Component {
    constructor(props) {
        super(props);
 
        this.state = {
            award: props.awardMap.get(props.match.params.awardId, Map()).toJS()
        };

        this.getEvidenceIcon = (evidence) => {
            return getAttachmentIcon(evidence.file, evidence.label, 70, 'fa-5x');
        }

// Pledge
        this.onPledge = (e) => {
            this.props.history.push('/pledge/edit/'+this.state.award.id);
        
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
                    this.handlePostShare(json.url, shareType);
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

        this.handlePostShare = (shareUrl, shareType) => {
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
                    var badge_name = this.state.award.badge_name;

                    openService = 'Twitter';
                    openURL = 'https://twitter.com/intent/tweet?text='+encodeURIComponent(badge_name+' '+shareUrl);
                    break;

                case 'type_pinterest':
                    var badge_image = this.state.award.badge_image;
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
                    var badge_name = this.state.award.badge_name;
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
            ExportModal.show(this.state.award.id, this.state.award.badge_name);
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
                        showErrorModal('Error Exporting Badge', error);
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
                        showErrorModal('Error Exporting Badge', error);
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
                        showErrorModal('Error Exporting Badge', error);
                    }
                });
        }


// Trash
        this.trashAwardConfirm = (e) => {
            // Compose warnings
            var shareWarning = getShareWarning(
                'badge', 
                this.props.awardMap.getIn([this.state.award.id, 'shares']),
                this.props.shareMap
            );
            
             var entryWarning = getEntryWarning(
                this.state.award.id,
                this.props.awardMap,
                this.props.entryList,
                this.props.entryMap
            );
           
            showConfirmModal(
                'Are you sure you want to delete this badge?'+shareWarning+entryWarning,
                this.trashAward
            );
        }

        this.trashAward = () => {
            var id = this.state.award.id;

            fetchDeleteJSON(constants.API_ROOT+'award/'+id+'/')
                .then(json => {
                    this.props.dispatch(deleteAward(id));
                    this.props.history.goBack();
                })
                .catch(error => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to delete a badge.';
                    }
                    showErrorModal('Error Deleting Badge', error);
                });
        }

// Tags
        this.saveTags = (value) => {
            var id = this.state.award.id;

            fetchPostJSON(constants.API_ROOT+'award/'+id+'/tags/', value)
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(updateAwardTags(id, json.tags));
                })
                .catch((error) => {
                    console.log('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to modify tags.'
                    }
                    showErrorModal('Error Saving tags', error);
                });
        }


        this.getEvidenceIcon = this.getEvidenceIcon.bind(this);
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
        }
    }

    componentWillReceiveProps(nextProps) {
        if(this.props.awardMap != nextProps.awardMap) {
            this.setState({
                award: nextProps.awardMap.get(nextProps.match.params.awardId, Map()).toJS()
            });
        }
    }

    render() {
        var award = this.state.award;

        // Handle post-delete render
        if(!award.id) {
            return null;
        }
        
        return (
            <span>
            <div className="row" style={{padding: '20px 15px'}}>
                  <img className="badgeDetailsImage" src={award.badge_image_data_uri} />
                  <div className='badgeDetailColumn'>
                    <h3 style={{fontWeight: 400}}>{award.badge_name}</h3>
                    {(award.issued_date) ? (                    
                        <p>
                            Awarded to {award.student_name}<br />
                            Awarded on {moment(award.issued_date).format('MMMM Do, YYYY')}<br />
                            Awarded by <a href={award.issuer_org_url} target="_blank">{award.issuer_org_name}</a>
                        </p>
                    ) : (
                        <p>
                            Not Pledged yet<br />
                            Pledging through {award.issuer_org_name}
                        </p>
                    )}
                    <p>
                        {(award.issued_date) ? (
                            <a href="javascript:void(0)" onClick={this.onExport} style={{
                                marginRight: '10px'
                            }}>
                                <i className="fa fa-download" /> Export
                            </a>
                            
                        ) : null}
                        <a href="javascript:void(0)"
                            onClick={this.trashAwardConfirm}>
                            <i className="fa fa-trash"/> Trash
                        </a>
                    </p>
                  </div>
            </div>
            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    {(award.issued_date) ? (
                        <SharePanel
                            id={award.id}
                            shares={award.shares}
                            shareMap={this.props.shareMap}
                            handleShare={this.handleShare}
                        />
                    ) : (
                        <button className="btn btn-primary btn-raised" onClick={this.onPledge}>
                            Pledge
                        </button>
                    )}
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    <Tags
                        attrs={null}
                        value={Set(award.tags)}
                        maxTags={10}
                        minTags={0}
                        onChange={this.saveTags}
                    />
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    <p><b>Description</b>: {award.badge_description || 'n/a/'}</p>
                    <p><b>Criteria</b>: {award.badge_criteria || 'n/a'}</p>
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12 clearfix" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    {(award.evidence.length) ? (
                        <p><b>Evidence:</b></p>              
                    ) : null}
                    {award.evidence.map(function(evidence, i) {  
                        if(evidence.file || evidence.hyperlink) {
                            return (
                                <span key={i} className="pull-left" style={{margin: '0 12px 12px 0'}}>
                                    <a href={evidence.file || evidence.hyperlink} title={evidence.label}>
                                        {this.getEvidenceIcon(evidence)}
                                    </a>
                                </span>
                            );
                        } 
                        
                        return null;
                    }, this)}
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12">            
                    {award.evidence.map(function(evidence, i) {                        
                        if(!(evidence.file || evidence.hyperlink) && evidence.description) {
                            return (
                                <p key={i}>
                                {evidence.description.split("\n").map(function(line, j) {
                                    line = urlize(line, {target:'_blank'});
                                    return (
                                        <p key={j} dangerouslySetInnerHTML={{__html: line}}></p>
                                    );                            
                                })}
                                </p>
                            );
                         } 
                        
                        return null;
                    }, this)}
                </div>
            </div>

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

            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        user: state.get('user', new Map()),
        tags: state.get('tags', List()).get(constants.TAG_TYPE.Award) || List(),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        entryList: state.getIn(['entries', 'items'], new List()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map()),
        shareMap: state.getIn(['shares', 'itemsById'], new Map())
    };
}

export const Badge = connect(mapStateToProps)(_Badge);
