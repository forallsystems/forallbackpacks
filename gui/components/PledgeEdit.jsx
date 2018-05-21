import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import {Popover, Overlay} from 'react-bootstrap';
import moment from 'moment';
import uuid from 'uuid-random';
import GooglePicker from 'react-google-picker';
import * as constants from '../constants';
import {
    scrollTop, isImageAttachment, isOnline, getAttachmentIcon, ErrorAlert, 
    AttachmentPopoverMenu, UploadPopoverMenu
} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, addEntry, updateEntry, setIsOffline 
} from '../action_creators';
import {
    showErrorModal, showInfoModal, showConfirmModal, showProgressModal, hideProgressModal,
    SelectBadgeModal, showImageModal
} from './Modals.jsx';
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

class _PledgeEdit extends React.Component {
    constructor(props) {
        super(props);

        var award = props.awardMap.get(props.match.params.awardId, Map()).toJS();

        this.state = {
            showUploadMenu: false,
            showAttachmentMenu: false,
            menuTarget: null,
            curAttachmentIndex: '', // active attachment for popover menu
            curAttachment: {},
            errors: [],
            award: award
        }
       
        if(award.entry) {
            this.state.sections = props.entryMap.getIn([award.entry, 'sections']).toJS();
        } else {
            this.state.sections = [{title: '', text: '', attachments: []}];
        }
        this.state.sectionIndex = this.state.sections.length - 1;

// Edit
        this.onChangeText = (e) => {
            var sections = this.state.sections;            
            sections[this.state.sectionIndex].text = e.target.value;            
            this.setState({sections: sections});  
        }

// Attachments        
        this.getAttachmentIcon = (attachment) => {
            return getAttachmentIcon(
                attachment, this.props.awardMap.get(attachment.award), 70, 'fa-5x'
            );
        }

        this.showAttachmentMenu = (e, attachmentIndex) => {
            var target = e.target;

            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            var attachment = this.state.sections[this.state.sectionIndex].attachments[attachmentIndex]

            this.setState({
                showAttachmentMenu: true,
                menuTarget: target,
                curAttachmentIndex: attachmentIndex,
                curAttachment: attachment
            });
        }

        this.viewAttachment = (attachmentIndex) => {
            // non-image views handled by link in popover
            this.setState({showAttachmentMenu: false});

            var attachment = this.state.sections[this.state.sectionIndex].attachments[attachmentIndex];

            if(isImageAttachment(attachment)) {
                if(attachment.id) {
                    showImageModal(attachment.label, attachment.hyperlink);
                } else {
                    showImageModal(attachment.label, attachment.data_uri);
                }
            }
        }

        this.downloadAttachment = (attachmentIndex) => {
            // downloads handled by link in popover
            this.setState({showAttachmentMenu: false});
        }

        this.trashAttachment = (attachmentIndex) => {
            // For synced or unsynced attachments
            this.setState({
                showAttachmentMenu: false, 
                curAttachmentIndex: 0,
                curAttachment: {}
            });
            
            var sections = this.state.sections;
            sections[this.state.sectionIndex].attachments.splice(attachmentIndex, 1);
            this.setState({sections: sections});            
        }

// Attach Badge
        this.onAttachBadge = (e) => {
            // Filter used, deleted, pledgable badges
            var usedMap = this.state.sections[this.state.sectionIndex].attachments.reduce(function(d, attachment) {
                if(attachment.award) {
                    d[attachment.award] = 1;
                }             
                return d;
            }, {});
                       
            var awardList = this.props.awardList.filterNot(function(awardId) {
                return usedMap[awardId]  
                    || this.props.awardMap.getIn([awardId, 'is_deleted'])
                    || (this.props.awardMap.getIn([awardId, 'issued_date']) == null)
            }, this);
            
            if(awardList.size) {
                SelectBadgeModal.show(awardList, this.props.awardMap); 
            } else {
                showInfoModal('Select Badge', 'No additional badges found.');
            }       
        }

        this.onSelectBadge = (awardId) => {    
            var sections = this.state.sections;                
            sections[this.state.sectionIndex].attachments.push({
                label: this.props.awardMap.getIn([awardId, 'badge_name']),
                award: awardId
            });
            this.setState({sections: sections});
        }
        
// Uploads
        this.showUploadMenu = (e) => {
            var target = e.target;

            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            if(this.props.isOffline) {
                this.showUploadFile(e);
            } else {
                this.setState({
                    showUploadMenu: !this.state.showUploadMenu,
                    menuTarget: target
                });
            }
        }

        this.showUploadFile = (e) => {
            this.setState({showUploadMenu: false});
            this.fileInput.click();       
        }
 
        this.showGooglePicker = (e) => {
            this.setState({showUploadMenu: false});
            
            isOnline('upload a file from Google Drive', () => {
                this.googlePicker.onChoose(e);
            });
        }
                
        this.storeFileAsAttachment = this.storeFileAsAttachment.bind(this);
        this.uploadFile = this.uploadFile.bind(this);
        this.uploadGoogleFile = this.uploadGoogleFile.bind(this);
        this.uploadGoogleDoc = this.uploadGoogleDoc.bind(this);
        this.onGooglePickerChange = this.onGooglePickerChange.bind(this);
                        
// For NavEditFooter
        this.handleEvent = this.handleEvent.bind(this);
     }

