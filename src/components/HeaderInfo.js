// src/components/HeaderInfo.js
import React from 'react';

function HeaderInfo({ commitInfo }) {
    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                {commitInfo.date ? (
                    // If we have a date, display it.
                    <span className="version-info">
                        <a href="https://github.com/GTAW-PHMC/forms/tree/gh-pages" target="_blank" rel="noopener noreferrer">
                            This website was last updated on {commitInfo.date} with version #{commitInfo.sha}
                        </a>
                        {/* Also, if there was an error on the latest fetch, show a subtle warning. */}
                        {commitInfo.error && <span style={{ color: '#ffc107', marginLeft: '10px' }}>(Update check failed)</span>}
                    </span>
                ) : (
                    // If there's no date, show the error or a loading message.
                    <span className="version-info" style={{ color: commitInfo.error ? '#ffc107' : 'inherit' }}>
                        {commitInfo.error || 'Loading version information...'}
                    </span>
                )}

                <span className="contact-info">
                    Need help? Contact Alyson Frost on <a
                        href="http://discord.gg/rrzJ4EeHfK"
                        className="discord-link"
                    >
                        Discord  <i className="fab fa-discord"></i>
                    </a>❄️❄️
                </span>
            </div>
        </div>
    );
}

export default HeaderInfo;
