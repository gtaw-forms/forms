// src/components/HeaderInfo.js
import React from 'react';

function HeaderInfo({ commitInfo }) {
    return (
        <div className="header-info-wrapper">
                <span className="contact-info">
                    Need help? Contact Alyson Frost on <a
                        href="http://discord.gg/rrzJ4EeHfK"
                        className="discord-link"
                    >
                        Discord  <i className="fab fa-discord"></i>
                    </a>❄️❄️
                </span>
        </div>
    );
}

export default HeaderInfo;
