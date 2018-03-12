import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {Link, withRouter} from 'react-router-dom';
import {List, Map, Set} from 'immutable';
import {Popover, Overlay} from 'react-bootstrap';
import Truncate from 'react-truncate';
import moment from 'moment';
import * as constants from '../constants';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    addEntry, updateEntryTags, deleteEntry,
    addShare, deleteShare} from '../action_creators';
import {
    getAttachmentIcon, getShareWarning, ErrorAlert, InfoAlert, LoadingIndicator,
    ViewCount, SharePanel
} from './common.jsx';
import {FilterModal, FilterBar} from './Filter.jsx';
import {
    showErrorModal, showInfoModal, showConfirmModal,
    SharePublicLinkModal, ShareEmbedModal, ShareBlockedModal} from './Modals.jsx';
import {Tags} from './Tags.jsx';

class PortfolioListItem extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.getAttachmentIcon = (attachment) => {
            if(attachment.award) {
                var award = this.props.awardMap.get(attachment.award);
                return (
                    <img src={award.get('badge_image_data_uri')} height="56" />
                );
            }

            if(attachment.data_uri) {
                return (
                    <img src={attachment.data_uri} height="56" />
                );
            }

            return getAttachmentIcon(attachment.file, attachment.label, 56, 'fa-4x');
        }

        this.saveTags = (value) => {
            this.props.onSaveTags(this.props.entry.id, value);
        }

        this.onClick = (e) => {
            this.props.onClick(this.props.entry.id);
        }

        this.onShowMenu = (e) => {
            this.props.onShowMenu(e, this.props.entry.id);
        }
    }

    render() {
        var entry = this.props.entry;
        var section = entry.sections[0];
        var attachments = null;

        if(section.attachments.length) {
            attachments = (
                <div className="clearfix" style={{padding: '6px 0'}}>
                {section.attachments.slice(0, 3).map(function(attachment, i) {
                    return (
                        <span className="pull-left" style={{marginRight: '6px'}}>
                            <a target="_blank" href={attachment.hyperlink} title={attachment.label}>
                            {this.getAttachmentIcon(attachment)}
                            </a>
                        </span>
                    );
                }, this)}
                {(section.attachments.length > 3) ? (
                    <span style={{lineHeight: '50px'}}>...</span>
                ) : null}
                </div>
            );
        }

        return (
            <div className="list-group-item" style={{
                position:'relative',
                padding:'10px 0',
                borderBottom:'1px solid rgba(0, 0, 0, 0.1)'
            }}>
                <div className="row-content" style={{width:'100%'}}>
                    <div className="action-secondary" style={{right: 0}}>
                        <a href="javascript:void(0)" onClick={this.onShowMenu}>
                            <span className="glyphicon glyphicon-option-vertical" style={{
                                color: '#009688',
                                fontSize: '28px'
                            }}>
                            </span>
                        </a>
                    </div>
                    <ViewCount shares={entry.shares} shareMap={this.props.shareMap} />
                    <p className="list-group-item-text">
                        <small>{moment(entry.created_dt).format('MMMM Do, YYYY')}</small>
                    </p>
                    <div className="list-group-item-heading" onClick={this.onClick} style={{
                        display: 'inline-block',
                        maxWidth: 'calc(100% - 80px)',
                        height: '32px',
                        marginBottom: 0,
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer'
                    }}>
                        {section.title}
                    </div>
                    <p className="list-group-item-text" onClick={this.onClick} style={{cursor: 'pointer'}}>
                        <Truncate lines={3}>
                            {section.text}
                        </Truncate>
                    </p>
                    {attachments}
                    <div>
                        <SharePanel
                            id={entry.id}
                            shares={entry.shares}
                            shareMap={this.props.shareMap}
                            handleShare={this.props.onShare}
                        />
                    </div>
                    <Tags
                        attrs={null}
                        value={Set(entry.tags)}
                        maxTags={10}
                        minTags={0}
                        onChange={this.saveTags}
                    />
                </div>
            </div>
        );
    }
}

