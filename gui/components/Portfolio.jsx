import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {Link, withRouter} from 'react-router-dom';
import {List, Map, Set} from 'immutable';
import uuid from 'uuid-random';
import {Popover, Overlay} from 'react-bootstrap';
import Truncate from 'react-truncate';
import moment from 'moment';
import * as constants from '../constants';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    addEntry, updateEntryTags, deleteEntry, setIsOffline
} from '../action_creators';
import {
    isOnline, downloadAttachment, isImageAttachment, getAttachmentIcon, getShareWarning, 
    ErrorAlert, InfoAlert, LoadingIndicator, ViewCount, SharePanel
} from './common.jsx';
import {FilterModal, FilterBar} from './Filter.jsx';
import {
    showErrorModal, showInfoModal, showConfirmModal, ShareDetailsModal, showImageModal
} from './Modals.jsx';
import {Tags} from './Tags.jsx';
import {Sharer} from './Sharer.jsx'


class PortfolioListItem extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};

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
                attachment, this.props.awardMap.get(attachment.award), 56, 'fa-4x'
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
                if(isImage) {
                    return (
                        <a href="javascript:void(0);" title={attachment.label} 
                            onClick={(e) => { this.onClickAttachment(attachment, true); }}>
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                } else {
                    return (
                        <a href={attachment.hyperlink} title={attachment.label} 
                            target="_blank">
                            {this.getAttachmentIcon(attachment)}
                        </a>
                    );
                }
            }
        }

        this.saveTags = (value) => {
            this.props.onSaveTags(this.props.entry.id, value);
        }

        this.onClick = (e) => {
            this.props.onClick(this.props.entry.id);
        }

       this.onClickViewCount = (e) => {
            this.props.onShareDetails(this.props.entry.id);
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
                <div className="clearfix" style={{padding:'6px 0'}}>
                {section.attachments.slice(0, 3).map(function(attachment, i) {
                    return (
                        <span className="pull-left" style={{marginRight:'6px'}}>
                            {this.getAttachmentLink(attachment)}
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
                    <ViewCount 
                        shares={entry.shares} 
                        shareMap={this.props.shareMap} 
                        onClick={this.onClickViewCount}
                    />
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
                            isOffline={this.props.isOffline}
                            isInvalid={false}
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
                                <i className="fa fa-trash"/> Remove
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
            // Always allow, check for network connection on save
            this.props.history.push('/entry/edit');            
        }
        
// Edit
        this.editEntry = (id) => {
            // Always allow, check for network connection on save
            this.setState({showMenu: false});
            this.props.history.push('/entry/edit/'+id);   
        }

// Copy
        this.copyEntryOffline = (id) => {
            var entry = this.props.entryMap.get(id).toJS();
            
            var sections = entry.sections.map(function(section, i) {
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
                        // If was upload, will have non-zero fileSize
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
                tags: entry.tags,
                sections: sections,
                created_dt: moment.utc().format()
            }
            
            this.props.dispatch(addEntry(entry));
        }
        
        this.copyEntry = (id) => {
            var self = this;
            
            this.setState({showMenu: false});
            
            if(this.props.isOffline) {
                this.copyEntryOffline(id);
            } else {
                fetchPostJSON(constants.API_ROOT+'entry/'+id+'/copy/')
                    .then((json) => {
                        console.debug('success', json);
                        this.props.dispatch(addEntry(json));
                    }).catch((error) => {
                        console.error('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to copy entry.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.copyEntryOffline(id);
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
            var self = this;
            var id = this.state.curEntryId;

            if(this.props.isOffline) {
                this.props.dispatch(deleteEntry(id));
            } else {
                fetchDeleteJSON(constants.API_ROOT+'entry/'+id+'/')
                    .then(json => {
                        this.props.dispatch(deleteEntry(id));
                    })
                    .catch(error => {
                        console.error('error deleting entry', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to delete entry.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(deleteEntry(id));
                                }
                            );                        
                        } else {
                            showErrorModal('Error Deleting Entry', error);
                        }
                    });
            }
        }

// Share
        this.showShareDetails = (entryId) => {    
            ShareDetailsModal.show(this.props.entryMap.getIn([entryId, 'shares']));
        }

        this.handleShare = (id, shareType, shareId) => {
            var entry = this.props.entryMap.get(id);
            
            if(shareId) {
                this.sharer.viewShare(shareId);
            } else if(this.props.isOffline) {
                showErrorModal('Offline Mode', 'You must be online to share an entry.');
            } else {
                this.sharer.createShare(shareType, entry.toJSON());
            }
        }

// Tags (called from PortfolioListItem)
        this.saveTags = (entryId, value) => {
            var self = this;
            
            if(this.props.isOffline) {
                this.props.dispatch(updateEntryTags(entryId, value.toJSON().sort()));
            } else {
                fetchPostJSON(constants.API_ROOT+'entry/'+entryId+'/tags/', value)
                    .then((json) => {
                        console.debug('success', json);
                        this.props.dispatch(updateEntryTags(entryId, json.tags));
                    })
                    .catch((error) => {
                        console.log('error', error);
                        if(error instanceof TypeError) {
                            showConfirmModal(
                                'No Network Connection',
                                'Unable to update tags.  Do you want to switch to Offline Mode?',
                                function() {
                                    self.props.dispatch(setIsOffline(true));
                                    self.props.dispatch(updateEntryTags(entryId, value.toJSON().sort()));                         
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

        this.filterEntries = this.filterEntries.bind(this);

        this.state = {
            showMenu: false,
            menuTarget: null,
            curEntryId: '', // active entry for PortfolioPopoverMenu
            entryList: this.filterEntries(props)
        };
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

            if(item.get('is_deleted')) {
                return false;   // Never show deleted
            }

            if(item.get('award')) {
                return false;   // Don't show pledges for now
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
                        onShareDetails={this.showShareDetails}
                        isOffline={this.props.isOffline}
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
                {(this.props.loading || this.props.error) ? null : (
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
                )}
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

            <Sharer ref={(el) => {this.sharer = el;}}
                contentType='entry' 
                dispatch={this.props.dispatch} 
                shareMap={this.props.shareMap} 
                isOffline={this.props.isOffline}
            />
            
            <ShareDetailsModal shareMap={this.props.shareMap} />

            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        isOffline: state.get('isOffline', false),
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
