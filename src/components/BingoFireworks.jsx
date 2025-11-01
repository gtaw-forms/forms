import React, { useCallback, useEffect } from 'react';
import { Particles } from '@tsparticles/react';
import { loadAll } from '@tsparticles/all';

const BingoFireworks = () => {
    useEffect(() => {
        console.log('[BINGO] Fireworks component mounted. Let the show begin! 🎆');
        return () => {
            console.log('[BINGO] Fireworks component unmounted. Cleaning up.');
        };
    }, []);

    const particlesInit = useCallback(async (engine) => {
        await loadAll(engine);
    }, []);

    const particlesLoaded = useCallback(async (container) => {
        // console.log("Particles container loaded", container);
    }, []);

    const options = {
        fullScreen: {
            enable: false // <--- CHANGE THIS TO FALSE
            // zIndex will now be controlled by the parent container
        },
        particles: {
            number: {
                value: 0
            },
            color: {
                value: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"]
            },
            shape: {
                type: "circle"
            },
            opacity: {
                value: 1,
                animation: {
                    enable: true,
                    minimumValue: 0.1,
                    speed: 1,
                    startValue: "max",
                    destroy: "min"
                }
            },
            size: {
                value: 4,
                random: {
                    enable: true,
                    minimumValue: 2
                },
                animation: {
                    enable: true,
                    speed: 2,
                    minimumValue: 0.5,
                    sync: true,
                    startValue: "max",
                    destroy: "min"
                }
            },
            life: {
                count: 1,
                duration: {
                    value: {
                        min: 1,
                        max: 2
                    }
                }
            },
            move: {
                enable: true,
                gravity: {
                    enable: true,
                    acceleration: 9.81
                },
                speed: {
                    min: 10,
                    max: 20
                },
                decay: 0.1,
                direction: "none",
                random: true,
                straight: false,
                outModes: {
                    default: "destroy"
                }
            }
        },
        interactivity: {
            detectsOn: "window",
            events: {
                resize: true
            }
        },
        emitters: [
            {
                position: { x: 20, y: 100 },
                rate: { quantity: 1, delay: 0.8 },
                life: { duration: 0.1, count: 1 },
                particles: {
                    move: { direction: "top-right", speed: 15, decay: 0.1 },
                    color: { value: ["#FF0000", "#FFFF00", "#00FF00"] },
                    size: { value: 5, random: true, minimumValue: 2 }
                }
            },
            {
                position: { x: 80, y: 100 },
                rate: { quantity: 1, delay: 0.8 },
                life: { duration: 0.1, count: 1 },
                particles: {
                    move: { direction: "top-left", speed: 15, decay: 0.1 },
                    color: { value: ["#00FFFF", "#FF00FF", "#0000FF"] },
                    size: { value: 5, random: true, minimumValue: 2 }
                }
            },
            {
                position: { x: 50, y: 100 },
                rate: { quantity: 1, delay: 0.8 },
                life: { duration: 0.1, count: 1 },
                particles: {
                    move: { direction: "top", speed: 15, decay: 0.1 },
                    color: { value: ["#FFFFFF", "#FFA500"] },
                    size: { value: 5, random: true, minimumValue: 2 }
                }
            }
        ]
    };

    return (
        <Particles
            id="tsparticles-bingo"
            init={particlesInit}
            loaded={particlesLoaded}
            options={options}
        />
    );
};

export default BingoFireworks;