class PortfolioPopoverMenu extends React.Component {
    render() {
        return (
             <Overlay {...this.props}>
                <Popover id="award-list-popover" style={{
                    background: '#fff',
                }}>
                    <ul className="list-unstyled" style={{marginBottom: 0}}>
                        <li style={{padding:'8px 0'}}>
                            <a href='javascript:void(0)' onClick={this.props.onView}>
                                <i className="fa fa-search" /> View
                            </a>
                        </li>
                        <li style={{padding:'8px 0'}}>
                            <a href='javascript:void(0)' onClick={this.props.onEdit}>
                                <i className="fa fa-pencil" /> Edit
                            </a>
                        </li>
                        <li style={{padding:'8px 0'}}>
                            <a href='javascript:void(0)' onClick={this.props.onCopy}>
                                <i className="fa fa-clone" /> Copy
                            </a>
                        </li>
                        <li style={{padding:'8px 0'}}>
                            <a href='javascript:void(0)' onClick={this.props.onTrash}>
                                <i className="fa fa-trash"/> Trash
                            </a>
                        </li>
                    </ul>
                </Popover>
            </Overlay>
        );
    }
}

class _Portfolio extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showMenu: false,
            menuTarget: null,
            curEntryId: '', // active entry for PortfolioPopoverMenu
            entryList: this.filterEntries(props)
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
        
        this.showPopoverMenu = (e, id) => {
            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            this.setState({
                showMenu: !this.state.showMenu,
                menuTarget: e.target,
                curEntryId: id
            });
        }

        // also used by PortfolioListItem
        this.viewEntry = (id) => {
            this.props.history.push('/entry/view/'+id);
        }

// Add
        this.addEntry = () => {
            this.isOnline('add an entry', () => {
                this.props.history.push('/entry/edit');            
            });
        }
        
// Edit
        this.editEntry = (id) => {
            this.setState({showMenu: false});
            
            this.isOnline('edit an entry', () => {
                this.props.history.push('/entry/edit/'+id);
            });
        }

