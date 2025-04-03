
// New Imports for Events
import christmas from '../assets/christmas.png';
import easter from '../assets/easteregg.png';
import phmcEaster from '../assets/easter.png';
import Default from '../assets/Generic.png';

const seasonalImages = {
    deathReport: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Default: Default, // Added Default
    },
    civilianPaperwork: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Default: Default, // Added Default
    },
};

function getSeason() {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    // April Fools (April 2th)
    if (month === 3 && day >= 1 && day <= 2) {
        return "AprilFools";
    }
    // Easter (April 5 to April 30)
    if (month === 3 && day >= 3 && day <= 30) {
        return "Easter";
    }
    // Christmas (December 1 to January 1)
    if (month === 11 && day >= 1 || month === 0 && day <= 1) {
        return "Christmas";
    }

    return "Default"; // Return Default if no event is active
}

function seasonalEvents({ imageType }) {
    const season = getSeason();
    const imageSource = seasonalImages[imageType][season];

    let className = '';
    //console.log(imageSource, className, season); // Debugging line to check values

    if (season === "AprilFools") {
        className = 'april-fools';
    } else if (season === "Easter") {
        className = 'easter-bounce';
    }

    return { imageSource, className, season };
}
export default seasonalEvents;