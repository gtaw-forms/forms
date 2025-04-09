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
                        <script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js" data-name="bmc-button" data-slug="frostyjs" data-color="#FFDD00" data-emoji=""  data-font="Bree" data-text="Buy me a drink!" data-outline-color="#000000" data-font-color="#000000" data-coffee-color="#ffffff" ></script>

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