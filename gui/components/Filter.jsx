import React from 'react'
import {connect} from 'react-redux';
import {List, Map} from 'immutable';
import moment from 'moment';
import * as constants from '../constants';
import {dispatchCustomEvent, ErrorAlert}  from './common.jsx';
import {Modal} from './Modals.jsx';

var DatePicker = require("react-bootstrap-date-picker");

export const filterBgColor = '#dedede';
const filterBarColor = '#515151';

const filterDateDisplayFormat = 'M/D/YY';
const filterDateStoreFormat = 'YYYY-MM-DD';


export class FilterBar extends React.Component {
    constructor(props) {
        super(props);

        this.onClearFilter = (e) => {
            this.props.dispatch({
                type: 'SET_FILTER',
                filterType: this.props.tagType,
                filter: constants.DEFAULT_STATE.filter[this.props.tagType]
            });
        }
    }

    render() {
        // Compose filter text
        var label = '';
        var filters = [];

        switch(this.props.tagType) {
            case constants.TAG_TYPE.Award:
                label = (this.props.count == 1) ? 'Badge' : 'Badges';
                break;

            case constants.TAG_TYPE.Entry:
                label = (this.props.count == 1) ? 'Entry' : 'Entries';
                break;
        }

        var startDate = this.props.filter.get('startDate');
        if(startDate) {
            filters.push('Start Date: '+moment(startDate, filterDateStoreFormat).format(filterDateDisplayFormat));
        }

        var endDate = this.props.filter.get('endDate');
        if(endDate) {
            filters.push('End Date: '+moment(endDate, filterDateStoreFormat).format(filterDateDisplayFormat));
        }

        var issuers = this.props.filter.get('issuers', []).join(', ');
        if(issuers) {
            filters.push('Issuers: '+issuers);
        }

        var shared = [];
        if(this.props.filter.get('isShared')) {
            shared.push('Is Shared');
        }
        if(this.props.filter.get('wasShared')) {
            shared.push('Was Shared');
        }
        if(this.props.filter.get('neverShared')) {
            shared.push('Never Shared');
        }
        if(shared.length) {
            filters.push('Shared: '+shared.join(', '));
        }
        
        var tags = this.props.filter.get('tags', []).join(', ');
        if(tags) {
            filters.push('Tags: '+tags);
        }
        
        var filterText = filters.join(', ');

        var style = {width: '100%'};
        
        if(this.props.hasMenu) {
            style = {
                width: '-webkit-calc(100% - 38px)',
                width: 'calc(100% - 38px)'            
            } 
        } 
        
        return (
            <div className="pull-left" style={style}>
                <div style={{
                    backgroundColor:filterBgColor,
                    color:filterBarColor,
                    paddingTop:'8px',
                    paddingLeft:'8px',
                    paddingBottom:'4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
               }}>
                    <span style={{
                        display: 'inline-block',
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                    }}>
                        {this.props.count} {label}&nbsp;&middot;&nbsp;
                    </span>
                    <span onClick={this.props.onClickFilter} style={{
                        display: 'inline-block',
                        textDecoration: 'underline',
                        maxWidth: '-webkit-calc(100% - 110px)',
                        maxWidth: 'calc(100% - 110px)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer'
                    }}>
                        {filterText || 'No Filter Applied'}
                    </span>
                     {(filterText) ? (
                         <a title="Clear Filter" onClick={this.onClearFilter}
                             style={{
                                 marginLeft: '8px',
                                 cursor: 'pointer',
                                 color: '#333'
                            }}>
                            <i className="fa fa-window-close fa-lg" aria-hidden="true" style={{
                                verticalAlign: '20%'
                            }}></i>
                         </a>
                     ) : null}
               </div>
            </div>
        );
    }
}

function FilterSection(props) {
    return (
        <span>
            <div style={{paddingTop: '10px', fontSize: '1.2em'}}>
                <a className="filter-section-toggle" data-toggle="collapse" href={'#'+props.id} aria-expanded={props.expanded}
                    onClick={(e) => { props.onToggle(props.id) }}
                    style={{
                        position: 'relative',
                        color: 'black',
                        textDecoration: 'none'
                    }}>
                    <span style={{marginLeft: '30px',fontWeight:'bold'}}>{props.title}</span>
                </a>
            </div>
            <div className={"collapse form-group" + ((props.expanded) ? " in" : "")} id={props.id} style={{
                margin: '0px',
                paddingLeft: '30px'
            }}>
                {props.children}
            </div>
        </span>
    );
}

