import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import {Popover, Overlay} from 'react-bootstrap';
import moment from 'moment';
import GooglePicker from 'react-google-picker';
import * as constants from '../constants';
import {
    getAttachmentIcon, ErrorAlert, SharePanel, AttachmentPopoverMenu, UploadPopoverMenu
} from './common.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPostFormData, fetchPatchJSON, fetchDeleteJSON,
    addEntry, updateEntry
} from '../action_creators';
import {
    showErrorModal, showInfoModal, showConfirmModal, SelectBadgeModal
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

class _EntryEdit extends React.Component {
    constructor(props) {
        super(props);

        if(props.match.params.entryId) {
            var entry = props.entryMap.get(props.match.params.entryId);

            this.state = {
                showUploadMenu: false,
                showAttachmentMenu: false,
                menuTarget: null,
                curAttachmentIndex: '', // active attachment for popover menu
                errors: [],
                id: entry.get('id'),
                sections: entry.get('sections').toJS()
            };
        } else {
            this.state = {
                showUploadMenu: false,
                showAttachmentMenu: false,
                menuTarget: null,
                curAttachmentIndex: '', // active attachment for popover menu
                errors: [],
                id: null,
                sections: [{title: '', text: '', attachments: []}]
            };
        }

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
                    <img src={award.get('badge_image')} height="70" />
                );
            }

            return getAttachmentIcon(attachment.file, attachment.label, 70, 'fa-5x');
        }

        this.showUploadMenu = (e) => {
            var target = e.target;

            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling

            this.isOnline('upload a file', () => {
                this.setState({
                    showUploadMenu: !this.state.showUploadMenu,
                    menuTarget: target
                });
            });
        }

        this.showAttachmentMenu = (e, attachmentIndex) => {
            var target = e.target;

            e.preventDefault();     // prevent transition
            e.stopPropagation();    // prevent bubbling
        
            this.isOnline('view or modify attachments', () => {
                this.setState({
                    showAttachmentMenu: !this.state.showAttachmentMenu,
                    menuTarget: target,
                    curAttachmentIndex: attachmentIndex
                });
            })
        }

        // For NavEditFooter
        this.handleEvent = this.handleEvent.bind(this);

        this.showUploadFile = (e) => {
            this.setState({showUploadMenu: false});
            this.fileInput.click();
        }

        this.uploadFile = this.uploadFile.bind(this);

        this.showGooglePicker = (e) => {
            this.setState({showUploadMenu: false});
            this.googlePicker.onChoose(e);
        }

        this.uploadGoogleFile = this.uploadGoogleFile.bind(this);
        this.uploadGoogleDoc = this.uploadGoogleDoc.bind(this);
        this.onGooglePickerChange = this.onGooglePickerChange.bind(this);

        this.scrollTop = () => {
            document.getElementById('contentContainer').scrollTop = 0;
        }

        this.onChangeTitle = (e) => {
            var sections = this.state.sections;
            sections[0].title = e.target.value;

            this.setState({sections: sections});
        }

        this.onChangeText = (e) => {
            var sections = this.state.sections;
            sections[0].text = e.target.value;

            this.setState({sections: sections});
        }

        this.onAttachBadge = (e) => {
            this.isOnline('attach a badge', () => {
                // Filter used, deleted, pledgable badges
                var usedMap = this.state.sections[0].attachments.reduce(function(d, attachment) {
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
            });
        }

        this.onSelectBadge = (awardId) => {
            var errors = [];

            fetchPostJSON(constants.API_ROOT+'attachment/', {
                label: this.props.awardMap.getIn([awardId, 'badge_name']),
                award: awardId
            })
            .then((json) => {
                console.debug('success', json);

                var sections = this.state.sections;
                sections[0].attachments.push(json);

                this.setState({sections: sections});
            })
            .catch((error) => {
                console.error('error', error);
                if(error instanceof TypeError) {
                    error = 'You must be online to attach a badge.';
                } else if(error.detail) {
                    for(var key in error.detail) {
                        error = error.detail[key];
                        break;
                    }
                }

                showErrorModal('Error Attaching Badge', error);
            });
        }

        this.viewAttachment = (attachmentIndex) => {
            this.setState({showAttachmentMenu: false});

            var attachment = this.state.sections[0].attachments[attachmentIndex];
            window.open(attachment.hyperlink, '_blank', 'width=600,height=600');
        }

        this.trashAttachment = (attachmentIndex) => {
            this.setState({showAttachmentMenu: false});

            var sections = this.state.sections;
            sections[0].attachments.splice(attachmentIndex, 1);

            this.setState({sections: sections});
        }
    }

    handleEvent(e) {
        switch(e.type) {
            case 'navEditSave': // from NavEditFooter
                this.save();
                break;
        }
    }

    componentDidMount() {
        document.addEventListener('navEditSave', this, false);
    }

    componentWillUnmount() {
        document.removeEventListener('navEditSave', this, false);
    }

    uploadFile(e) {
        var self = this;

        if(this.fileInput.files.length) {
            var file = this.fileInput.files[0];

            var formData = new FormData();
            formData.append('label', file.name);
            formData.append('file', file, file.name);

            fetchPostFormData(constants.API_ROOT+'attachment/', formData)
                .then((json) => {
                    console.debug('success', json);

                    var sections = self.state.sections;
                    sections[0].attachments.push(json);

                    self.setState({sections: sections});
                })
                .catch((error) => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to upload a file.';
                    }
                    showErrorModal('Error Uploading File', error);
                });
        }
    }

    uploadGoogleFile(file, responsejs) {
        var self = this;

        var accessToken = gapi.auth.getToken().access_token;

        var xhr = new XMLHttpRequest();

        xhr.open('GET', responsejs.downloadUrl);
        xhr.setRequestHeader('Authorization', 'Bearer '+accessToken);
        xhr.responseType = "blob";

        xhr.onload = function() {
            var formData = new FormData();
            formData.append('label', file.name);
            formData.append('file', xhr.response, file.name);

            fetchPostFormData(constants.API_ROOT+'attachment/', formData)
                .then((json) => {
                    console.debug('success', json);

                    var sections = self.state.sections;
                    sections[0].attachments.push(json);

                    self.setState({sections: sections});
                })
                .catch((error) => {
                    console.error('error', error);
                     if(error instanceof TypeError) {
                        error = 'You must be online to upload a file.';
                    }
                    showErrorModal('Error Uploading File', error);
                });
        };

        xhr.send();
    }

    uploadGoogleDoc(file, responsejs) {
        var self = this;

        fetchPostJSON(constants.API_ROOT+'attachment/', {
                label: file.name,
                hyperlink: responsejs.alternateLink
            })
            .then((json) => {
                console.debug('success', json);

                var sections = self.state.sections;
                sections[0].attachments.push(json);

                self.setState({sections: sections});
            })
            .catch((error) => {
                console.error('error', error);
                 if(error instanceof TypeError) {
                    error = 'You must be online to upload a file.';
                }
                showErrorModal('Error Uploading File', error);
            });
    }

    onGooglePickerChange(data) {
        var self = this;

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
                                self.uploadGoogleDoc(file, responsejs);
                            }
                        }
                    });
                });
            });
        }
    }

    getSectionsData() {
        return this.state.sections.map(function(section) {
            var data = {
                title: section.title,
                text: section.text,
                attachments: section.attachments.map(function(attachment) {
                    return attachment.id;
                })
            };

            if(section.id) {
                data['id'] = section.id;
            }

            return data;
        });
    }

    cancel() {
        // Delete any newly created attachments
        var attachmentIds = [];

        this.state.sections.forEach(function(section) {
            section.attachments.forEach(function(attachment) {
                if(!attachment.section) {
                    attachmentIds.push(attachment.id);
                }
            });
        });

        if(attachmentIds.length) {
            fetchPostJSON(constants.API_ROOT+'attachment/remove/', attachmentIds)
            .then((json) => {
                console.debug('success', json);
            })
            .catch((error) => {
                console.error('error', error);
            });
        }

        this.props.history.goBack();
    }

    save() {
        var errors = [];

        if(!this.state.sections[0].title) {
            errors.push("You must enter a Title.");
        }

        if(errors.length) {
            this.scrollTop();
            this.setState({errors: errors});
        } else if(this.state.id) {
            fetchPatchJSON(constants.API_ROOT+'entry/'+this.state.id+'/', {
                sections: this.getSectionsData()
            })
            .then((json) => {
                console.debug('success', json);
                this.props.dispatch(updateEntry(json));
                this.props.history.goBack();
            })
            .catch((error) => {
                console.error('error', error);
                if(error instanceof TypeError) {
                    errors.push('You must be online to update an entry.');
                } else if(error.detail) {
                    for(var key in error.detail) {
                        errors.push(error.detail[key]);
                    }
                } else {
                    errors.push('Error updating entry: '+error.statusText);
                }

                this.scrollTop();
                this.setState({errors: errors});
            });
        } else {
            fetchPostJSON(constants.API_ROOT+'entry/', {
                sections: this.getSectionsData()
            })
            .then((json) => {
                console.debug('success', json);
                this.props.dispatch(addEntry(json));
                this.props.history.goBack();
            })
            .catch((error) => {
                console.error('error', error);
                if(error instanceof TypeError) {
                    errors.push('You must be online to save an entry.');
                } else if(error.detail) {
                    for(var key in error.detail) {
                        errors.push(error.detail[key]);
                    }
                } else {
                    errors.push('Error saving entry: '+error.statusText);
                }

                this.scrollTop();
                this.setState({errors: errors});
            });
        }
    }

    render() {
        var section = this.state.sections[0]; // Only one section for now

        return (
            <span>
            {this.state.errors.map(function(error, i) {
                return (
                    <ErrorAlert key={i} msg={error} />
                );
            }, this)}

            <form>
                <div className="form-group">
                    <label>Title</label>
                    <input type="text" className="form-control" id="entry_title" placeholder=""
                        value={section.title} onChange={this.onChangeTitle} />
                </div>
                <div className="form-group">
                    <label>Entry</label>
                    <textarea className="form-control" rows="6"
                        value={section.text} onChange={this.onChangeText} />
                </div>
                <input ref={(el) => {this.fileInput = el;}} type="file" style={{display: 'none'}}
                    onChange={this.uploadFile}
                />
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
                        &nbsp;Upload File
                        &nbsp;<i className="fa fa-caret-down fa-lg" aria-hidden="true"></i>
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
                        onClick={(e) => { this.save(); }}
                        style={{marginRight:'16px'}}>
                        Save
                    </button>
                    <button className="btn btn-raised btn-default"
                        onClick={(e) => { this.cancel(); }}>
                        Cancel
                    </button>
                </div>
            </div>

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
                rootClose={true}
                animation={false}
                show={this.state.showAttachmentMenu}
                onHide={() => this.setState({showAttachmentMenu: false})}
                target={this.state.menuTarget}
                placement="top"
                container={this}
                onView={(e) => this.viewAttachment(this.state.curAttachmentIndex)}
                onTrash={(e) => this.trashAttachment(this.state.curAttachmentIndex)}
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
        user: state.get('user', new Map()),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        awardList: state.getIn(['awards', 'items'], new List()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map())
    };
}

export const EntryEdit = connect(mapStateToProps)(_EntryEdit);
