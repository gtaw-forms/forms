import React from 'react';
import './ServiceUnavailable.css';

const ServiceUnavailable = () => {
  return (
    <div className="service-unavailable-bg">
      <div className="service-unavailable-card">
        <h1>Service Unavailable</h1>
        <h2>
          As per the request of GTAW Management, this site is currently unavailable.<br />
          We're in the slow progress of migrating to official GTAW servers.
        </h2>
        <div className="service-unavailable-emoji" role="img" aria-label="Sad face">😞</div>
        <div className="service-unavailable-footer">
          &copy; {new Date().getFullYear()} PHMC Forms &mdash; Thank you for your patience.
        </div>
      </div>
    </div>
  );
};

export default ServiceUnavailable;