export class FilterModal extends Modal {
    constructor(props) {
        super(props);

        this.eventId = 'showFilterModal';

        this.state = {
            error: null,
            showErrorAlert: false,
            startDate: '',
            endDate: '',
            isShared: false,
            wasShared: false,
            neverShared: false,
            issuers: [],
            tags: [],
            dateFocused: 0,
            minModalBodyHeight: '115px',
            filterDateRange: false, // expanded state per FilterSection
            filterIssuers: false,
            filterShared: false,
            filterTags: false
        }

        this.hideErrorAlert = () => {
            this.setState({showErrorAlert: false});
        }

        // Track if a FilterSection expanded state
        this.onSectionToggle = (id) => {
            this.setState({[id]: !this.state[id]});
        }

        // Track if a DatePicker has focus to ensure room in the modal-body for popover
        this.handleDateFocus = () => {
            var dateFocused = this.state.dateFocused + 1;
            this.setState({
                dateFocused: dateFocused,
                minModalBodyHeight: '340px'
            });
        }
        this.handleDateBlur = () => {
            var dateFocused = this.state.dateFocused - 1;
            this.setState({
                dateFocused: dateFocused,
                minModalBodyHeight: (dateFocused) ? '340px': '115px'
            });
        }

        this.handleChangeStartDate = (value, formattedValue) => {
            this.setState({
                startDate: (value) ? moment(value).format(filterDateStoreFormat) : ''
            });
        }
        this.handleChangeEndDate = (value, formattedValue) => {
            this.setState({
                endDate: (value) ? moment(value).format(filterDateStoreFormat) : ''
            });
        }

        this.onChangeAttr = (e) => {
            this.setState({[e.target.value]: e.target.checked});   
        }

        this.onChangeIssuer = (e) => {
            var value = e.target.value;

            if(e.target.checked) {
                this.setState({issuers: this.state.issuers.push(value)});
            } else {
                this.setState({issuers: this.state.issuers.filter(v => v != value)});
            }
        }
                
        this.onChangeIsShared = (e) => {
            this.setState({isShared: e.target.checked});
        }

        this.onChangeWasShared = (e) => {
            this.setState({wasShared: e.target.checked});
        }

        this.onChangeNeverShared = (e) => {
            this.setState({neverShared: e.target.checked});
        }

        this.onChangeTag = (e) => {
            var value = e.target.value;

            if(e.target.checked) {
                this.setState({tags: this.state.tags.push(value)});
            } else {
                this.setState({tags: this.state.tags.filter(v => v != value)});
            }
        }

        this.onSave = (e) => {
            var errors = [];

            var startDate = this.state.startDate;
            var endDate = this.state.endDate;

            // We shouldn't see this error anymore, but just in case...
            if(startDate && endDate && startDate > endDate) {
                errors.push('Start Date is after End Date');
            }

            if(errors.length) {
                this.setState({
                    error: 'Please fix these issues: '+errors.join(', '),
                    showErrorAlert: true
                });
            } else {
                this.hideModal();

                this.props.dispatch({
                    type: 'SET_FILTER',
                    filterType: this.props.tagType,
                    filter: {
                        startDate: startDate,
                        endDate: endDate,
                        issuers: this.state.issuers,
                        tags: this.state.tags,
                        isShared: this.state.isShared,
                        wasShared: this.state.wasShared,
                        neverShared: this.state.neverShared
                    }
                });
            }
        }
    }

