import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import * as constants from '../constants';
import {ErrorAlert, InfoAlert} from './common.jsx';
import {showErrorModal, showInfoModal, showConfirmModal} from './Modals.jsx';
import {
    fetchGetJSON, fetchPostJSON, fetchPatchJSON, fetchDeleteJSON,
    fetchUserSuccess, addEmail, setPrimaryEmail, deleteEmail
} from '../action_creators'

// value should be a Set()
export class AddEmailAddress extends React.Component {
    constructor(props) {
        super(props);

        this.state = {editing: false, error: null};

        this.startEditing = () => {
            this.setState({editing: true, error: null});
        }

        this.cancelEditing = () => {
            this.setState({editing: false, error: null});
        }

        this.commit = (value) => {
            const errors = [];

            fetchPostJSON(constants.API_ROOT+'useremail/', {email: value})
                .then(json => {
                    console.debug('success', json);
                    this.textInput.value = "";  
                    this.cancelEditing();
                    
                    this.props.dispatch(addEmail(json));
                    
                    if(!json.is_validated) {
                        this.props.onVerificationSent();
                    }
                })
                .catch((error) => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        this.setState({error: 'You must be online to add an email address.'});
                    } else if(error.detail) {
                        for(var key in error.detail) {
                            errors.push(error.detail[key]);
                        }
                        this.setState({error: errors[0]});                     
                    } else {
                        this.setState({error: 'Error adding email address: '+error.statusText});
                    }
                });
        }

        this.onInputKeyDown = (e) => {
            if (e.keyCode === 13) { // Enter
                e.preventDefault();
                if(e.target.value.length === 0) {
                    this.cancelEditing();
                } else {
                    this.onInputSave();
                }
            }
        }

        this.onInputSave = (e) => {
            var text = this.textInput.value;

            if(text) {
                if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                    this.setState({error: 'Invalid email address.'});
                } else if(this.props.value.has(text)) {
                    this.setState({error: 'This email address is already associated with your account.'});
                } else {
                    this.setState({error: null});            
                    this.commit(text);
                } 
            }
        }

        this.onInputCancel = (e) => {
            this.cancelEditing();
        }

        this.handleEvent = (e) => {
            switch(e.type) {
                case 'mousedown':
                    if(this.state.editing) {
                        if(!this.thisContainer.contains(e.target)) {
                            this.cancelEditing();
                        }
                    }
                    break;
            }
        }
    }
    
    componentDidMount() {
        document.addEventListener('mousedown', this, false);
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this, false);
    }

    componentDidUpdate(prevProps, prevState) {
        // Keep focus on input element while editing
        if(this.state.editing && this.textInput) {
            this.textInput.focus();
        }
    }

    renderNormalComponent() {
        return (
            <a href="javascript:void(0)" onClick={this.startEditing} style={{
                color: '#a99f01',
                cursor: 'pointer'
            }}>
                <i className="fa fa-plus-circle" aria-hidden="true"></i> Add Email Address                   
            </a>    
        );
    }

    renderEditingComponent() {
        return (
            <span ref={(el) => { this.thisContainer = el; }}>
                <div style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                    <input type="text" ref={(el) => {this.textInput = el;}}
                        onKeyDown={this.onInputKeyDown}
                        maxlength="254"
                        style={{width: '220px'}}
                        placeholder="Add Email Address"
                    />
                    <i className="fa fa-check-square fa-lg addTagSave"
                        onClick={this.onInputSave}
                        style={{marginLeft:'8px'}}
                    />
                    <i className="fa fa-window-close fa-lg addTagCancel"
                        onClick={this.onInputCancel}
                        style={{marginLeft:'8px'}}
                    />
                    <br/>
                    {(this.state.error) ? (
                        <p className="text-danger"><small>{this.state.error}</small></p>
                    ) : null}
                </div>
            </span>
        );
    }

    render() {
        if(this.state.editing) {
            return this.renderEditingComponent();
        } else {
            return this.renderNormalComponent();
        }
    }
}

