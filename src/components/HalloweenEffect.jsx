import React from 'react';
import Snowfall from 'react-snowfall';
import gravestone from '../assets/tombstone.png';

const gravestoneImage = document.createElement('img');
gravestoneImage.src = gravestone;
gravestoneImage.width = 32;
gravestoneImage.height = 32;

const HalloweenEffect = () => {
  return (
    <Snowfall
      style={{
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
        zIndex: 25,
      }}
      snowflakeCount={50}
      images={[gravestoneImage]}
      radius={[10.0, 30.0]}
    />
  );
};

export default HalloweenEffect;
