import React from 'react';
import {connect} from 'react-redux';
import {Route, Link, Switch, withRouter} from 'react-router-dom';
import {List, Map} from 'immutable';
import Sidedrawer from 'react-sidedrawer';
import * as constants from '../constants';
import {logout} from '../action_creators';
import {LoadingIndicator, ErrorAlert} from './common.jsx';
import {NavHeader, NavFooter, NavEditFooter} from './Nav.jsx';
import {FilterBar} from './Filter.jsx';
import {
    showErrorModal, ErrorModal, InfoModal, ConfirmModal, ProgressModal
} from './Modals.jsx';

// Used to auto-close sidebar if window width changes
const mql = window.matchMedia(`(min-width: 768px)`);

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

        this.openSidebar = this.onSetSidebarOpen.bind(this, true);
        this.closeSidebar = this.onSetSidebarOpen.bind(this, false);

        // Auto-close sidebar on window expansion
        this.mediaQueryChanged = () => {
            if(this.state.mql.matches && this.state.sidebarOpen) {
                this.setState({sidebarOpen: false});
            }
        }

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

        // For sidebar content
        this.logout = () => {
            this.props.dispatch(logout());
        }

        this.state = {
            mql: mql,
            sidebarOpen: false
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
            document.getElementsByTagName('body')[0].scrollTop = 0;
            document.getElementById('contentContainer').scrollTop = 0;
                
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
                      <i>This website was made possible by the <br/><a href="http://www.cnusd.k12.ca.us" style={{color: '#fff', textDecoration: 'underline'}}>Corona Norco Unified School District</a>.</i>
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
        var footer = null;
        
        if(pathInfo.editFooter) {
            footer = (
                <NavEditFooter onCancel={this.goBack} />
            );
        } else {
            footer = (
                <NavFooter pathname={this.props.location.pathname} apps={this.props.apps} />
            );
        }

        return (
            <span>

            <Sidedrawer open={this.state.sidebarOpen} onClose={this.closeSidebar} customClassNames={{
                sidedrawer: 'custom-sidedrawer',
                overlay: 'custom-sidedrawer-overlay'
            }}>
                {sidebarContent}
            </Sidedrawer>

            <ErrorModal />
            <InfoModal />
            <ConfirmModal />
            <ProgressModal />
            
            <div className="row" style={{height: '100%'}}>
                <div className="hidden-xs col-sm-5 col-md-4 col-lg-3"
                    style={{height: '100%', marginLeft: '-15px'}}>
                        {sidebarContent}
                    </div>
                    <div id="contentContainer" className={"col-xs-12 col-sm-7 col-md-8 col-lg-9 contentContainer "+pathInfo.containerClass}>

                        {this.props.children}

                        <div className="row">
                            <div className="col-xs-12 visible-xs" style={{
                                height: '104px' // clear NavFooter
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
                        />
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12 col-sm-offset-5 col-sm-7 col-md-offset-4 col-md-8 col-lg-offset-3 col-lg-9"
                    style={{position: 'fixed', bottom: 0}}>
                        {footer}
                </div>
            </div>
            </span>
        );
    }
};

function mapStateToProps(state) {
    return {
        error: state.get('error'),
        loaded: state.get('loaded'),
        user: state.get('user', Map()),
        apps: state.getIn(['user', 'apps'], List())
    };
}

export const App = withRouter(connect(mapStateToProps)(_App));
