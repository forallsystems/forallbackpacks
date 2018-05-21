import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import * as constants from '../constants';
import {fetchGetJSON} from '../action_creators';
import {dispatchCustomEvent, parseQueryString} from './common.jsx';
import {
    Modal, showErrorModal, showInfoModal, showProgressModal, hideProgressModal
} from './Modals.jsx';


class ExportAuthModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showExportAuthModal';
    }

    renderContent() {
        var authAurl = this.state.url
            +'?ref='+encodeURIComponent(location.href)+'&id='+this.state.id;

        return (
            <div className="modal-content">
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                 </div>
                <div className="modal-body text-center">
                    <h5>Exporting to {this.state.name} requires your authorization.</h5>

                    <a className="btn btn-warning btn-raised" href={authAurl}>
                        Begin Authorization
                    </a>
                </div>
            </div>
        );
    }
}

ExportAuthModal.show = function(serviceConfig, id) {
    dispatchCustomEvent('showExportAuthModal', {
        name: serviceConfig.name,
        url: serviceConfig.url,
        id: id
    });
}

class ExportModal extends Modal {
    constructor(props) {
        super(props);
        this.eventId = 'showExportModal';

        this.onDownload = (e) => {
            this.hideModal();
            this.props.handleDownload(this.state.id);
        }

        this.onDropbox = (e) => {
            this.hideModal();
            this.props.handleDropbox(this.state.id);
        }

        this.onGoogleDrive = (e) => {
            this.hideModal();
            this.props.handleGoogleDrive(this.state.id);
        }

        this.onOneDrive = (e) => {
            this.hideModal();
            this.props.handleOneDrive(this.state.id);
        }
    }

    renderContent() {
        return (
            <div className="modal-content">
                <div className="modal-header" style={{
                    padding: '10px',
                    borderBottom: '1px solid #bbb'
                }}>
                    <div className="row">
                        <div className="col-xs-offset-2 col-xs-8 text-center" style={{
                            fontWeight: 500,
                            fontSize: '1.2em',
                            lineHeight: 1.5,
                        }}>
                            Export {this.state.name} Badge
                        </div>
                        <div className="col-xs-2">
                            <button type="button" className="btn pull-right" onClick={this.hideModal} style={{
                                margin: 0,
                                padding: '4px'
                            }}>
                                <i className="fa fa-times fa-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="modal-body" style={{padding: 0, fontSize:'1.3em'}}>
                    <div className="list-group">
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onDownload}>
                                <i className="fa fa-download" aria-hidden="true"></i> Download
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onDropbox}>
                                <i className="fa fa-dropbox" aria-hidden="true"></i> Send to Dropbox
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onGoogleDrive}>
                                <i className="fa fa-google" aria-hidden="true"></i> Send to Google Drive
                            </a>
                        </div>
                        <div className="list-group-item baseline" style={{padding: '10px 16px'}}>
                            <a href="javascript:void(0)" onClick={this.onOneDrive}>
                                <i className="fa fa-cloud" aria-hidden="true"></i> Send to OneDrive
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ExportModal.show = function(id, name) {
    dispatchCustomEvent('showExportModal', {id: id, name: name});
}

export class Exporter extends React.Component {
    constructor(props) {
        super(props);
        
        this.handleDownload = this.handleDownload.bind(this);
        this.handleDropbox = this.handleDropbox.bind(this);
        this.handleGoogleDrive = this.handleGoogleDrive.bind(this);
        this.handleOneDrive = this.handleOneDrive.bind(this);
    }
    
    handleQueryString(props) {
        // Check for post-auth params
        var params = parseQueryString(props.location.search);

        // Clear any params
        props.history.replace(props.history.location.pathname);

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
                    case 'db': this.handleDropbox(params.id); break;
                    case 'gd': this.handleGoogleDrive(params.id); break;
                    case 'od': this.handleOneDrive(params.id); break;
                }
            }
            
            return true;
        }
        
        return false;
    }  
    
    beginExport(id, name) {
        ExportModal.show(id, name);
    }
    
    handleDownload(id) {
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
    
    handleDropbox(id) {
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

    handleGoogleDrive(id) {
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

    handleOneDrive(id) {
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

    render() {       
        return (
            <span>        
            <ExportAuthModal />
            <ExportModal
                handleDownload={this.handleDownload}
                handleDropbox={this.handleDropbox}
                handleGoogleDrive={this.handleGoogleDrive}
                handleOneDrive={this.handleOneDrive}
            />        
            </span>
        );    
    }
}
