import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import moment from 'moment';
import * as constants from '../constants';
import {
    dispatchCustomEvent, parseQueryString, isOnline, downloadAttachment, 
    isImageAttachment, getAttachmentIcon, isAwardExpired, 
    LoadingIndicator, getShareWarning, getEntryWarning, SharePanel
} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    updateAwardStatus, updateAwardTags, deleteAward, setIsOffline
} from '../action_creators';
import {
    Modal, showErrorModal, showInfoModal, showConfirmModal, showProgressModal, 
    hideProgressModal, showImageModal
} from './Modals.jsx';
import {Tags} from './Tags.jsx';
import {Exporter} from './Exporter.jsx'
import {Sharer} from './Sharer.jsx'

class EndorsementModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showEndorsementModal';
    }

    renderContent() {
        var info = (
            <span>
            <p>Website: <a href={this.state.issuer_url} target="_blank">{this.state.issuer_url}</a></p>
            {(this.state.issuer_email) ? (
                <p>Email: <a href={"mailto:"+this.state.issuer_email}>{this.state.issuer_email}</a></p>                        
            ) : null}
            </span>
        );
        
        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 className="modal-title">{this.state.issuer_name}</h4>
                </div>
                <div className="modal-body">
                {(this.state.issuer_image_data_uri) ? (
                    <div className="row">
                        <div className="col-xs-12 col-sm-4" style={{
                            display:'inline-block', verticalAlign:'middle', float:'none'
                        }}>
                           <img className="img-responsive" src={this.state.issuer_image_data_uri} />                       
                         </div>
                        <div className="col-xs-12 col-sm-8" style={{
                            display:'inline-block', verticalAlign:'middle', float:'none'
                        }}>
                            {info}
                        </div>
                    </div>
                ) : (
                    <div className="row">
                        <div className="col-xs-12" style={{
                            display:'inline-block', verticalAlign:'middle', float:'none'
                        }}>
                            {info}
                        </div>   
                    </div>             
                )}
                </div>                    
            </div>
        );
    }
}

EndorsementModal.show = function(endorsement) {    
    dispatchCustomEvent('showEndorsementModal', {
        issuer_name: endorsement.issuer_name,
        issuer_url: endorsement.issuer_url,
        issuer_email: endorsement.issuer_email,
        issuer_image_data_uri: endorsement.issuer_image_data_uri
    });
}

class _Badge extends React.Component {
    constructor(props) {
        super(props);
 
        this.state = {
            verifying: true,    // whether or not we are verifying the award
            isVerified: false,  // whether or not the verification succeeded
            award: props.awardMap.get(props.match.params.awardId, Map()).toJS()
        };

// Evidence
        this.onClickEvidence = (evidence, isImage) => {
            if(!isImage) {
                showErrorModal('Offline Mode', 'You must be online to view this evidence.');
            } else if(this.props.isOffline) {
                showImageModal(evidence.label, evidence.data_uri);
            } else {
                showImageModal(evidence.label, evidence.file || evidence.hyperlink);            
            }
        }

        this.getEvidenceIcon = (evidence) => {
            return getAttachmentIcon(evidence, null, 70, 'fa-5x');
        }
        
        this.getEvidenceLink = (evidence) => {
            var isImage = isImageAttachment(evidence);
            
            if(this.props.isOffline) {
                // Pass all non-downloads to click handler
                if(evidence.id 
                || (window.navigator.standalone && !isImage))
                {
                    return (
                        <a href="javascript:void(0);" title={evidence.label} 
                            onClick={(e) => { this.onClickEvidence(evidence, false); }}>
                            {this.getEvidenceIcon(evidence)}
                        </a>
                    );
                } else if(isImage) {
                    return (
                        <a href="javascript:void(0);" title={evidence.label} 
                            onClick={(e) => { this.onClickEvidence(evidence, true); }}>
                            {this.getEvidenceIcon(evidence)}
                        </a>
                    );
                } else {
                    return (
                        <a href={evidence.file || evidence.hyperlink} download={evidence.label} target="_blank">
                            {this.getEvidenceIcon(evidence)}
                        </a>
                    );
                }
            } else {
                // Pass all non-direct views to click handler
                if(isImage) {
                    return (
                        <a href="javascript:void(0);" title={evidence.label} 
                            onClick={(e) => { this.onClickEvidence(evidence, true); }}>
                            {this.getEvidenceIcon(evidence)}
                        </a>
                    );
                } else {
                    return (
                        <a href={evidence.file || evidence.hyperlink} title={evidence.label} target="_blank">
                            {this.getEvidenceIcon(evidence)}
                        </a>
                    );
                }         
            }
        }

// Pledge
        this.onPledge = (e) => {
            this.props.history.push('/pledge/edit/'+this.state.award.id);        
        }
                 
// Share
        this.handleShare = (id, shareType, shareId) => {
            if(shareId) {
                this.sharer.viewShare(shareId);
            } else if(this.state.award.revoked) {
                showErrorModal('Error Creating Share', 'You may not share revoked badges.');  
            } else if(isAwardExpired(this.state.award)) {
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
                                this.sharer.createShare(shareType, this.state.award); 
                            }
                        })
                        .catch((error) => {
                            console.error('error', error);
                            hideProgressModal();
                            
                            // Allow share if was verified at some point
                            if(this.state.award.verified_dt) {
                                this.sharer.createShare(shareType, this.state.award);
                            } else {
                                showErrorModal('Error Creating Share', 'Unable to verify your badge.');
                            }
                        });  
                });         
            }
        }

