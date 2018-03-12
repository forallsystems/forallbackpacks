import React from 'react';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import {connect} from 'react-redux';
import {List, Map, Set} from 'immutable';
import * as constants from '../constants';
import {parseQueryString, dispatchCustomEvent, InfoAlert, ErrorAlert, LoadingIndicator} from './common.jsx';
//import {FilterModal, FilterBar} from './Filter.jsx';


class _Timeline extends React.Component {
    constructor(props) {
        super(props);

//      this.filterAwards = this.filterAwards.bind(this);
        this.getTimelineEvents = this.getTimelineEvents.bind(this);
        this.makeTimeline = this.makeTimeline.bind(this);

/*
        this.showFilterModal = (e) => {
            FilterModal.show(this.props.filter);
        }
*/
        this.state = {
            eventList: this.getTimelineEvents(props)
        };
    }

    handleEvent(e) {
        switch(e.type) {
            case 'timelineViewBadgeDetails':
                this.props.history.replace(this.props.history.location.pathname+'?uid='+e.detail.uid);
                this.props.history.push('/badges/'+e.detail.uid);
                break;
        }
    }

    componentDidMount() {
        document.addEventListener('timelineViewBadgeDetails', this, false);
        this.makeTimeline(this.state.eventList);
    }

    componentWillUnmount() {
        document.removeEventListener('timelineViewBadgeDetails', this, false);
    }

    componentWillReceiveProps(nextProps) {
        if((this.props.filter != nextProps.filter)
        || (this.props.awardMap != nextProps.awardMap)) {
            var eventList = this.getTimelineEvents(nextProps);

            this.setState({eventList: eventList});
            this.makeTimeline(eventList);
        }
    }
/*
    filterAwards(props) {
        var filter = props.filter;

        var startDate = filter.get('startDate');
        var endDate = filter.get('endDate');
        var issuerSet = new Set(filter.get('issuers'));
        var tagSet = new Set(filter.get('tags'));

        return props.awardMap.toList().filter(function(item) {
            var issued_date = item.get('issued_date');

            if(startDate && (issued_date < startDate)) {
                return false;
            }
            if(endDate && (issued_date > endDate)) {
                return false;
            }

            if(issuerSet.size && !issuerSet.has(item.get('issuer_org_name'))) {
                return false;
            }

            if(tagSet.subtract(item.get('tags')).size) {
                return false;
            }

            return true;
        }, this);
    }
*/
    getTimelineEvents(props) {
        // NO FILTERING FOR NOW
        // var awardList = this.filterAwards(props);

 //     return awardList
        return props.awardMap.toList()
            .filter((award) => award.get('issued_date'))
            .sortBy(award => award.get('issued_date'))
            .toJS()
            .map((award, i) => {
                var issuedDate = award.issued_date.replace(/-/g, ',');

                return {
                    "unique_id": award.id,
                    "startDate": issuedDate,
                    "endDate": issuedDate,
                    "headline": award.badge_name,
                    "text": '<a href="javascript:void(0)" onClick="timelineViewBadgeDetails(\''+award.id+'\')">View Details</a>',
                    "asset":  {
                        "media": award.badge_image_data_uri,
                        "thumbnail": award.badge_image_data_uri,
                        "caption": 'Issued by '+award.issuer_org_name
                    }
                };
            });
    }

    makeTimeline(eventList) {
        $(global).unbind(); // Need this when reloading timeline
        $('#timeline-embed').html('');

        if(eventList.length) {
            var self = this;
            var startAtSlide = 1;
            var params = parseQueryString(this.props.location.search);

            if(params.uid) {
                for(var i = 0; i < eventList.length; i++) {
                    if(params.uid == eventList[i].unique_id) {
                        startAtSlide = i+1;
                        break;
                    }
                }
            }

            createStoryJS({
                type: 'timeline',
                width: '100%',
                height: '80%',
                start_at_slide: startAtSlide,
                source: {
                    "timeline": {
                        "headline": "My Timeline",
                        "type": "default",
                        "text": "Welcome to your badge timeline!  Use the arrows to navigate between your badges, or use the area below to explore all of your awarded badges.",
                        "date": eventList
                    }
                },
                embed_id: 'timeline-embed'
            });
        }
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
        } else if(!this.state.eventList.length) {
            content = (
                <InfoAlert msg="No badges found" />
            );
        }

/*
            <div className="row">
                <div className="filterBarContainer" >
                    <FilterBar
                        dispatch={this.props.dispatch}
                        tagType={constants.TAG_TYPE.Award}
                        count={this.state.eventList.length}
                        filter={this.props.filter}
                        onClickFilter={this.showFilterModal}
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12 filteredContentContainer">
                    {content}
                </div>
            </div>
*/
        return (
            <span>

            <div className="row">
                <div className="col-xs-12">
                    {content}
                </div>
            </div>

           <div id="timeline-embed" style={{zIndex: 0}}></div>


            </span>
        );
/*
            <FilterModal
                type='Badges'
                dispatch={this.props.dispatch}
                tagType={constants.TAG_TYPE.Award}
                issuers={this.props.issuers}
                tags={this.props.tags}
            />
*/
    }
}

function mapStateToProps(state) {
    return {
        loading: state.getIn(['awards', 'loading'], false),
        error: state.getIn(['awards', 'error'], null),
//      filter: state.getIn(['filter', constants.TAG_TYPE.Award], new Map()),
//      issuers: state.get('issuers', new List()),
//      tags: state.getIn(['tags', constants.TAG_TYPE.Award], new List()),
        awardMap: state.getIn(['awards', 'itemsById'], new Map())
    };
}

export const Timeline = connect(mapStateToProps)(_Timeline);