class UserEmail extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {}
        
        this.onSetPrimary = (e) => {
            this.props.onSetPrimary(this.props.id, this.props.email);
        }
        
        this.onDelete = (e) => { 
            this.props.onDelete(this.props.id, this.props.email, this.props.is_primary) 
        };
        
        this.onArchive = (e) => {
            this.props.onArchive(this.props.id, this.props.email, this.props.is_primary);
        }  
        
        this.onVerify = (e) => {
            this.props.onVerify(this.props.id, this.props.email);
        }      
    }
    
    render() {
        var label = null, actions = null;
        var setAsPrimary = (
            <span style={{display: 'inline-block', width: '14px'}} /> 
        );
        
        if(this.props.is_primary) {
            setAsPrimary = (
                <i className="fa fa-star" aria-hidden="true" style={{color: '#a99f01'}}></i>
            );  
            
            label = "(Primary)"
 
            if(this.props.badge_count) {
                 actions = (
                    <a href="javascript:void(0)" title="Archive Email Address"
                        className="text-primary"
                        onClick={this.onArchive}>
                        <i className="fa fa-trash" aria-hidden="true"></i>
                    </a>
                );
            } else {
                actions = (
                    <a href="javascript:void(0)" title="Remove Email Address"
                        className="text-primary"
                        onClick={this.onDelete}>
                        <i className="fa fa-trash" aria-hidden="true"></i>
                    </a>
                );
            }
       } else {
            if(this.props.is_validated) {
                setAsPrimary = (
                    <a href="javascript:void(0)" title="Set As Primary" 
                        onClick={this.onSetPrimary} 
                        style={{color: '#a99f01'}}
                    >
                        <i className="fa fa-star-o" aria-hidden="true"></i>
                    </a>            
                ); 
            } else {
                label = (
                    <a href="javascript:void(0)" title="Resend verification email"
                    onClick={this.onVerify}
                    style={{color: '#000000', textDecoration: 'underline'}}>
                        (Verify)
                    </a>
                );
            }
            
            if(this.props.badge_count) {
                actions = (
                    <a href="javascript:void(0)" title="Archive Email Address"
                        className="text-primary"
                        onClick={this.onArchive}>
                        <i className="fa fa-trash" aria-hidden="true"></i>
                    </a>
                );
            } else {
                actions = (
                    <a href="javascript:void(0)" title="Remove Email Address"
                        className="text-primary"
                        onClick={this.onDelete}>
                        <i className="fa fa-trash" aria-hidden="true"></i>
                    </a>
                );
            }
        }
        
        return (
            <p className="form-control-static">
                {setAsPrimary}
                <span style={{margin: '0 10px'}}>{this.props.email} {label}</span>   
                {actions}
            </p>
        );
    }
}

