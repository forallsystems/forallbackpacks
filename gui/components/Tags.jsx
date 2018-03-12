import React from 'react';
import ReactDOM from 'react-dom';

const attrColor = '#009688';
const tagColor = '#a99f01';

function Attr(props) {
    return  (
        <div style={{
            display: 'inline-block',
            color: attrColor,
            marginRight: '10px',
            padding: '6px 4px 0px 0',
        }}>
            <i className="fa fa-tag"></i> {props.text}
        </div>
    );
}

class Tag extends React.Component {
    constructor(props) {
        super(props);

        this.remove = () => {
            this.props.removeHandler(this.props.text);
        }
    }

    renderNormalComponent() {
        return  (
            <div style={{
                display: 'inline-block',
                color: tagColor,
                marginRight: '10px',
                padding: '6px 4px 0px 0',
            }}>
                <i className="fa fa-tag"></i> {this.props.text}
            </div>
        );
    }

    renderEditingComponent() {
        return  (
            <div onClick={this.remove} title='Remove Tag' style={{
                display: 'inline-block',
                color: tagColor,
                marginRight: '10px',
                padding: '6px 4px 6px 0',
                cursor: 'pointer',
            }}>
                <i className="fa fa-times"></i> {this.props.text}
            </div>
        );
    }

    render() {
        if(this.props.editing) {
            return this.renderEditingComponent();
        } else {
            return this.renderNormalComponent();
        }
    }
}

// value should be a Set()
export class Tags extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            editing: false
        };

        this.startEditing = () => {
            this.setState({editing: true});
        }

        this.cancelEditing = () => {
            this.setState({editing: false});
        }

        this.commit = (value) => {
            this.props.onChange(value);
        }

        this.removeTag = (tag) => {
            this.commit(this.props.value.delete(tag));
            this.textInput.focus();
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
                if(!this.props.value.has(text)) {
                    this.commit(this.props.value.add(text));
                }
                this.textInput.value = "";
            }
        }

        this.onInputCancel = (e) => {
            this.cancelEditing();
        }

        this.handleEvent = (e) => {
            switch(e.type) {
                case 'mousedown':
                    if(this.state.editing) {
                        if(!this.tagsContainer.contains(e.target)) {
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
            <span className='tagArea' onClick={this.startEditing} style={{cursor: 'pointer'}}>
                {(this.props.attrs) ?
                    this.props.attrs.map(function(text, i) {
                        return (
                            <Attr key={i} text={text} />
                        );
                    }, this)
                : null}
                {this.props.value.map(function(text) {
                    return (
                        <Tag key={text} text={text} editing={false}  />
                    );
                }, this)}
                <div onClick={this.startEditing} style={{
                    display: 'inline-block',
                    color: tagColor,
                    marginRight: '10px',
                    cursor: 'pointer',
                    padding: '6px 4px 6px 0'
                }}>
                    <i className="fa fa-plus-circle" aria-hidden="true"></i> Add Tag
                </div>
            </span>
        );
    }

    renderEditingComponent() {
        return (
            <span className='tagArea' ref={(el) => { this.tagsContainer = el; }}>
                {(this.props.attrs) ?
                    this.props.attrs.map(function(text, i) {
                        return (
                            <Attr key={i} text={text} />
                        );
                    }, this)
                : null}
                {this.props.value.map(function(text, i) {
                    return (
                        <Tag key={i} text={text} editing={true} removeHandler={this.removeTag} />
                    );
                }, this)}
                <div style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                    <input type="text" ref={(el) => {this.textInput = el;}}
                        onKeyDown={this.onInputKeyDown}
                        style={{width: '140px'}}
                        placeholder="Add Tag"
                    />
                    <i className="fa fa-check-square fa-lg addTagSave"
                        onClick={this.onInputSave}
                        style={{marginLeft:'8px'}}
                    />
                    <i className="fa fa-window-close fa-lg addTagCancel"
                        onClick={this.onInputCancel}
                        style={{marginLeft:'8px'}}
                    />
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
