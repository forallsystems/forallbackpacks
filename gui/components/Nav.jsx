import React from 'react';
import {Link} from 'react-router-dom';
import {dispatchCustomEvent} from './common.jsx';
import * as constants from '../constants';

const navLtGreenColor = '#07e787';
const navDkGreenColor = '#009688';
const navFooterBgColor = '#07e787';

export class NavHeader extends React.Component {
    render() {
        var pathInfo = constants.PATH_INFO(this.props.pathname);
        var toggle = null;
        var desktopBack = null;
        var menu = <div style={{height: '28px'}}>&nbsp;</div>;

        if(!pathInfo.editFooter) {
            toggle = (
                <a href="javascript:void(0)" className="text-success"
                    onClick={this.props.onSidebarToggle}
                    style={{color:navLtGreenColor}}>
                    <i className="fa fa-bars fa-2x"></i>
                </a>
            );
        }

        if(!pathInfo.name && !pathInfo.editFooter) {
            toggle = (
                <a href="javascript:void(0)" className="text-success"
                    onClick={this.props.onGoBack}
                    style={{color:navLtGreenColor}}>
                    <i className="fa fa-chevron-left fa-2x"></i>
                </a>
            );

            desktopBack = (
                <a href="javascript:void(0)" className="text-success btn btn-raised btn-primary"
                    onClick={this.props.onGoBack}
                    style={{float:"right",marginTop:0}}
                    >
                    <i className="fa fa-chevron-left"></i> Back
                </a>
            );
        }

        if(!pathInfo.hideMenu) {
            menu = (
                <div className="dropdown">
                    <a href="#" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false"
                        style={{color:navLtGreenColor}}>
                        <i className="fa fa-cog fa-2x"></i>
                    </a>
                    <ul className="dropdown-menu dropdown-menu-right">
                        {(this.props.pathname == '/my-account') ? (
                            <li style={{padding: '3px 20px'}}>My Account</li>
                        ) : (
                            <li><Link to='/my-account'>My Account</Link></li>
                        )}
                    </ul>
                </div>
            );
        }

       return (
            <div className="row" style={{backgroundColor:navDkGreenColor}}>
                <div className="col-xs-2 visible-xs text-left" style={{
                    backgroundColor:navDkGreenColor,
                    paddingTop:'9px',
                    paddingBottom:'8px',
                }}>
                    {toggle}
                 </div>
                <div className="col-xs-8 visible-xs text-center" style={{
                    color:'#fff',
                    backgroundColor:navDkGreenColor,
                    paddingTop:'4px',
                    paddingLeft:0,
                    paddingRight:0,
                    paddingBottom:'4px',
                    fontSize:'1.4em',
                    fontWeight:400,
                    lineHeight:'2em',
                    whiteSpace: 'nowrap'
                }}>
                    {pathInfo.title || '.'}
                </div>
                <div className="col-sm-12 hidden-xs text-left" style={{
                    color:navDkGreenColor,
                    backgroundColor:'#fff',
                    paddingTop:'20px',
                    paddingBottom:'13px',
                    paddingLeft:0,
                    fontSize:'2em',
                    fontWeight:400,
                    lineHeight:'1.2em'
                }}>
                    {desktopBack} {pathInfo.title || '.'}
                </div>
                <div className="col-xs-2 visible-xs text-right" style={{
                    backgroundColor:navDkGreenColor,
                    paddingTop: '9px',
                    paddingBottom:'8px',
                    fontWeight:400,
                }}>
                    {menu}
                </div>
            </div>
        );
    }
}

export class NavFooter extends React.Component {
    renderLink(name, iconCls, to, curPathname) {
        if(to == curPathname) {
            return (
                <li role="presentation" style={{textAlign: 'center'}}>
                    <div className="nav-footer-arrow"></div>
                    <a href="javascript:void(0)" style={{color: 'white'}}>
                        <i className={"fa fa-2x "+iconCls} aria-hidden="true"></i>
                        <br />
                        {name}
                    </a>
                </li>
            );
        } else {
            return (
                <li role="presentation" style={{textAlign: 'center'}}>
                    <Link to={to} style={{color: 'white'}}>
                        <i className={"fa fa-2x "+iconCls} aria-hidden="true"></i>
                        <br />
                        {name}
                    </Link>
                </li>
            );
        }
    }

    render() {
        var pathname = this.props.pathname;

        var referrer = sessionStorage.getItem('referrer');
        var referTo = null;
        var refApp = null;

        if(referrer) {
            refApp = this.props.apps.find(data => data.get('app_url').startsWith(referrer));
        }

        if(refApp) {
            referTo = (
                <li role="presentation" style={{textAlign: 'center'}}>
                    <a href={referrer} style={{color: 'white'}}>
                        <i className="fa fa-2x fa-reply-all" aria-hidden="true"></i>
                        <br />
                        Back
                    </a>
                </li>
            );
        } else if(this.props.apps.size) {
            referTo = (
                <li role="presentation" style={{textAlign: 'center'}} className="dropup">
                    <a href="javascript:void(0)"
                        data-toggle="dropdown"
                        role="button"
                        aria-haspopup="true"
                        aria-expanded="false"
                        style={{
                            color: 'white'
                        }}
                    >
                        <i className="fa fa-2x fa-th-large" aria-hidden="true"></i>
                        <br />
                        Apps
                    </a>
                     <ul className="dropdown-menu dropdown-menu-right">
                        {this.props.apps.map(function(data, i) {
                            return (
                                <li>
                                    <a href={data.get('app_url')}>{data.get('app_name')}</a>
                                </li>
                            );
                        }, this)}
                     </ul>
                </li>
            );
        }

        return (
            <div className="row">
                <ul className="nav nav-pills nav-justified visible-xs" style={{
                    backgroundColor:navFooterBgColor,
                    color:'#fff'
                }}>
                    {this.renderLink('Badges', 'fa-star', '/badges', pathname)}
                    {this.renderLink('Timeline', 'fa-calendar', '/timeline', pathname)}
                    {this.renderLink('ePortfolio', 'fa-book', '/eportfolio', pathname)}
                    {referTo}
                </ul>
            </div>
        );
    }
}

export class NavEditFooter extends React.Component {
    constructor(props) {
        super(props);

        this.dispatchSaveEvent = this.dispatchSaveEvent.bind(this);
    }

    dispatchSaveEvent() {
        dispatchCustomEvent('navEditSave', {});
    }

    render() {
        return (
            <div className="row">
                <ul className="nav nav-pills nav-justified visible-xs" style={{
                    backgroundColor:navFooterBgColor,
                    color:'#fff'
                }}>
                    <li role="presentation" style={{textAlign: 'center'}}>
                        <a href="javascript:void(0)" onClick={this.dispatchSaveEvent} style={{
                            color: 'white',
                            padding: '20px 0'
                        }}>
                            <i className="fa fa-check" aria-hidden="true"></i>
                            &nbsp;SAVE
                        </a>
                    </li>
                    <li role="presentation" style={{textAlign: 'center'}}>
                        <a href="javascript:void(0)" onClick={this.props.onCancel} style={{
                            color: 'white',
                            padding: '20px 0'
                        }}>
                            <i className="fa fa-times" aria-hidden="true"></i>
                            &nbsp;CANCEL
                        </a>
                    </li>
                </ul>
            </div>
        );
    }
}
