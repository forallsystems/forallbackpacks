import React from 'react';
import {connect} from 'react-redux';
import {Route, Link, Switch, withRouter} from 'react-router-dom';
import {List, Map} from 'immutable';
import moment from 'moment';
import Sidedrawer from 'react-sidedrawer';
import * as constants from '../constants';
import {redirectToLogin} from '../auth';
import {
    fetchPostJSON, fetchPatchJSON, fetchDeleteJSON, logout, setIsOffline, updateEntry,
    syncedAward, syncedEntry, syncSuccess
} from '../action_creators';
import {scrollTop, isOnline, LoadingIndicator, ErrorAlert} from './common.jsx';
import {NavHeader, NavFooter, NavEditFooter} from './Nav.jsx';
import {FilterBar} from './Filter.jsx';
import {
    showErrorModal, ErrorModal, showInfoModal, InfoModal, showConfirmModal, ConfirmModal,
    showProgressModal, hideProgressModal, ProgressModal, showLoginModal, LoginModal,
    ImageModal
} from './Modals.jsx';

// https://github.com/moment/moment/issues/537
moment.fn.fromNowOrNow = function (a) {
    if (Math.abs(moment().diff(this)) < 60000) { // ms
        return 'just now';
    }
    return this.fromNow(a);
}

// Used to auto-close sidebar if window width changes
const mql = window.matchMedia(`(min-width: 850px)`);

