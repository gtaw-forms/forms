import React from 'react';

function HeaderInfo({ commitInfo }) {
    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                {commitInfo.date && (
                    <>
                        <span className="version-info">
                            <a href="https://github.com/GTAW-PHMC/forms/tree/gh-pages" target="_blank" rel="noopener noreferrer">
                                This website was last updated on {commitInfo.date} with version #{commitInfo.sha}</a>

                        </span>
                        This project is not sponsored or hosted by GTA World. This is hosted on Github Pages. Privacy Policy: I only track errors and debug logs. No personal data is collected or stored.
                        <span className="contact-info">
                            Need help? Contact Alyson Frost on <a
                                href="http://discord.gg/rrzJ4EeHfK"
                                className="discord-link"
                            >
                                Discord  <i className="fab fa-discord"></i>
                            </a>❄️❄️
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

export default HeaderInfo;