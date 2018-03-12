import React from 'react';
import ReactDOM from 'react-dom';
import {Link, withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import moment from 'moment';
import * as constants from '../constants';
import {getAttachmentIcon, getShareWarning, ErrorAlert, SharePanel} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    updateEntryTags, addEntry, deleteEntry,
    addShare, deleteShare} from '../action_creators';
import {
    showErrorModal, showInfoModal, showConfirmModal,
    SharePublicLinkModal, ShareEmbedModal, ShareBlockedModal} from './Modals.jsx';
import {Tags} from './Tags.jsx';


class _EntryView extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            entry: props.entryMap.get(props.match.params.entryId, Map()).toJS()
        };

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

        this.getAttachmentIcon = (attachment) => {
            if(attachment.award) {
                var award = this.props.awardMap.get(attachment.award);
                return (
                    <img src={award.get('badge_image_data_uri')} height="70" />
                );
            }

            if(attachment.data_uri) {
                return (
                    <img src={attachment.data_uri} height="70" />
                );
            }

            return getAttachmentIcon(attachment.file, attachment.label, 70, 'fa-5x');
        }

// Edit
        this.editEntry = (e) => {
            this.isOnline('edit an entry', () => {
                this.props.history.push('/entry/edit/'+this.state.entry.id);
            });
        }
        
// Copy
        this.copyEntry = (e) => {
            fetchPostJSON(constants.API_ROOT+'entry/'+this.state.entry.id+'/copy/')
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(addEntry(json));
                    this.props.history.push('/entry/view/'+json.id+'/');
                }).catch((error) => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to copy an entry.';
                    }
                    showErrorModal('Error Copying Entry', error);
                });
          
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
            var id = this.state.entry.id;

            fetchDeleteJSON(constants.API_ROOT+'entry/'+id+'/')
                .then(json => {
                    this.props.dispatch(deleteEntry(id));
                    this.props.history.goBack();
                })
                .catch(error => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to delete an entry.';
                    }
                    showErrorModal('Error Deleting Entry', error);
                });
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
                    content_type: 'entry',
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
                        error = 'You must be online to share an entry.';
                    }
                    showErrorModal('Error Creating Share', error);
                });
            }
        }

        this.handlePostShare = (shareUrl, shareType) => {
            var section = this.state.entry.sections[0];
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
                    var title = section.title;
                    openService = 'Twitter';
                    openURL = 'https://twitter.com/intent/tweet?text='+encodeURIComponent(title+' '+shareUrl);
                    break;

                case 'type_pinterest':
                    var media_url;

                    if(/\/$/.test(constants.APP_ROOT)) {
                        media_url = constants.APP_ROOT+'img/ePortfolioPinterestImage.png';
                    } else {
                        media_url = constants.APP_ROOT+'/img/ePortfolioPinterestImage.png';
                    }

                    var url = encodeURIComponent(shareUrl);
                    var media = encodeURIComponent(media_url);

                    openService = 'Pinterest';
                    openURL = 'https://pinterest.com/pin/create/button/'+'?url='+url+'&media='+media+'&description=';
                    break;

                case 'type_googleplus':
                    openService = 'Google Plus';
                    openURL = 'https://plus.google.com/share?url='+encodeURIComponent(shareUrl);
                    break;

                case 'type_linkedin':
                    var url = encodeURIComponent(shareUrl);
                    var title = encodeURIComponent(section.title);

                    openService = 'LinkedIn';
                    openURL = 'https://www.linkedin.com/shareArticle?mini=true&url='+url+'&title='+title+'&summary=&source=';
                    break;
            }

            var newWindow = window.open(openURL, '_blank', 'width=600,height=600');

            if (newWindow == null || typeof(newWindow) == 'undefined') {
                ShareBlockedModal.show(openService, openURL);
            }
        }

// Tags
        this.saveTags = (value) => {
            var id = this.state.entry.id;

            fetchPostJSON(constants.API_ROOT+'entry/'+id+'/tags/', value)
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(updateEntryTags(id, json.tags));
                })
                .catch((error) => {
                    console.log('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to modify tags.'
                    }
                    showErrorModal('Error Saving tags', error);
                });
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
                                    <a target="_blank" href={attachment.hyperlink} title={attachment.label}>
                                    {this.getAttachmentIcon(attachment)}
                                    </a>
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
                        <i className="fa fa-pencil"/> Edit
                    </a>
                    &nbsp;&nbsp;&nbsp;
                    <a href="javascript:void(0)" onClick={this.copyEntry}>
                        <i className="fa fa-clone"/> Copy
                    </a>
                    &nbsp;&nbsp;&nbsp;
                    <a href="javascript:void(0)" onClick={this.trashEntryConfirm}>
                        <i className="fa fa-trash"/> Trash
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

            <SharePublicLinkModal onDelete={this.deleteShareConfirm} />
            <ShareEmbedModal onDelete={this.deleteShareConfirm} />
            <ShareBlockedModal />
            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        user: state.get('user', new Map()),
        tags: state.get('tags', List()).get(constants.TAG_TYPE.Entry) || List(),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        awardList: state.getIn(['awards', 'items'], new List()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map()),
        shareMap: state.getIn(['shares', 'itemsById'], new Map())
    };
}

export const EntryView = connect(mapStateToProps)(_EntryView);
