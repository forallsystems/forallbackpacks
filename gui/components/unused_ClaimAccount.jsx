import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import * as constants from '../constants';
import {ErrorAlert, InfoAlert} from './common.jsx';
import {fetchPostJSON, addApp} from '../action_creators'
import {ClaimedAccountModal} from './Modals.jsx';

class _ClaimAccount extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            error: null,
            claim_code: ''
        };
        
        this.onChangeClaimCode = (e) => {
            this.setState({claim_code: e.target.value});
        };
        
        this.onSave = (e) => {             
            const json_data = {
                claim_code: this.state.claim_code
            };

            fetchPostJSON(constants.API_ROOT+'me/claim_account/', json_data)
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(addApp(json.app));
                    this.setState({error: null, claim_code: ''});
                                           
                    ClaimedAccountModal.show(json.org, json.account_url);
                })
                .catch((error) => {
                    console.error('error', error);                            
                    if(error instanceof TypeError) {
                        this.setState({error: 'You must be online to claim an account.'});
                    } else {
                        this.setState({error: 'Error claiming account: '+error.statusText});
                    }
                });
        };
    }

    render() {  
        return (
            <span>
            
            {(this.state.error) ? <ErrorAlert msg={this.state.error} /> : null}          
            
            <form>
                <div className="form-group">
                    <label>Claim Code</label>
                    <input type="text" className="form-control" value={this.state.claim_code} 
                        required="true"
                        onChange={this.onChangeClaimCode} />
                </div>
            </form>
            <button className="btn btn-primary btn-raised" onClick={this.onSave}
                disabled={(this.state.claim_code) ? '' : 'disabled'}>
                Claim Account
            </button>

            <ClaimedAccountModal />            
            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        error: state.get('error')
    };
}

export const ClaimAccount = connect(mapStateToProps)(_ClaimAccount);