class SidebarNavLink extends React.Component {
    render() {
        var content = null;
        var target = '_self';

        if(this.props.to == this.props.curPath) {
            content = (
                <a href="javascript:void(0)" style={{color: 'white'}} onClick={this.props.onClick}>
                    <span style={{lineHeight: '2em'}}>
                        {this.props.name}
                    </span>
                    <span className="pull-right" style={{marginTop: '4px'}}>
                        <i className="fa fa-angle-right fa-lg"></i>
                    </span>
                </a>
            );
        } else if(this.props.to.match(/^https?:\/\//)) {
            if(this.props.newWindow) {
                target = '_blank';
            }
            content = (
                <a href={this.props.to} style={{color: 'white'}} onClick={this.props.onClick} target={target}>
                   <span style={{lineHeight: '2em'}}>
                        {this.props.name}
                    </span>
                    <span className="pull-right" style={{marginTop: '4px'}}>
                        <i className="fa fa-angle-right fa-lg"></i>
                    </span>
                </a>
            );
        } else {
            content = (
                <Link to={this.props.to} style={{color: 'white'}} onClick={this.props.onClick}>
                    <span style={{lineHeight: '2em'}}>
                        {this.props.name}
                    </span>
                    <span className="pull-right" style={{marginTop: '4px'}}>
                        <i className="fa fa-angle-right fa-lg"></i>
                    </span>
                </Link>
            );
        }

        return (
            <li className={this.props.className} style={{
                padding: '6px 0',
                fontSize: '1.2em',
                borderBottom: (this.props.border) ? '1px solid #fff' : 'none'
            }}>
                {content}
            </li>
         );
    }
}

SidebarNavLink.defaultProps = {
    border: true,
    newWindow: false
}


class _App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            mql: mql,
            sidebarOpen: false
        }

        this.openSidebar = this.onSetSidebarOpen.bind(this, true);
        this.closeSidebar = this.onSetSidebarOpen.bind(this, false);
        this.syncUpdates = this.syncUpdates.bind(this);

        // Auto-close sidebar on window expansion
        this.mediaQueryChanged = () => {
            if(this.state.mql.matches && this.state.sidebarOpen) {
                this.setState({sidebarOpen: false});
            }
        }
        
        // For LoginModal
        this.redirectToLogin = redirectToLogin.bind(this, this);
        
        // For NavHeader (see componentWillReceiveProps)
        this.goBack = () => {
            if(/^\/badges\/\w+/.test(this.props.location.pathname)) {
                var self = this;

                localforage.getItem('prevRoute').then(function(path) {
                    self.props.history.push(path);
                }).catch(function(error) {
                    console.error('Error getting previous route');
                    self.props.history.goBack();
                });
            } else if(/^\/entry\/view\/\w+/.test(this.props.location.pathname)) {
                this.props.history.push('/eportfolio');
            } else {
                this.props.history.goBack();
            }
        }
        
        // For NavHeader
        this.refresh = (e) => {
            window.location.reload();
        }

        // For sync status bar
        this.toggleOffline = () => {
            this.closeSidebar();

            if(this.props.isOffline) {
                if(this.props.toSync) {
                    this.syncUpdates();                
                } else {
                    this.props.dispatch(setIsOffline(false)); 
                }
            } else {
                this.props.dispatch(setIsOffline(true)); 
            }
        }

        // For sidebar content
        this.logout = () => {
            var self = this;

            isOnline('logout', () => {
                if(self.props.toSync) {
                    showConfirmModal(
                        'Confirm Logout',
                        'You have updates that need to be synced.  <b>If you logout, these updates will be discarded.</b>  Are you sure you want to logout?',
                        function() {
                            self.props.dispatch(logout());
                        }
                    );
                } else {
                    self.props.dispatch(logout());
                }
            });
        }
    }

    onSetSidebarOpen(open) {
        this.setState({sidebarOpen: open});
    }

    componentWillMount() {
        mql.addListener(this.mediaQueryChanged);
        this.setState({mql: mql, sidebarOpen: false});
    }

    componentWillReceiveProps(nextProps) {
        if(this.props.location.pathname != nextProps.location.pathname) {
            // Scroll to top on path changes
            scrollTop();

            // Cache current route when navigating to badge details from Badges or Timeline
            if(/^\/badges\/\w+/.test(nextProps.location.pathname)
            && /^\/(timeline)|(badges$)/.test(this.props.location.pathname))
            {
                console.debug('Stashing route');
                localforage.setItem(
                    'prevRoute', this.props.location.pathname+this.props.location.search
                ).catch(function(error) {
                    console.error('Error stashing previous route');
                });
            }
        }
    }

    componentWillUnmount() {
        this.state.mql.removeListener(this.mediaQueryChanged);
    }

    syncAttachments(entryJSON, sectionIndex) {
        return entryJSON.sections[sectionIndex].attachments.map((attachment, i) => {
            if(attachment.id) {
                return Promise.resolve(null);
            }
        
            attachment.section = entryJSON.sections[sectionIndex].id;
        
            return fetchPostJSON(constants.API_ROOT+'attachment/', attachment)
                .then((json) => {
                    console.debug('success', json);
                    entryJSON.sections[sectionIndex].attachments[i] = json;
                    this.props.dispatch(updateEntry(entryJSON));
                })
        }, this);
    }
    
    syncEntries() {
        // Sync dirty entries; deleted, created, modified
        return this.props.entryMap
            .filter((o) => { return o.get('dirty', false); })
            .toList()
            .toJS()
            .map((entry) => {
                var sectionIndex = entry.sections.length - 1;
 
                if(entry.is_deleted) {
                    if(entry.sections[sectionIndex].id) {
                        return fetchDeleteJSON(constants.API_ROOT+'entry/'+entry.id+'/')
                            .then(json => {
                                console.debug('success');
                                this.props.dispatch(syncedEntry(entry));
                            });
                    } else {
                        // Entry not synced, nothing to delete
                        this.props.dispatch(syncedEntry(entry));
                        return Promise.resolve(null);
                    }
                }
                                
                if(entry.sections[sectionIndex].id) {
                    // Save attachments, then entry
                    return Promise.all(
                        this.syncAttachments(entry, sectionIndex)
                    )
                    .then(() => {
                        return fetchPatchJSON(constants.API_ROOT+'entry/'+entry.id+'/', {
                            sections: entry.sections,
                            tags: entry.tags                       
                        })
                        .then((entryJSON) => {
                            console.debug('success', entryJSON);
                            this.props.dispatch(syncedEntry(entryJSON));
                        });
                    })                
                } else {
                    // Save entry, then attachments
                    var sectionsPostData = entry.sections.map((section) => {
                        return {
                            id: section.id,
                            title: section.title,
                            text: section.text,
                            attachments: [] // send without attachments
                        };
                    });
                                        
                    return fetchPostJSON(constants.API_ROOT+'entry/', {
                        id: entry.id,
                        sections: sectionsPostData,
                        tags: entry.tags
                    })  
                    .then((entryJSON) => {
                        console.debug('success', entryJSON);
                        
                        // retain dirty flag and re-attach attachments
                        entryJSON.dirty = true;
                        
                        entryJSON.sections.forEach(function(sectionJSON, i) {
                            sectionJSON.attachments = entry.sections[i].attachments;
                        });
                        
                        this.props.dispatch(updateEntry(entryJSON));
                        
                        return Promise.all(
                            this.syncAttachments(entryJSON, sectionIndex)
                        )
                        .then(() => {
                            this.props.dispatch(syncedEntry(entryJSON));
                        });
                    });            
                }
            }, this);
    }

    syncAwards() {
        // Sync dirty awards; deleted, tags modified
        return this.props.awardMap
            .filter((o) => { return o.get('dirty', false); })
            .toList()
            .toJS()
            .map((award) => {
                if(award.is_deleted) {
                    return fetchDeleteJSON(constants.API_ROOT+'award/'+award.id+'/')
                        .then(json => {
                            console.debug('success');
                            this.props.dispatch(syncedAward(award));
                        });
                }

                return fetchPostJSON(constants.API_ROOT+'award/'+award.id+'/tags/', award.tags)
                    .then(json => {
                        console.debug('success');
                        this.props.dispatch(syncedAward(json));
                    });
            }, this);
    }

    syncUpdates() {
        showProgressModal('Syncing updates');
        
        Promise.all(this.syncEntries())
            .then(() => {
                console.debug('entry sync success');
                return Promise.all(this.syncAwards());
            })
            .then(() => {
                console.debug('award sync success');
                this.props.dispatch(syncSuccess(moment.utc().format()));

                hideProgressModal();
                
                this.props.dispatch(setIsOffline(false)); 
                showInfoModal('Success!', 'Your updates have been synced.');
            })
            .catch((error) => {
                console.error('sync error', error);
                
                hideProgressModal();

                if(error instanceof TypeError) {
                    console.error('sync error, no network connection');
                    showErrorModal(
                        'Sync Error',
                        'Error syncing updates (no network connection).'
                    );
                } else if(error.status == 401 || error.status == 403) {
                    console.error('sync error, unauthorized');
                    showLoginModal(
                        'Sync Error',
                        'Error syncing updates.  You must re-login before your updates can be synced.'
                    );
                } else {
                    console.error('sync error', error);
                    showErrorModal(
                        'Sync Error',
                        'Error syncing updates ('+(error.statusText  || 'unknown error')+').'
                    );
                }
            });
    }

    render() {
        var pathname = this.props.location.pathname;
        var nApps = this.props.apps.size;

        var sidebarContent = (
            <div className="sidebarContent">
                <div className="text-center visible-xs">
                    <img src='img/fb_logo_menu.png' width='100%' />
                </div>
                <div className="text-center hidden-xs" style={{maxWidth: '240px', margin: 'auto'}}>
                    <img src='img/fb_logo_vertical_menu.png' width='100%' />
                </div>
                <div style={{borderBottom: '1px solid black', color: '#046446', fontWeight: 600}}>
                    <h4 style={{display: 'inline-block', fontWeight: 600, width: '75%', wordBreak:'break-all'}}>
                        {this.props.user.get('first_name')+' '+this.props.user.get('last_name')}
                    </h4>
                    <a href="javascript:void(0)" className="pull-right" onClick={this.logout} style={{
                        marginTop: '12px', textDecoration: 'underline', color: '#046446'
                    }}>
                        Log Out
                    </a>
                </div>
                <ul className="list-unstyled">
                    <SidebarNavLink name="Badges" to="/badges" onClick={this.closeSidebar}
                        curPath={pathname} />
                    <SidebarNavLink name="Timeline" to="/timeline" onClick={this.closeSidebar}
                        curPath={pathname} />
                    <SidebarNavLink name="ePortfolio" to="/eportfolio" onClick={this.closeSidebar}
                        curPath={pathname} />
                    <SidebarNavLink name="My Account" to="/my-account" onClick={this.closeSidebar}
                        curPath={pathname} border={nApps > 0} />
                    {this.props.apps.map(function(data, i) {
                        return (
                            <SidebarNavLink name={data.get('app_name')} to={data.get('app_url')}
                                onClick={this.closeSidebar}
                                border={i < nApps - 1}
                                newWindow={true}
                            />
                        );
                    }, this)}
                </ul>
                <div style={{position: 'absolute', bottom: 0, paddingBottom: '20px', fontSize: '.9em'}}>
                  <p>
                      <i>This app was made possible by the <br/><a href="http://www.cnusd.k12.ca.us" style={{color: '#fff', textDecoration: 'underline'}}>Corona Norco Unified School District</a>.</i>
                  </p>
                  <p>
                      <i>Powered by the <a href="http://www.forallsystems.com" style={{color: '#fff', textDecoration: 'underline'}}>ForAllSystems Platform</a></i>
                  </p>
                  <p>
                      <i><a href="https://www.forallsystems.com/termsofuse/" style={{color: '#fff', textDecoration: 'underline'}}>Terms of Use & Privacy Policy</a></i>
                  </p>
                </div>
            </div>
        );

        if(this.props.error) {
            return (
                <ErrorAlert msg={this.props.error} />
            );
        }

        if(!this.props.loaded) {
            return (
                <LoadingIndicator />
            );
        }

        var pathInfo = constants.PATH_INFO(this.props.location.pathname);

        var offlineStatusBar = null;

        if(!pathInfo.editFooter) {
            if(this.props.isOffline) {
                offlineStatusBar = (
                    <div className="row">
                        <div className="col-xs-12 col-sm-offset-5 col-sm-7 col-md-offset-4 col-md-8 col-lg-offset-3 col-lg-9 offlineStatusBarContainer"
                            style={{backgroundColor:'#ff5722', color:'white', padding: '4px 8px'}}>
                            <div className="row">
                                <div className="col-xs-12" style={{paddingTop:'3px'}}>
                                    <i className="fa fa-refresh" aria-hidden="true" style={{fontSize: '1.4em', verticalAlign:'middle'}}></i>
                                    &nbsp;&nbsp;
                                    {this.props.toSync} {(this.props.toSync == 1) ? 'update' : 'updates'} to sync
                                    <div className="hidden-xs" style={{display:'inline-block', float:'right',  marginLeft:'8px'}}>
                                        <a href="javascript:void(0)" onClick={this.toggleOffline} style={{color:'white'}}>
                                            <i className="fa fa-2x fa-toggle-on" aria-hidden="true"
                                                style={{verticalAlign:'middle', marginTop: '-3px'}}></i>
                                            &nbsp;
                                            Offline Mode
                                        </a>
                                    </div>
                                    {(this.props.lastSync) ? (
                                        <div style={{display:'inline-block', float:'right'}}>
                                            Updated {moment(this.props.lastSync).fromNowOrNow()}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                    </div>
                );
            } else {
                offlineStatusBar = (
                    <div className="row">
                        <div className="hidden-xs col-sm-offset-5 col-sm-7 col-md-offset-4 col-md-8 col-lg-offset-3 col-lg-9 offlineStatusBarContainer"
                            style={{backgroundColor: 'white', padding: '4px 8px'}}>
                            <div style={{display:'inline-block', float:'right', paddingTop:'4px', fontWeight:'bold'}}>
                                <a href="javascript:void(0)" onClick={this.toggleOffline}>
                                <i className="fa fa-2x fa-toggle-off" aria-hidden="true"
                                    style={{verticalAlign:'middle', marginTop: '-3px'}}></i>
                                &nbsp;
                                Offline Mode
                                </a>
                            </div>
                        </div>
                    </div>
                )
            }
        }

        return (
            <span>

            <Sidedrawer open={this.state.sidebarOpen} onClose={this.closeSidebar} customClassNames={{
                sidedrawer: 'custom-sidedrawer',
                overlay: 'custom-sidedrawer-overlay'
            }}>
                {sidebarContent}
            </Sidedrawer>

            <LoginModal onLogin={this.redirectToLogin} />
            <ErrorModal />
            <InfoModal />
            <ConfirmModal />
            <ProgressModal />
            <ImageModal />

            <div className="row" style={{height: '100%'}}>
                <div className="hidden-xs col-sm-5 col-md-4 col-lg-3"
                    style={{height: '100%', marginLeft: '-15px'}}>
                    {sidebarContent}
                </div>
                <div id="contentContainer" className={"col-xs-12 col-sm-7 col-md-8 col-lg-9 contentContainer "+pathInfo.containerClass}>
                    {this.props.children}

                    <div className="row">
                        <div className="col-xs-12" style={{
                            height: '80px' // clear NavFooter
                        }}>
                            &nbsp;
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12 col-sm-offset-5 col-sm-7 col-md-offset-4 col-md-8 col-lg-offset-3 col-lg-9"
                    style={{position: 'fixed', top: 0, zIndex: 2}}>
                    <NavHeader
                        pathname={this.props.location.pathname}
                        onSidebarToggle={this.openSidebar}
                        onGoBack={this.goBack}
                        onRefresh={(this.props.isOffline || pathInfo.editFooter) ? null : this.refresh}
                    />
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12 col-sm-offset-5 col-sm-7 col-md-offset-4 col-md-8 col-lg-offset-3 col-lg-9"
                    style={{ position: 'fixed', bottom: 0}}>
                    {(pathInfo.editFooter) ? (
                        <NavEditFooter onCancel={this.goBack} />
                    ) : (
                        <NavFooter
                            pathname={this.props.location.pathname}
                            isOffline={this.props.isOffline}
                            onClickOffline={this.toggleOffline}
                        />
                    )}
                </div>
            </div>

            {offlineStatusBar}

            </span>
        );
    }
};

function mapStateToProps(state) {
    return {
        isOffline: state.get('isOffline', false),
        lastSync: state.get('lastSync', null),
        toSync: state.get('toSync', 0),
        error: state.get('error'),
        loaded: state.get('loaded'),
        user: state.get('user', Map()),
        apps: state.getIn(['user', 'apps'], List()),
        awardMap: state.getIn(['awards', 'itemsById'], new Map()),
        entryMap: state.getIn(['entries', 'itemsById'], new Map())
    };
}

export const App = withRouter(connect(mapStateToProps)(_App));
