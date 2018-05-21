import React from 'react';
import ReactDOM from 'react-dom';
import {Link, withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import uuid from 'uuid-random';
import moment from 'moment';
import * as constants from '../constants';
import {
    isOnline, isImageAttachment, getAttachmentIcon, getShareWarning, 
    ErrorAlert, SharePanel
} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    addEntry, updateEntryTags, deleteEntry, setIsOffline
} from '../action_creators';
import {
    showErrorModal, showInfoModal, showConfirmModal, showImageModal
} from './Modals.jsx';
import {Tags} from './Tags.jsx';
import {Sharer} from './Sharer.jsx'


class _EntryView extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            entry: props.entryMap.get(props.match.params.entryId, Map()).toJS()
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

// Edit
        this.editEntry = (e) => {
            this.props.history.push('/entry/edit/'+this.state.entry.id);
        }
        
// Copy
        this.copyEntryOffline = () => {
            var sections = this.state.entry.sections.map(function(section, i) {
                var attachments = section.attachments.map(function(attachment, j) {
                    if(attachment.file) {
                        // file-based, must have been synced
                        return {
                            label: attachment.label,
                            copy: attachment.id,                                
                            data_uri: attachment.data_uri
                        };
                    } else if(attachment.award) {
                        // award-based
                        return {
                            label: attachment.label,
                            award: attachment.award
                        };
                    } else if(attachment.id) {
                        // hyperlink-based
                        return {
                            label: attachment.label,
                            hyperlink: attachment.hyperlink
                        };         
                    } else {
                        // unsynced attachment, must have hyperlink or data-uri
                        return {
                            label: attachment.label,
                            hyperlink: attachment.hyperlink,
                            data_uri: attachment.data_uri,
                            fileSize: attachment.fileSize || 0
                        };
                    }       
                });
                
                return {
                    title: section.title+' (Copy)',
                    text: section.text,
                    attachments: attachments     
                };
            });
            
            var entry = {
                id: uuid(),
                shares: [],
                tags: this.state.entry.tags,
                sections: sections,
                created_dt: moment.utc().format()
            }
            
            this.props.dispatch(addEntry(entry));
            this.props.history.push('/entry/view/'+entry.id+'/');  
        }

        this.copyEntry = (e) => {
            var self = this;

            if(this.props.isOffline) {
                this.copyEntryOffline();
            } else {
                fetchPostJSON(constants.API_ROOT+'entry/'+this.state.entry.id+'/copy/')
                    .then((json) => {
                        console.debug('success', json);
                        this.props.dispatch(addEntry(json));
                        this.props.history.push('/entry/view/'+json.id+'/');
                    }).catch((error) => {
                        console.error('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to copy entry.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.copyEntryOffline();
                                }
                            );                        
                        } else {
                            showErrorModal('Error Copying Entry', error);
                        }
                    });
            }  
        }

// Trash
        this.trashEntryConfirm = (e) => {
            // Compose warnings
            var shareWarning = getShareWarning(
                'entry', 
                this.props.entryMap.getIn([this.state.entry.id, 'shares']),
                this.props.shareMap
            );
            
            showConfirmModal(
                'Are you sure you want to delete this entry?'+shareWarning,
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
                                'Unable to delete entry.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(deleteEntry(id));
                                    self.props.history.goBack();
                                }
                            );                        
                        } else {
                            showErrorModal('Error Deleting Entry', error);
                        }
                    });
            }
        }

// Share
        this.handleShare = (id, shareType, shareId) => {
            if(shareId) {
                this.sharer.viewShare(shareId);
            } else if(this.props.isOffline) {
                showErrorModal('Offline Mode', 'You must be online to share an entry.');
            } else {
                this.sharer.createShare(shareType, this.state.entry);
            }
        }

// Tags
        this.saveTags = (value) => {
            var self = this;
            var id = this.state.entry.id;

            if(this.props.isOffline) {
                this.props.dispatch(updateEntryTags(id, value.toJSON().sort()));
            } else {
                fetchPostJSON(constants.API_ROOT+'entry/'+id+'/tags/', value)
                    .then((json) => {
                        console.debug('success', json);
                        this.props.dispatch(updateEntryTags(id, json.tags));
                    })
                    .catch((error) => {
                        console.log('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to update tags.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(updateEntryTags(id, value.toJSON().sort()));                         
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
        if((this.props.match.params.entryId != nextProps.match.params.entryId)
        || (this.props.entryMap != nextProps.entryMap)) {
            this.setState({
                entry: nextProps.entryMap.get(nextProps.match.params.entryId, Map()).toJS()
            });
        }
    }

    render() {
        var entry = this.state.entry;

        // Handle post-delete render
        if(!entry.id) {
            return null;
        }

        return (
            <span>

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
                    fontSize: '1.1em'
                }}>
                    <a href="javascript:void(0)" onClick={this.editEntry}>
                        <i className="fa fa-pencil" aria-hidden="true" /> Edit
                    </a>
                    &nbsp;&nbsp;&nbsp;
                    <a href="javascript:void(0)" onClick={this.copyEntry}>
                        <i className="fa fa-clone" aria-hidden="true" /> Copy
                    </a>
                    &nbsp;&nbsp;&nbsp;
                    <a href="javascript:void(0)" onClick={this.trashEntryConfirm}>
                        <i className="fa fa-trash" aria-hidden="true" /> Remove
                    </a>
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    <SharePanel
                        id={entry.id}
                        shares={entry.shares}
                        shareMap={this.props.shareMap}
                        handleShare={this.handleShare}
                        isOffline={this.props.isOffline}
                        isInvalid={false}
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    <Tags
                        attrs={null}
                        value={Set(entry.tags)}
                        maxTags={10}
                        minTags={0}
                        onChange={this.saveTags}
                    />
                </div>
            </div>

            <Sharer ref={(el) => {this.sharer = el;}}
                contentType='entry' 
                dispatch={this.props.dispatch} 
                shareMap={this.props.shareMap} 
                isOffline={this.props.isOffline}
            />
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
        entryMap: state.getIn(['entries', 'itemsById'], new Map()),
        shareMap: state.getIn(['shares', 'itemsById'], new Map())
    };
}

export const EntryView = connect(mapStateToProps)(_EntryView);
