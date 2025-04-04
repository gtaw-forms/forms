import React, { useState, useEffect } from 'react';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';

const EasterEggImages = () => {
  const [showParticles, setShowParticles] = useState(true);

  const particlesInit = async (main) => {
    await loadFull(main);
  };

  const particlesLoaded = (container) => {
    console.log('Particles loaded!');
  };

  const particlesOptions = {
    fullScreen: { enable: true },
    particles: {
      number: {
        value: 80,
        density: { enable: true, value_area: 800 },
      },
      color: {
        value: ["#FFD700", "#FF69B4", "#FFA500", "#00FFFF", "#FF00FF"],
      },
      opacity: {
        value: 0.7,
        random: { enable: true, minimumValue: 0.3 },
        animation: { enable: true, speed: 1, minimumValue: 0.1 },
      },
      size: { value: 20, random: { enable: true, minimumValue: 10 } },
      move: {
        enable: true,
        gravity: { enable: true, maxSpeed: 5 },
        speed: 2,
        direction: "bottom",
        outModes: { bottom: "out" },
      },
    },
  };

  return (
    <div>
      <button onClick={() => setShowParticles(!showParticles)}>
        {showParticles ? "Hide Easter Eggs" : "Show Easter Eggs"}
      </button>
      {showParticles && (
        <Particles
          id="tsparticles"
          init={particlesInit}
          loaded={particlesLoaded}
          options={particlesOptions}
        />
      )}
    </div>
  );
};

export default EasterEggImages;
