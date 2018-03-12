import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import * as constants from '../constants';
import {ErrorAlert, InfoAlert} from './common.jsx';
import {fetchPostJSON, addAward} from '../action_creators'

class _ClaimBadge extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            error: null,
            info: null,
            claim_code: ''
        };
        
        this.onChangeClaimCode = (e) => {
            this.setState({claim_code: e.target.value});
        };
        
        this.onSave = (e) => {             
            const json_data = {
                claim_code: this.state.claim_code
            };
            
            fetchPostJSON(constants.API_ROOT+'me/claim_badge/', json_data)
                .then(json => {
                    console.debug('success', json);
                    this.props.dispatch(addAward(json));

                    this.setState({
                        error: null, 
                        info: 'Your badge has been claimed!', 
                        claim_code: ''
                    });                        
                })
                .catch((error) => {
                    console.error('error', error);                            
                    if(error instanceof TypeError) {
                        this.setState({error: 'You must be online to claim a badge.'});                        
                    } else {
                        this.setState({
                            error: 'Error claiming badge: '+error.statusText,
                            info: null
                        });
                    }
                });      
        };
    }

    render() {  
        return (
            <span>
            
            {(this.state.error) ? <ErrorAlert msg={this.state.error} /> : null}          
            
            {(this.state.info) ? <InfoAlert msg={this.state.info} /> : null}
            
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
                Claim Badge
            </button>

            </span>
        );
    }
}

function mapStateToProps(state) {
    return {
        error: state.get('error')
    };
}

export const ClaimBadge = connect(mapStateToProps)(_ClaimBadge);