// Copy
        this.copyEntry = (id) => {
            this.setState({showMenu: false});

            fetchPostJSON(constants.API_ROOT+'entry/'+id+'/copy/')
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(addEntry(json));
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
            this.setState({showMenu: false});
            
            // Compose warnings
            var shareWarning = getShareWarning(
                'entry', 
                this.props.entryMap.getIn([this.state.curEntryId, 'shares']),
                this.props.shareMap
            );
            
            showConfirmModal(
                'Are you sure you want to delete this entry?'+shareWarning,
                this.trashEntry
            );
        }

        this.trashEntry = (confirm) => {
            var id = this.state.curEntryId;
            var shares = this.props.entryMap.getIn([id, 'shares']);

            fetchDeleteJSON(constants.API_ROOT+'entry/'+id+'/')
                .then(json => {
                    this.props.dispatch(deleteEntry(id));
                })
                .catch(error => {
                    console.error('error deleting entry', error);
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
            var entry = this.props.entryMap.get(id);

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
                    this.handlePostShare(entry, json.url, shareType);
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

        this.handlePostShare = (entry, shareUrl, shareType) => {
            var section = entry.get('sections').first();
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
                    var title = section.get('title');
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
                    var title = encodeURIComponent(section.get('title'));

                    openService = 'LinkedIn';
                    openURL = 'https://www.linkedin.com/shareArticle?mini=true&url='+url+'&title='+title+'&summary=&source=';
                    break;
            }

            var newWindow = window.open(openURL, '_blank', 'width=600,height=600');

            if (newWindow == null || typeof(newWindow) == 'undefined') {
                ShareBlockedModal.show(openService, openURL);
            }
        }

// Tags (called from PortfolioListItem)
        this.saveTags = (entryId, value) => {
            fetchPostJSON(constants.API_ROOT+'entry/'+entryId+'/tags/', value)
                .then((json) => {
                    console.debug('success', json);
                    this.props.dispatch(updateEntryTags(entryId, json.tags));
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

        this.filterEntries = this.filterEntries.bind(this);
    }

    filterEntries(props) {
        var filter = props.filter;

        var startDate = filter.get('startDate');
        var endDate = filter.get('endDate');
        if(endDate) {
            endDate += 'T25';
        }
        var tagSet = Set(filter.get('tags'));
        
        var isShared = filter.get('isShared');
        var wasShared = filter.get('wasShared');
        var neverShared = filter.get('neverShared');
        
        var filterShared = isShared || wasShared || neverShared;

        var entryMap = props.entryMap;
        var shareMap = props.shareMap;
 
        return props.entryList.filter(function(itemId) {
            var item = entryMap.get(itemId);
            var date_created = item.get('created_dt');

            if(item.get('award')) {
                return false; // Don't show pledges for now
            }
                      
            if(startDate && (date_created < startDate)) {
                return false;
            }
            if(endDate && (date_created > endDate)) {
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

    componentWillReceiveProps(nextProps) {
        this.setState({
            entryMap: nextProps.entryMap,
            entryList: this.filterEntries(nextProps)
        })
    }

    render() {
        var content = null;

        if(this.props.error) {
            content = (
                <ErrorAlert msg={this.props.error} />
            );
        } else if(this.props.loading) {
            content = (
                <LoadingIndicator />
            );
        } else if(this.state.entryList.size) {
            var entryMap = this.props.entryMap;

             content = this.state.entryList.map(function(id, i) {
                return (
                    <PortfolioListItem key={i}
                        entry={entryMap.get(id).toJS()}
                        awardMap={this.props.awardMap}
                        shareMap={this.props.shareMap}
                        onClick={this.viewEntry}
                        onShowMenu={this.showPopoverMenu}
                        onSaveTags={this.saveTags}
                        onShare={this.handleShare}
                    />
                );
            }, this);

        } else {
            content = (
                <InfoAlert msg="No entries found" />
            );
        }

        return (
            <span>
             <div className="row">
                <div className="filterBarContainer" >
                    <FilterBar
                        dispatch={this.props.dispatch}
                        tagType={constants.TAG_TYPE.Entry}
                        count={this.state.entryList.size}
                        filter={this.props.filter}
                        onClickFilter={this.showFilterModal}
                    />
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12 filteredContentContainer">
                    <a href="javascript:void(0)" onClick={this.addEntry} style={{
                        display: 'block',
                        backgroundColor: '#a9a6a6',
                        color: '#ffffff',
                        padding: '15px',
                        marginTop: '10px',
                        marginBottom: '15px',
                        fontWeight: 400,
                        fontSize: '1.1em',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'center'
                    }}>
                        <i className="fa fa-plus-circle" aria-hidden="true" />
                        &nbsp;Add New ePortfolio Entry
                    </a>

                    <div className="list-group">
                        {content}
                    </div>
                </div>
                <PortfolioPopoverMenu
                    rootClose={true}
                    animation={false}
                    show={this.state.showMenu}
                    onHide={() => this.setState({showMenu: false})}
                    target={this.state.menuTarget}
                    placement="left"
                    container={this}
                    onView={(e) => this.viewEntry(this.state.curEntryId)}
                    onEdit={(e) => this.editEntry(this.state.curEntryId)}
                    onCopy={(e) => this.copyEntry(this.state.curEntryId)}
                    onTrash={this.trashEntryConfirm}
                />
            </div>

            <FilterModal
                type='Entries'
                dispatch={this.props.dispatch}
                tagType={constants.TAG_TYPE.Entry}
                tags={this.props.tags}
                attrs={this.props.attrs}
            />

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
        filter: state.getIn(['filter', constants.TAG_TYPE.Entry], new Map()),
        tags: state.getIn(['tags', constants.TAG_TYPE.Entry], new List()),
        attrs: state.getIn(['attrs', constants.TAG_TYPE.Entry], {}),
        loading: state.getIn(['entries', 'loading'], false),
        error: state.getIn(['entries', 'error'], null),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map()),
        entryList: state.getIn(['entries', 'items'], new List()),
        shareMap: state.getIn(['shares', 'itemsById'], new Map())
    };
}

export const Portfolio = connect(mapStateToProps)(_Portfolio);