// Export
        this.onExport = (e) => {
            this.exporter.beginExport(this.state.award.id, this.state.award.badge_name);
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
            var self = this;
            var id = this.state.award.id;

            if(this.props.isOffline) {
                this.props.dispatch(deleteAward(id));  
                this.props.history.goBack(); 
            } else {
                fetchDeleteJSON(constants.API_ROOT+'award/'+id+'/')
                    .then(json => {
                        this.props.dispatch(deleteAward(id));
                        this.props.history.goBack();
                    })
                    .catch(error => {
                        console.error('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to delete badge.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(deleteAward(id));
                                    self.props.history.goBack();                     
                                }
                            );                        
                        } else {
                            showErrorModal('Error Deleting Badge', error);
                        }
                    });
            }
        }

// Tags
        this.saveTags = (value) => {
            var self = this;
            var id = this.state.award.id;
            
            if(this.props.isOffline) {
                this.props.dispatch(updateAwardTags(id, value.toJSON().sort()));
            } else {
                fetchPostJSON(constants.API_ROOT+'award/'+id+'/tags/', value)
                    .then((json) => {
                        console.debug('success', json);
                        this.props.dispatch(updateAwardTags(id, json.tags));
                    })
                    .catch((error) => {
                        console.log('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to update tags.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(updateAwardTags(id, value.toJSON().sort()));                        
                                }
                            );                        
                        } else {
                            showErrorModal('Error Saving Tags', error);
                        }
                    });
            }
        }
    }

    componentDidMount() {
        if(this.exporter.handleQueryString(this.props))  { 
            // Re-routing back from export 
            this.setState({verifying: false, isVerified: true}); 
        } else if(this.state.verifying) {
            var award = this.props.awardMap.get(this.props.match.params.awardId, Map()).toJS();
             
            if(award.id) {
                if(award.revoked || !award.issued_date) {
                    this.setState({verifying: false, isVerified: true});                
                } else {    
                    var isVerified = false;
                    
                    if(award.verified_dt) {
                        var minVerified = moment.utc().subtract(7, 'days').format();
                        var lastVerified = moment.utc(award.verified_dt).format();
                        
                        isVerified = lastVerified >= minVerified;
                    }
                    
                    if(isVerified) {
                        this.setState({verifying: false, isVerified: true});    
                    } else {     
                         fetchGetJSON(constants.API_ROOT+'award/'+award.id+'/verify/')
                            .then((json) => {
                                console.debug('success', json);   

                                this.props.dispatch(updateAwardStatus(
                                    award.id, json.verified_dt, json.revoked, json.revoked_reason
                                ));
                                
                                this.setState({verifying: false, isVerified: true});
                            })
                            .catch((error) => {
                                console.error('error', error);
                                this.setState({verifying: false, isVerified: false});
                            });   
                    }
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
        var awardStatus = null;
        
        // Handle post-delete render
        if(!award.id) {
            return null;
        }
        
        if(this.state.verifying) {
            return (
                <span>
                <LoadingIndicator />
                <Exporter ref={(el) => {this.exporter = el;}} />
                </span>
            );
        }
        
        if(award.issued_date) {
            if(award.revoked) {
                awardStatus = (
                    <span className="text-danger">
                    <br/>Badge Was Revoked {(award.revoked_reason) ? ': '+award.revoked_reason : ''}
                    </span>
                );
            } else if(isAwardExpired(award)) {
                awardStatus = (
                    <span className="text-danger">
                    <br/>Badge expired on {moment(award.expiration_date).format('MMMM Do, YYYY')}
                    </span>
                );
            } else if(award.verified_dt) {
                awardStatus = (
                    <span>
                    <br/>Last verified on {moment.utc(award.verified_dt).local().format('MMMM Do, YYYY')}
                    </span>
                );
            } else {
                awardStatus = (
                    <span className="text-danger">
                    <br/>Cannot verify badge
                    </span>
                );
            }            
        }
                
        return (
            <span>
            <div className="row" style={{padding: '20px 15px'}}>
                  <img className="badgeDetailsImage" src={award.badge_image_data_uri} />
                  <div className='badgeDetailColumn'>
                    <h3 style={{fontWeight: 400}}>{award.badge_name}</h3>
                    {(award.issued_date) ? (
                        <p>  
                            Awarded to {award.student_name}<br/>
                            Awarded on {moment(award.issued_date).format('MMMM Do, YYYY')}<br />
                            Awarded by <a href={award.issuer_org_url} target="_blank">{award.issuer_org_name}</a>
                            {awardStatus}
                        </p>
                    ) : (
                        <p>
                            Not Pledged yet<br />
                            Pledging through {award.issuer_org_name}
                        </p>
                    )}
                    <p>
                        {(award.issued_date && !this.props.isOffline) ? (
                            <a href="javascript:void(0)" onClick={this.onExport} style={{
                                marginRight: '10px'
                            }}>
                                <i className="fa fa-download" /> Export
                            </a>
                            
                        ) : null}
                        <a href="javascript:void(0)"
                            onClick={this.trashAwardConfirm}>
                            <i className="fa fa-trash"/> Remove
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
                            isOffline={this.props.isOffline}
                            isInvalid={award.revoked || isAwardExpired(award)}
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
                {(award.endorsements.length) ? (
                    <p><b>Endorsed By</b>: {award.endorsements.map(function(d, i) {
                        return (
                            <span key={i}>
                            {(i > 0) ? ', ' : ''}
                            <a href="javascript:void(0);" onClick={(e) => EndorsementModal.show(d)}>{d.issuer_name}</a>
                            </span>
                        );
                    })}
                    </p>                
                ) : null}
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
                                    {this.getEvidenceLink(evidence)}
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

            <EndorsementModal />
            
            <Sharer ref={(el) => {this.sharer = el;}}
                contentType='award' 
                dispatch={this.props.dispatch} 
                shareMap={this.props.shareMap} 
                isOffline={this.props.isOffline}
            />
            
            <Exporter ref={(el) => {this.exporter = el;}} />

            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        isOffline: state.get('isOffline', false),
        user: state.get('user', new Map()),
        tags: state.get('tags', List()).get(constants.TAG_TYPE.Award) || List(),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        entryList: state.getIn(['entries', 'items'], new List()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map()),
        shareMap: state.getIn(['shares', 'itemsById'], new Map())
    };
}

export const Badge = connect(mapStateToProps)(_Badge);
