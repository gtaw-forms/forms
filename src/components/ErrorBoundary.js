import React, { Component } from 'react';

const notificationStyle = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px',
    backgroundColor: '#f85149', // A strong error color
    color: 'white',
    borderRadius: '5px',
    zIndex: 9999, // Ensure it's on top of everything
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
};

const iconStyle = {
    fontSize: '1.5em'
};

const buttonStyle = {
    backgroundColor: 'transparent',
    color: 'white',
    border: '1px solid white',
    borderRadius: '3px',
    padding: '5px 10px',
    cursor: 'pointer',
    fontWeight: 'bold'
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleOkClick = () => {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <div style={notificationStyle}>
            <div style={iconStyle}>
                <i className="fas fa-exclamation-triangle"></i>
            </div>
            <span>FATAL ERROR! Please ping Alyson in the PHMC Discord or post a Bug Report!</span>
            <button onClick={this.handleOkClick} style={buttonStyle}>OK</button>
          </div>
          {/* We still render the children to keep the UI visible */}
          {this.props.children}
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
