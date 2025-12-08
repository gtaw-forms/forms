import React from 'react';
// New Imports for Events
import christmas from '../assets/phmcchristmaslogo.png';
import easter from '../assets/easteregg.png';
import phmcEaster from '../assets/easter.png';
import halloween from '../assets/halloween-rip.png';
import Default from '../assets/Generic.png';
import phmcLogoPng from '../assets/phmc.png';
import HalloweenEffect from './HalloweenEffect';
import Snowfall from 'react-snowfall';

const seasonalImages = {
    deathReport: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Halloween: halloween,
        Default: Default, // Added Default
    },
    civilianPaperwork: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Halloween: halloween,
        Default: Default, // Added Default
    },
    phmcLogo: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Halloween: halloween,
        Default: phmcLogoPng,
    },
};

function getSeason() {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    // Halloween (October 1st to 31st)
    if (month === 9) {
        return "Halloween";
    }
    // April Fools (April 2th)
    if (month === 3 && day >= 1 && day <= 2) {
        return "AprilFools";
    }
    // Easter (April 5 to April 30)
    if (month === 3 && day >= 3 && day <= 30) {
        return "Easter";
    }
    // Christmas (December 1 to January 1)
    if ((month === 11 && day >= 1) || (month === 0 && day <= 1)) {
        return "Christmas";
    }

    return "Default"; // Return Default if no event is active
}

function seasonalEvents({ imageType, season: seasonOverride }) {
    const season = seasonOverride || getSeason();
    const imageSource = seasonalImages[imageType]?.[season] || seasonalImages[imageType]?.Default;


    let className = '';
    let effect = null;
    //console.log(imageSource, className, season); // Debugging line to check values

    if (season === "AprilFools") {
        className = 'april-fools';
    } else if (season === "Easter") {
        className = 'easter-bounce';
    } else if (season === "Halloween") {
        effect = <HalloweenEffect />;
    } else if (season === "Christmas") {
        effect = <Snowfall snowflakeCount={75} />;
    }

    return { imageSource, className, season, effect };
}
export default seasonalEvents;