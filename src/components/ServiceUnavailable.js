import React from 'react';
import './ServiceUnavailable.css';

const ServiceUnavailable = () => {
  return (
    <div className="service-unavailable-overlay">
      <div className="service-unavailable-content">
                <h1>Service Unavailable</h1>
        <h2>As per the request of GTAW Management, this site is currently unavailable. I'm sorry for any inconvience caused.</h2>
      <h2> : - ( </h2>
      </div>
    </div>
  );
};

export default ServiceUnavailable;