class _MyAccount extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            errors: [],
            info: null,
            first_name: '',
            last_name: '',
            phone_number: '',
            password: '',
            confirmPassword: '',
            notify_type: 0
        };

        this.scrollTop = () => {
            document.getElementById('contentContainer').scrollTop = 0;
        }

        this.onChangeFirstName = (e) => {
            this.setState({first_name: e.target.value});
        }

        this.onChangeLastName = (e) => {
            this.setState({last_name: e.target.value});
        }

        this.onChangePhoneNumber = (e) => {
            this.setState({phone_number: e.target.value});
        }
       
        this.onChangePassword = (e) => {
            this.setState({password: e.target.value});
        }

        this.onChangeConfirmPassword = (e) => {
            this.setState({confirmPassword: e.target.value});
        }

        this.onChangeNotifyType = (e) => {
            this.setState({notify_type: e.target.value});
        }

        this.onSetPrimaryEmail = (id, email) => {
            fetchPatchJSON(constants.API_ROOT+'useremail/'+id+'/', {
                is_primary: true
            })
            .then(json => {
                this.props.dispatch(setPrimaryEmail(id));
            })
            .catch(error => {
                console.error('error', error);
                if(error instanceof TypeError) {
                    error = 'You must be online to change your primary email address.';
                }
                showErrorModal('Error Setting Primary Email Address', error);
            });
        }
        
        this.onDeleteEmail = (id, email, is_primary) => {
            if(is_primary) {
                showInfoModal(
                    'Error Deleting Email Address', 
                    'You may not delete your primary email address.'
                );            
            } else {
                showConfirmModal(
                    'Are you sure you want to delete the email address '+email+'?',
                    this.deleteEmail.bind(this, id)
                );
            }
        }
        
        this.deleteEmail = (id) => {
            fetchDeleteJSON(constants.API_ROOT+'useremail/'+id+'/')
                .then(json => {
                    this.props.dispatch(deleteEmail(id));
                })
                .catch(error => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to delete an email address.';
                    }
                    showErrorModal('Error Deleting Email Address', error);
                });
        }
                
        this.onArchiveEmail = (id, email, is_primary) => {
            if(is_primary) {
                showInfoModal(
                    'Error Archiving Email Address', 
                    'You may not archive your primary email address.'
                );
            } else {
                showConfirmModal(
                    'You have badges associated with this email address.'
                    + '  Are you sure you want to archive the email address '+email+'?',
                    this.archiveEmail.bind(this, id)
                );
            }
        }
        
        this.archiveEmail = (id) => {
            fetchPatchJSON(constants.API_ROOT+'useremail/'+id+'/', {
                is_archived: true
            })
            .then(json => {
                // Go ahead and delete from state
                this.props.dispatch(deleteEmail(id));
            })
            .catch(error => {
                console.error('error', error);
                if(error instanceof TypeError) {
                    error = 'You must be online to archive an email address.';
                }
                showErrorModal('Error Archiving Email Address', error);
            });
        }
        
        this.onVerifyEmail = (id, email) => {
            fetchGetJSON(constants.API_ROOT+'useremail/'+id+'/send_verification/')
                .then(json => {
                    this.onVerificationSent();
                })
                .catch(error => {
                    console.error('error', error);
                    if(error instanceof TypeError) {
                        error = 'You must be online to verify an email address.';
                    }
                    showErrorModal('Error Verifying Email Address', error);
                });
        }
        
        this.onVerificationSent = () => {
            showInfoModal(
                'Verification Email Sent',
                "We have sent you an email with instructions on how to verify"
                + " your email address.  If you have not received an email,"
                + " click the 'Verify' link to re-send the verification email."
            );
        }
                        
        this.onSave = (e) => {
            const errors = [];

            const json_data = {
                first_name: this.state.first_name,
                last_name: this.state.last_name,
                phone_number: this.state.phone_number,
                password: this.state.password,
                notify_type: this.state.notify_type
            };

            if(!json_data.first_name) {
                errors.push('You must enter a First Name.');
            }
            if(!json_data.last_name) {
                errors.push('You must enter a Last Name.');
            }
            if(json_data.phone_number) {
                if(!/^\d{3}-\d{3}-\d{4}$/.test(json_data.phone_number)) {
                    errors.push('Phone number must be entered as: XXX-XXX-XXXX');
                }
            } else {
                if(json_data.notify_type != constants.NOTIFY_TYPE.Email) {
                    errors.push('You must enter a phone number to receive SMS notifications');
                }
            }
   
            if((json_data.password || this.state.confirmPassword)
            && (json_data.password != this.state.confirmPassword)) {
                errors.push("The two password fields do not match.");
            }

            if(errors.length) {
                this.scrollTop();
                this.setState({errors: errors, info: null});
            } else {
                fetchPostJSON(constants.API_ROOT+'me/account/', json_data)
                    .then(json => {
                        console.debug('success', json);
                        this.props.dispatch(fetchUserSuccess(json));

                        this.scrollTop();
                        this.setState({
                            errors: [],
                            info: 'Your account has been updated!',
                            password: '',
                            confirmPassword: ''
                        });
                    })
                    .catch((error) => {
                        console.error('error', error);
                        if(error instanceof TypeError) {
                            errors.push('You must be online to update your account');
                        } else if(error.detail) {
                            for(var key in error.detail) {
                                errors.push(error.detail[key]);
                            }
                        } else {
                            errors.push('Error updating account: '+error.statusText);
                        }

                        this.scrollTop();
                        this.setState({errors: errors, info: null});
                    });
            }
        }
    }

    componentWillMount() {
        this.componentWillReceiveProps(this.props);
    }

    componentWillReceiveProps(nextProps) {
        const user = nextProps.user || this.props.user || {};

        this.setState({
            first_name: user.get('first_name', ''),
            last_name: user.get('last_name', ''),
            phone_number: user.get('phone_number', ''),
            notify_type: user.get('notify_type', constants.NOTIFY_TYPE.Email)
        });
    }

    render() {
        var hasSMS = this.props.user.get('apps').size;        
        var emailSet = Set();
        
        var nUnverified = this.props.user.get('emails').reduce(function(sum, useremail) {
            emailSet = emailSet.add(useremail.get('email'));
            
            if(!useremail.get('is_validated')) {
                return sum + 1;
            }
            return sum
        }, 0);
                
        return (
            <span>

            {this.state.errors.map(function(error, i) {
                return (
                    <ErrorAlert key={i} msg={error} />
                );
            }, this)}

            {(this.state.info) ? <InfoAlert msg={this.state.info} /> : null}

            <form autoComplete="nope">
                <div className="safari_hack" style={{left: "-50px", position: "fixed",width: "1px;"}}>
                  <input tabIndex="-1" name="email_hidden" type="email" style={{width:"1%"}}/>
                  <input tabIndex="-1" name="User_Password" type="password" style={{width:"1%"}}/>
                </div>
                <div className="form-group">
                    <label>First Name</label>
                    <input type="text" className="form-control" value={this.state.first_name}
                        required="true"
                        autoComplete="off"
                        onChange={this.onChangeFirstName} />
                </div>
                <div className="form-group">
                    <label>Last Name</label>
                    <input type="text" className="form-control" value={this.state.last_name}
                        required="true"
                        autoComplete="off"
                        onChange={this.onChangeLastName} />
                </div>
                {(hasSMS) ? (
                    <div className="form-group">
                        <label>Mobile Number</label>
                        <input type="text" className="form-control" value={this.state.phone_number}
                            placeholder="xxx-xxx-xxxx"
                            autoComplete="off"
                            maxLength="12"
                            onChange={this.onChangePhoneNumber} />
                    </div>
                ) : null}
                <div className="form-group">
                    <label>New Password <small>(leave blank for no change)</small></label>
                    <input type="password" className="form-control" value={this.state.password}
                        maxLength="10"
                        autoComplete="off"
                        onChange={this.onChangePassword} />
                    <small>Password must be at least 8 characters and contain at least one uppercase letter and one number.</small>
                </div>
                <div className="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" className="form-control" value={this.state.confirmPassword}
                        maxLength="10"
                        autoComplete="off"
                        onChange={this.onChangeConfirmPassword} />
                </div>               
                <div className="form-group">                    
                    <label>Email Addresses {(nUnverified > 0) ? '('+nUnverified+' Not Verified)' : ''}</label>
                    
                    {this.props.user.get('emails').map(function(useremail, i) {
                        return (
                            <UserEmail 
                                onSetPrimary={this.onSetPrimaryEmail}
                                onDelete={this.onDeleteEmail}
                                onArchive={this.onArchiveEmail}
                                onVerify={this.onVerifyEmail}
                                {...useremail.toJSON()} 
                            />
                        );                    
                    }, this)}
                    <p className="form-control-static">
                        <AddEmailAddress 
                            value={emailSet} 
                            dispatch={this.props.dispatch} 
                            onVerificationSent={this.onVerificationSent}
                        />
                    </p>            
                </div>
                {(hasSMS) ? (
                    <div className="form-group">
                        <label>Notifications</label>
                        <select className="form-control" value={this.state.notify_type} onChange={this.onChangeNotifyType}>
                            <option value={constants.NOTIFY_TYPE.Email}>Email</option>
                            <option value={constants.NOTIFY_TYPE.SMS}>SMS</option>
                            <option value={constants.NOTIFY_TYPE.Email_SMS}>Email & SMS</option>
                        </select>
                    </div>
                ) : null}
            </form>
            <button className="btn btn-primary btn-raised" onClick={this.onSave}>
                Update Account
            </button>
            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        error: state.get('error'),
        user: state.get('user')
    };
}

export const MyAccount = connect(mapStateToProps)(_MyAccount);