    renderContent() {
        var showIssuers = (this.props.tagType == constants.TAG_TYPE.Award);
        var issuersContent = null;
        var tagsContent = null;
       
        if(this.props.issuers && showIssuers) {
            issuersContent = this.props.issuers.map(function(name, i) {
                return (
                     <div key={i} className="checkbox">
                        <label>
                            <input type="checkbox" value={name}
                                checked={this.state.issuers.indexOf(name) > -1}
                                onChange={this.onChangeIssuer}
                            /> {name}
                        </label>
                    </div>
                )
            }, this);
        }

        if(this.props.tags) {
            tagsContent = this.props.tags.map(function(name, i) {
                return (
                     <div key={i} className="checkbox">
                        <label>
                            <input type="checkbox" value={name}
                                checked={this.state.tags.indexOf(name) > -1}
                                onChange={this.onChangeTag}
                            /> {name}
                        </label>
                    </div>
                )
            }, this);
        }
        
        return (
            <div className="modal-content">
                <div className="modal-header" style={{
                    backgroundColor: filterBgColor,
                    padding: '10px',
                    borderBottom: '1px solid #bbb'
                }}>
                    <div className="row">
                        <div className="col-xs-2">
                            <button type="button" className="btn pull-left" onClick={this.hideModal} style={{
                                margin: 0,
                                padding: '4px'
                            }}>
                                <i className="fa fa-times fa-2x" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div className="col-xs-8 text-center" style={{
                            fontWeight: 500,
                            fontSize: '1.2em',
                            lineHeight: 2,
                        }}>
                            Filter My {this.props.type}
                        </div>
                        <div className="col-xs-2">
                            <button type="button" className="btn pull-right" onClick={this.onSave} style={{
                                margin: 0,
                                padding: '4px'
                            }}>
                                <i className="fa fa-check fa-2x text-primary" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div ref={(el) => {this.modalBody = el;}} className="modal-body" style={{
                    backgroundColor: filterBgColor,
                    paddingTop: 0,
                    minHeight: this.state.minModalBodyHeight,
                    maxHeight: '500px',
                    overflow: 'scroll'
                }}>
                    {(this.state.showErrorAlert) ? (
                        <ErrorAlert msg={this.state.error} onClose={this.hideErrorAlert} />
                    ) : null}

                    <form>
                        <FilterSection id="filterDateRange" title="Date Range"
                            onToggle={this.onSectionToggle}
                            expanded={this.state.filterDateRange}
                        >
                            <div style={{width: '134px', display: 'inline-block'}}>
                                <DatePicker
                                    value={this.state.startDate}
                                    onFocus={this.handleDateFocus}
                                    onBlur={this.handleDateBlur}
                                    onChange={this.handleChangeStartDate}
                                    placeholder="Start Date"
                                    maxDate={(this.state.endDate) ? this.state.endDate : ''}
                                    calendarPlacement="bottom"
                                    calendarContainer={this.modalBody}
                                />
                            </div>
                            &nbsp;
                            <div style={{width: '134px', display: 'inline-block'}}>
                                <DatePicker
                                    value={this.state.endDate}
                                    onFocus={this.handleDateFocus}
                                    onBlur={this.handleDateBlur}
                                    onChange={this.handleChangeEndDate}
                                    placeholder="End Date"
                                    minDate={(this.state.startDate) ? this.state.startDate : ''}
                                    calendarPlacement="bottom"
                                    calendarContainer={this.modalBody}
                                />
                            </div>
                        </FilterSection>
                        {(showIssuers) ? (
                            <FilterSection id="filterIssuers" title="Issuer"
                                onToggle={this.onSectionToggle}
                                expanded={this.state.filterIssuers}
                            >
                                {(issuersContent && issuersContent.size) ? issuersContent :
                                    <span><i>No issuers found</i></span>
                                }
                            </FilterSection>
                        ): null}
                        <FilterSection id="filterShared" title="Shared"
                            onToggle={this.onSectionToggle}
                            expanded={this.state.filterShared}
                        >
                            <div className="checkbox">
                                <label>
                                    <input type="checkbox" value="1"
                                        checked={this.state.isShared}
                                        onChange={this.onChangeIsShared}
                                    /> Is Shared
                                </label>
                            </div>                            
                            <div className="checkbox">
                                <label>
                                    <input type="checkbox" value="1"
                                        checked={this.state.wasShared}
                                        onChange={this.onChangeWasShared}
                                    /> Was Shared
                                </label>
                            </div>                            
                            <div className="checkbox">
                                <label>
                                    <input type="checkbox" value="1"
                                        checked={this.state.neverShared}
                                        onChange={this.onChangeNeverShared}
                                    /> Never Shared
                                </label>
                            </div>                            
                        </FilterSection>
                        <FilterSection id="filterTags" title="Tags"
                            onToggle={this.onSectionToggle}
                            expanded={this.state.filterTags}
                        >
                            {(tagsContent && tagsContent.size) ? tagsContent :
                                <span><i>No tags found</i></span>
                            }
                        </FilterSection>
                    </form>
                </div>
            </div>
        );
    }
}

FilterModal.show = function(filter) {
    var startDate = filter.get('startDate', '');
    var endDate = filter.get('endDate', '');
    var issuers = filter.get('issuers', []);
    var isShared = filter.get('isShared', false);
    var wasShared = filter.get('wasShared', false);
    var neverShared = filter.get('neverShared', false);
    var tags = filter.get('tags', []);

    dispatchCustomEvent('showFilterModal', {
        error: null,
        showErrorAlert: false,
        startDate: startDate,
        endDate: endDate,
        isShared: isShared,
        wasShared: wasShared,
        neverShared: neverShared,
        issuers: issuers,
        tags: tags,
        dateFocused: 0,
        minModalBodyHeight: '115px',
        filterDateRange: (startDate.length + endDate.length) > 0,
        filterIssuers: issuers.size > 0,
        filterShared:  isShared || wasShared || neverShared,
        filterTags: (tags.size > 0)
    });
}
