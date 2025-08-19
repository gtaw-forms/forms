// src/components/FormImageLink.js
import React from 'react';

const FormImageLink = ({
    bbCodeVersion,
    selectedAgencyGroup,
    deathReportClass,
    civilianPaperworkClass,
    deathReportImage,
    civilianPaperworkImage,
    saaaLogo // Assuming you pass this prop for SAAA images
}) => {
    let linkHref = '';
    let imgSrc = '';
    let imgAlt = '';
    let linkClass = '';
    let linkTitle = '';
    let shouldRender = false;

    // Common image properties
    const commonImgProps = {
        height: 350,
        width: 350,
        className: "Center"
    };

    switch (bbCodeVersion) {
        case 1:
            linkHref = "https://phmc.gta.world/posting.php?mode=post&f=267";
            imgSrc = deathReportImage;
            imgAlt = "Death Reports Link";
            linkClass = deathReportClass;
            linkTitle = "Easter Bunny goes bounce bounce";
            shouldRender = true;
            break;
        case 4:
            linkHref = "https://phmc.gta.world/posting.php?mode=post&f=266";
            imgSrc = deathReportImage;
            imgAlt = "Death Reports Link";
            linkClass = deathReportClass;
            linkTitle = "Easter Bunny goes bounce bounce";
            shouldRender = true;
            break;
                    case 8:
            linkHref = "https://phmc.gta.world/viewforum.php?f=266";
            imgSrc = deathReportImage;
            imgAlt = "Death Reports Link";
            linkClass = deathReportClass;
            shouldRender = true;
            break;
        case 11:
            linkHref = "https://phmc.gta.world/posting.php?mode=post&f=267";
            imgSrc = deathReportImage;
            imgAlt = "Death Reports Link";
            linkClass = deathReportClass;
            linkTitle = "Easter Bunny goes bounce bounce";
            shouldRender = true;
            break;

        case 24:
            linkHref = "https://phmc.gta.world/posting.php?mode=post&f=109";
            imgSrc = civilianPaperworkImage;
            imgAlt = "Request Medical Records";
            linkClass = civilianPaperworkClass;
            linkTitle = "Easter Bunny goes bounce bounce";
            shouldRender = true;
            break;
        case 3:
        case 25: // This handles both bbCodeVersion 3 and 25
            linkHref = "https://phmc.gta.world/posting.php?mode=post&f=221";
            imgSrc = civilianPaperworkImage;
            imgAlt = "Basic Patient File";
            linkClass = civilianPaperworkClass;
            linkTitle = "Easter Bunny goes bounce bounce";
            shouldRender = true;
            break;
        case 26: // This handles both bbCodeVersion 3 and 25
            linkHref = "https://phmc.gta.world/posting.php?mode=post&f=221";
            imgSrc = civilianPaperworkImage;
            imgAlt = "Update Medical Records";
            linkClass = civilianPaperworkClass;
            linkTitle = "Easter Bunny goes bounce bounce";
            shouldRender = true;
            break;
        case 35:
            linkHref = "https://phmc.gta.world/ucp.php?i=pm&mode=compose";
            imgSrc = civilianPaperworkImage;
            imgAlt = "Patient Sicknote Request";
            shouldRender = true;
            break;
        default:
            // Handle the complex PHMC condition that's not a simple bbCodeVersion match
            if (selectedAgencyGroup === 'PHMC' && ![1, 2, 3, 4, 24, 25, 26].includes(bbCodeVersion)) {
                linkHref = "https://phmc.gta.world/viewforum.php?f=97";
                imgSrc = civilianPaperworkImage;
                imgAlt = "Staff Area - Medical Records";
                linkClass = civilianPaperworkClass;
                linkTitle = "Easter Bunny goes bounce bounce";
                shouldRender = true;
            }
            break;
    }

    if (!shouldRender) {
        return null;
    }

    return (
        <div className="image-container">
            <a href={linkHref} target="_blank" rel="noopener noreferrer" className={linkClass} title={linkTitle}>
                <img
                    src={imgSrc}
                    alt={imgAlt}
                    {...commonImgProps}
                />
            </a>
        </div>
    );
};

export default FormImageLink;
