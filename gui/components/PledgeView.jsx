import React from 'react';
import ReactDOM from 'react-dom';
import {Link, withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import moment from 'moment';
import * as constants from '../constants';
import {
    isOnline, isImageAttachment, getAttachmentIcon, ErrorAlert
} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    updateAwardTags, deleteEntry, setIsOffline
} from '../action_creators';
import {
    showErrorModal, showInfoModal, showConfirmModal, showImageModal
} from './Modals.jsx';
import {Tags} from './Tags.jsx';


class _PledgeView extends React.Component {
    constructor(props) {
        super(props);

        var award = props.awardMap.get(props.match.params.awardId, Map()).toJS();
        var entry = props.entryMap.get(award.entry, Map());
        
        this.state = {
            award: award,
            pledgeDate: entry.get('sections').last().get('updated_dt'),
            entry: entry.toJS(),
        };

// Attachments        
        this.onClickAttachment = (attachment, isImage) => {
            if(!isImage) {
                showErrorModal('Offline Mode', 'You must be online to view this attachment.');
            } else if(this.props.isOffline) {
                showImageModal(attachment.label, attachment.data_uri);
            } else {
                showImageModal(attachment.label, attachment.hyperlink);            
            }
        }

        this.getAttachmentIcon = (attachment) => {
            return getAttachmentIcon(
                attachment, this.props.awardMap.get(attachment.award), 70, 'fa-5x'
            );
        }

        this.getAttachmentLink = (attachment) => {
            var isImage = isImageAttachment(attachment);
            
            if(this.props.isOffline) {
                // Pass all non-downloads to click handler
                if(attachment.id       
                || !attachment.fileSize
                || (window.navigator.standalone && !isImage))
                {
                    return (
                        <a href="javascript:void(0);" title={attachment.label} 
                            onClick={(e) => { this.onClickAttachment(attachment, false); }}>
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                } else if(isImage) {
                    return (
                        <a href="javascript:void(0);" title={attachment.label} 
                            onClick={(e) => { this.onClickAttachment(attachment, true); }}>
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                } else {
                    return (
                        <a href={attachment.data_uri} download={attachment.label} target="_blank">
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                }
            } else {
                // Pass all non-direct views to click handler
                if(isImage) {
                    return (
                        <a href="javascript:void(0);" title={attachment.label} 
                            onClick={(e) => { this.onClickAttachment(attachment, true); }}>
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                } else {
                    return (
                        <a href={attachment.hyperlink} title={attachment.label} target="_blank">
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                }         
            }
        }

// (Re)pledge
        this.pledgeBadge = (e) => {
            this.props.history.push('/pledge/edit/'+this.state.award.id);        
        }

// Trash
        this.trashEntryConfirm = (e) => {
            showConfirmModal(
                'Are you sure you want to delete this pledge?',
                this.trashEntry
            );
        }

        this.trashEntry = () => {
            var self = this;
            var id = this.state.entry.id;

            if(this.props.isOffline) {
                this.props.dispatch(deleteEntry(id));
                this.props.history.goBack();
            } else {
                fetchDeleteJSON(constants.API_ROOT+'entry/'+id+'/')
                    .then(json => {
                        this.props.dispatch(deleteEntry(id));
                        this.props.history.goBack();
                    })
                    .catch(error => {
                        console.error('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to delete pledge.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(deleteEntry(id));
                                    self.props.history.goBack();
                                }
                            );                        
                        } else {
                            showErrorModal('Error Deleting Pledge', error);
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
                            showErrorModal('Error Saving tags', error);
                        }
                    });
            }
        }       
    }

    componentWillReceiveProps(nextProps) {
        if((this.props.match.params.awardId != nextProps.match.params.awardId)
        || (this.props.awardMap != nextProps.awardMap)
        || (this.props.entryMap != nextProps.entryMap)) {
            var award = nextProps.awardMap.get(nextProps.match.params.awardId, Map()).toJS();
            var entry = props.entryMap.get(award.entry, Map());

            // Handle post-delete props
            if(award.entry) {
                this.setState({
                    award: award,
                    pledgeDate: entry.get('sections').last().get('updated_dt'),
                    entry: entry.toJS()
                });
            }
        }
    }

    render() {
        var award = this.state.award;
        var entry = this.state.entry;

        // Handle post-delete render
        if(!entry) {
            return null;
        }

        return (
            <span>
            <div className="row" style={{padding: '20px 15px'}}>
                <img className="badgeDetailsImage" src={award.badge_image_data_uri} />
                <div className='badgeDetailColumn'>
                    <h3 style={{fontWeight: 400}}>{award.badge_name}</h3>                    
                    <div style={{
                        padding: '12px 0 0 0',
                        borderTop: '1px solid #efefef', 
                        borderBottom: '1px solid #efefef'
                    }}>
                        <p><b>Description</b>: {award.badge_description || 'n/a/'}</p>
                        <p><b>Criteria</b>: {award.badge_criteria || 'n/a'}</p>
                    </div>
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12">
                    <p>Pledged on {moment(this.state.pledgeDate).format('MMMM Do, YYYY')}</p>
                    <p>Pledging through {award.issuer_org_name}</p>
                </div>
            </div>
            {entry.sections.map(function(section, i) {
                return (
                    <span>
                    <div key={i} className="row">
                        <div className="col-xs-12"  style={{borderTop: '1px solid #efefef'}}>
                            <h3>{section.title}</h3>
                            <p>
                            {section.text.split("\n").map(function(line, j) {
                                line = urlize(line,{target:'_blank'});
                                return (
                                    <p key={j} dangerouslySetInnerHTML={{__html: line}}></p>
                                );
                            }, this)}
                            </p>
                        </div>
                    </div>
                    <div key={i+'_att'} className="row">
                        <div className="col-xs-12">
                        {section.attachments.map(function(attachment, j) {
                            return (
                                <span key={j} className="pull-left" style={{margin: '0 12px 12px 0'}}>
                                    {this.getAttachmentLink(attachment)}
                                </span>
                            );
                        }, this)}
                        </div>
                    </div>
                    </span>
                );
            }, this)}

            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    <button className="btn btn-primary btn-raised" onClick={this.pledgeBadge}>
                        Pledge
                    </button>
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
            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        isOffline: state.get('isOffline', false),
        user: state.get('user', new Map()),
        tags: state.get('tags', List()).get(constants.TAG_TYPE.Entry) || List(),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map())
    };
}

export const PledgeView = connect(mapStateToProps)(_PledgeView);
