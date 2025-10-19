import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const UnifiedGtaCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const location = useLocation();
  const { processCallback } = useGtaWorldAuth();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.split('?')[1] || '');
    const code = searchParams.get('code') || hashParams.get('code');
    const state = searchParams.get('state') || hashParams.get('state');
    const errorParam = searchParams.get('error') || hashParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setError(errorDescription || errorParam);
      return;
    }
    if (!code) {
      setStatus('error');
      setError('No authorization code received');
      return;
    }

    (async () => {
      try {
        await processCallback(code, state);
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/forms/';
        }, 800);
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Authentication failed');
      }
    })();
  }, [location.search, location.hash, processCallback]);

  if (status === 'processing') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Processing...</span>
          </div>
          <h4 className="mt-3">GTA World Authentication</h4>
          <p className="text-muted">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="text-success mb-3">
            <i className="fas fa-check-circle" style={{ fontSize: '4rem' }}></i>
          </div>
          <h4 className="text-success">Authentication Successful!</h4>
          <p className="text-muted">Redirecting to homepage...</p>
          <div className="spinner-border spinner-border-sm text-primary mt-2">
            <span className="visually-hidden">Redirecting...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="alert alert-danger" role="alert" style={{ maxWidth: '500px' }}>
            <h4 className="alert-heading">
              <i className="fas fa-exclamation-triangle me-2"></i>
              Authentication Error
            </h4>
            <p className="mb-3">{error}</p>
            <hr />
            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-primary" onClick={() => window.location.href = '/forms/'}>
                <i className="fas fa-home me-2"></i>
                Return to Homepage
              </button>
              <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
                <i className="fas fa-redo me-2"></i>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UnifiedGtaCallback;