    handleEvent(e) {
        switch(e.type) {
            case 'navEditSave': // from NavEditFooter
                this.onSave();
                break;
        }
    }

    componentDidMount() {
        document.addEventListener('navEditSave', this, false);
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            award: nextProps.awardMap.get(nextProps.match.params.awardId, Map()).toJS()
        });    
    }
    
    componentWillUnmount() {
        document.removeEventListener('navEditSave', this, false);
    }

    storeFileAsAttachment(fileInfo, fileObject) {
        var self = this;        
        var reader = new FileReader();
        
        reader.onerror = function(e) {
            console.debug('reader.onerror', e.target.error);    
            hideProgressModal();
            showErrorModal('Error Uploading File', 'Unable to upload file.');
        }
    
        reader.onload = function(e) {
            console.debug('reader.onload');
            hideProgressModal();
        
            var sections = self.state.sections;
            sections[self.state.sectionIndex].attachments.push({
                label: fileInfo.name,
                data_uri: reader.result,
                fileSize: fileInfo.size || fileInfo.sizeBytes                        
            });
            self.setState({sections: sections});
        }

        reader.readAsDataURL(fileObject);
    }

    checkFileSize(fileSize, mimetype) {
        var error = '';
        
        if(this.props.isOffline) {
            if(fileSize > constants.ATTACHMENT_OFFLINE_BYTE_LIMIT) {
                if(/video\/.+/.test(mimetype)) {
                    error = 'You may only attach videos that are less than 15 seconds.';            
                } else {
                    error = 'You may not upload files over 8MB.';
                }
            }
        } else {
            if(fileSize > constants.ATTACHMENT_ONLINE_BYTE_LIMIT) {
                if(/video\/.+/.test(mimetype)) {
                    error = 'You may only attach videos that are less than a minute and 30 seconds.';            
                } else {
                    error = 'You may not upload files over 50MB.';
                }
            }
        }
        
        return error;
    }
  
    uploadFile(e) {
        if(this.fileInput.files.length) {
            var fileInfo = this.fileInput.files[0];
            var error = this.checkFileSize(fileInfo.size, fileInfo.type);

            if(error) {
                showErrorModal('Upload Error', 'This file is too large.  '+error);               
                this.fileInputForm.reset();
            } else {                             
                showProgressModal('Uploading File');    
                this.storeFileAsAttachment(fileInfo, fileInfo);
            }
        }
    }
    
    uploadGoogleFile(file, responsejs) {
        var error = this.checkFileSize(file.sizeBytes, file.mimeType);

        if(error) {
            showErrorModal('Upload Error', 'This file is too large.  '+error);            
        } else {   
            var self = this;
            var accessToken = gapi.auth.getToken().access_token;
            var xhr = new XMLHttpRequest();

            showProgressModal('Uploading File');

            xhr.open('GET', responsejs.downloadUrl);
            xhr.setRequestHeader('Authorization', 'Bearer '+accessToken);
            xhr.responseType = "blob";

            xhr.onload = function() {
                self.storeFileAsAttachment(file, xhr.response);
            };

            xhr.send();
        }
    }
    
    uploadGoogleDoc(file, responsejs) {
        var sections = this.state.sections;
        sections[this.state.sectionIndex].attachments.push({
            label: file.name,
            hyperlink: responsejs.alternateLink        
        });
        this.setState({sections: sections});
    }
    
    onGooglePickerChange(data) {
        var self = this;
        
        if(data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
            var docs = data[google.picker.Response.DOCUMENTS];       
        
            docs.forEach(function(file) {
                isOnline('upload a file from Google Drive', () => {
                    gapi.client.request({   
                        'path': '/drive/v2/files/'+file.id,
                        'method': 'GET',
                        callback: function (responsejs, responsetxt) {
                            if(responsejs.fileExtension) {
                                self.uploadGoogleFile(file, responsejs);       
                            } else {
                                self.uploadGoogleDoc(file, responsejs);
                            }                        
                        }
                    });                   
                });
            });
        }
    }

    onSave() {
        if(!this.state.sections[this.state.sectionIndex].text) {
            scrollTop();
            this.setState({errors: ["You must enter how you think you met the criteria for this badge."]});
        } else if(this.props.isOffline) {
            this.saveOffline();
        } else {
            this.saveOnline();
        }
    }
    
    saveOffline() {
        if(this.state.award.entry) {
            var entry = this.props.entryMap.get(this.state.award.entry).toJS();                
            entry.sections = this.state.sections;
            
            this.props.dispatch(updateEntry(entry));
            this.props.history.push('/badges');
        } else {
             var entry = {
                id: uuid(),
                award: this.state.award.id,
                shares: [],
                tags: [],
                sections: this.state.sections,
                created_dt: moment.utc().format()
            }           

            this.props.dispatch(addEntry(entry));
            this.props.history.push('/badges');
        }
    }

    saveAttachments(sectionJSON) {
        return sectionJSON.attachments.map((attachment, i) => {
            if(attachment.id) {
                return Promise.resolve(null);
            }
        
            attachment.section = sectionJSON.id;
            
            return fetchPostJSON(constants.API_ROOT+'attachment/', attachment)
                .then((json) => {
                    console.debug('success', json);
                    sectionJSON.attachments[i] = json;
                })
        }, this);
    }
    
    saveOnline() {   
        var self = this;
        var errors = [];
        var sectionIndex = this.state.sectionIndex;

        showProgressModal('Saving Pledge');
                  
        if(this.state.award.entry) {    
            var entryJSON = this.props.entryMap.get(this.state.award.entry).toJS();
            
            entryJSON.sections = this.state.sections;

            // Save new attachments, then save entry
            Promise.all(
                this.saveAttachments(entryJSON.sections[sectionIndex])
            )
            .then(() => {                
                return fetchPatchJSON(constants.API_ROOT+'entry/'+this.state.award.entry+'/', {
                    sections: entryJSON.sections
                })
                .then((json) => {
                    console.debug('success', json);
                    hideProgressModal();
                    
                    this.props.dispatch(updateEntry(json));
                    this.props.history.push('/badges');
                });
            })
            .catch((error) => {
                // entryJSON will contain any changes that were saved
                console.error('error', error);
                hideProgressModal();

                if(error instanceof TypeError) {
                    showConfirmModal(
                        'No Network Connection',
                        'Unable to update pledge.  Do you want to switch to Offline Mode?',
                        function() {
                            self.props.dispatch(setIsOffline(true));
                            self.props.dispatch(updateEntry(entryJSON));
                            self.props.history.push('/badges');                          
                        }
                    );                        
                } else {
                    if(error.detail) {
                        for(var key in error.detail) {
                            errors.push(error.detail[key]);
                        }
                    } else {
                        errors.push('Error updating pledge: '+error.statusText);
                    }

                    scrollTop();
                    this.setState({errors: errors});
                }               
            });
        } else {
            var entryJSON = {
                id: uuid(),
                award: this.state.award.id,
                shares: [],
                tags: [],
                sections: this.state.sections,
                created_dt: moment.utc().format()
            };
            
            // Save entry, then save all attachments
            fetchPostJSON(constants.API_ROOT+'entry/', {
                award: this.state.award.id,
                sections: this.state.sections.splice(sectionIndex, 1, {
                    title: this.state.sections[sectionIndex].title,
                    text: this.state.sections[sectionIndex].text,
                    attachments: [] // send attachments separately               
                })
            })
            .then((json) => {
                console.debug('success', json);
                
                entryJSON = json;
                entryJSON.sections[sectionIndex].attachments = this.state.sections[sectionIndex].attachments;
                
                return Promise.all(
                    this.saveAttachments(entryJSON.sections[sectionIndex])
                )
                .then(() => {
                    console.debug('success');
                    hideProgressModal();
                    
                    this.props.dispatch(addEntry(entryJSON));
                    this.props.history.push('/badges');                          
                });
            })
            .catch((error) => {
                console.error('error', error);
                hideProgressModal();
                
                // entryJSON will contain any changes that were saved
                if(error instanceof TypeError) {
                    showConfirmModal(
                        'No Network Connection',
                        'Unable to submit pledge.  Do you want to switch to Offline Mode?',
                        function() {
                            self.props.dispatch(setIsOffline(true));
                            self.props.dispatch(addEntry(entryJSON));                            
                            self.props.history.push('/badges');                         
                        }
                    );                        
                } else {
                    if(error.detail) {
                        for(var key in error.detail) {
                            errors.push(error.detail[key]);
                        }
                    } else {
                        errors.push('Error submitting pledge: '+error.statusText);
                    }

                    scrollTop();
                    this.setState({errors: errors});
                }                
            });
        } 
    }

    render() {
        var award = this.state.award;
        var section = this.state.sections[this.state.sectionIndex];
       
        return (
            <span>
            {this.state.errors.map(function(error, i) {
                return (<ErrorAlert key={i} msg={error} />);
            }, this)}

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
            <form>
                <div className="form-group">
                    <label>How do you think you met the criteria for this badge?</label>
                    <textarea className="form-control" rows="6" 
                        value={section.text} onChange={this.onChangeText} />
                </div>
            </form>
            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef',
                    fontWeight: 400
               }}>                   
                    <label onClick={this.onAttachBadge} style={{
                        color: '#009688',
                        margin: '0 10px 0 0',
                        padding: '6px 4px 6px 0',
                        cursor: 'pointer'
                   }}>
                        <i className="fa fa-plus" aria-hidden="true"></i>
                        &nbsp;Attach Badge
                    </label>

                    <label id="upload_menu" onClick={this.showUploadMenu} 
                        style={{
                            color: '#009688',
                            margin: '0 10px 0 0',
                            padding: '6px 4px 6px 0',
                            cursor: 'pointer'
                        }}>
                        <i className="fa fa-plus" aria-hidden="true"></i>
                        &nbsp;Upload File &nbsp;
                        {(this.props.isOffline) ? null : (
                            <i className="fa fa-caret-down fa-lg" aria-hidden="true"></i>
                        )}
                    </label>
               </div>
            </div>
            <div className="row">
                <div className="col-xs-12" style={{
                    padding: '12px 15px',
                    borderTop: '1px solid #efefef'
                }}>
                    {section.attachments.map(function(attachment, i) {
                        return (
                            <span key={i} className="pull-left" style={{margin: '0 12px 12px 0'}}>
                                <a href="javascript:void(0)" title={attachment.label}
                                    onClick={(e) => this.showAttachmentMenu(e, i)}>
                                    {this.getAttachmentIcon(attachment)}
                                </a>
                            </span>
                        );
                    }, this)}
                </div>
            </div>            
            <div className="row">
                <div className="hidden-xs col-sm-12">
                    <button className="btn btn-raised btn-primary text-success" 
                        onClick={(e) => { this.onSave(); }}
                        style={{marginRight:'16px'}}>
                        Save
                    </button>
                    <button className="btn btn-raised btn-default" 
                        onClick={(e) => { this.props.history.push('/badges'); }}>
                        Cancel
                    </button>                
                </div>
            </div>

            <form ref={(el) => {this.fileInputForm = el;}}>
                <input ref={(el) => {this.fileInput = el;}} type="file" style={{display:'none'}}
                    onChange={this.uploadFile}
                />
            </form>
            
            <UploadPopoverMenu
                rootClose={true}
                animation={false}
                show={this.state.showUploadMenu}
                onHide={() => this.setState({showUploadMenu: false})}
                target={this.state.menuTarget}
                placement="bottom"
                container={this}
                onComputer={this.showUploadFile}
                onGoogleDrive={this.showGooglePicker}
            />

            <AttachmentPopoverMenu
                show={this.state.showAttachmentMenu}
                onHide={() => this.setState({showAttachmentMenu: false})}
                target={this.state.menuTarget}
                placement="top"
                container={this}
                onView={(e) => this.viewAttachment(this.state.curAttachmentIndex)}
                onDownload={(e) => this.downloadAttachment(this.state.curAttachmentIndex)}
                onTrash={(e) => this.trashAttachment(this.state.curAttachmentIndex)}
                isOffline={this.props.isOffline}  
                attachment={this.state.curAttachment}         
            />
                            
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

            <SelectBadgeModal onSelect={this.onSelectBadge} />
            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        isOffline: state.get('isOffline', false),
        user: state.get('user', new Map()),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        awardList: state.getIn(['awards', 'items'], new List()),        
        entryMap: state.getIn(['entries', 'itemsById'], new Map())
    };
}

export const PledgeEdit = connect(mapStateToProps)(_PledgeEdit);
