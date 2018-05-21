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

        if(!pathInfo.editFooter) {
            if(pathInfo.name) {
                toggle = (
                    <a href="javascript:void(0)" className="text-success"
                        onClick={this.props.onSidebarToggle}
                        style={{color:navLtGreenColor}}>
                        <i className="fa fa-bars fa-2x"></i>
                    </a>
                );
            } else {
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
                <div className="col-xs-2 visible-xs text-right" style={{
                    backgroundColor:navDkGreenColor,
                    paddingTop:'9px',
                    paddingBottom:'8px',
                }}>
                {(this.props.onRefresh) ? (
                    <a href="javascript:void(0)" className="text-success"
                        onClick={this.props.onRefresh}
                        style={{color:navLtGreenColor}}>
                        <i className="fa fa-repeat fa-2x"></i>
                    </a>
                ) : null}
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
        
        return (
            <div className="row">
                <ul className="nav nav-pills nav-justified visible-xs" style={{
                    backgroundColor:navFooterBgColor,
                    color:'#fff'
                }}>
                    {this.renderLink('Badges', 'fa-star', '/badges', pathname)}
                    {this.renderLink('Timeline', 'fa-calendar', '/timeline', pathname)}
                    {this.renderLink('ePortfolio', 'fa-book', '/eportfolio', pathname)}
                    <li role="presentation" style={{textAlign: 'center'}}>
                        <a href="javascript:void(0)" style={{color: 'white'}} onClick={this.props.onClickOffline}>
                            <i className={"fa fa-2x fa-toggle-"+((this.props.isOffline) ? "on" : "off")} aria-hidden="true"></i>
                            <br />
                            Offline
                        </a>
                    </li>
                </ul>
            </div>
        );
    }
}

export class NavEditFooter extends React.Component {
    constructor(props) {
        super(props);

        this.onSave = (e) => {
            dispatchCustomEvent('navEditSave', {});
        }
    }

    render() {
        return (
            <div className="row">
                <ul className="nav nav-pills nav-justified visible-xs" style={{
                    backgroundColor:navFooterBgColor,
                    color:'#fff'
                }}>
                    <li role="presentation" style={{textAlign: 'center'}}>
                        <a href="javascript:void(0)" onClick={this.onSave} style={{
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
