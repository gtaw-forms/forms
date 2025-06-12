// src/components/AgencyGroupSelectorModal.js
import { Button, Form, Image } from 'react-bootstrap';
import phmcLogo from '../assets/phmc.png';
import saaLogo from '../assets/saaa.png';
// import recruitmentIcon from '../assets/your-recruitment-icon.png'; // Optional: if you have a new icon

const AgencyGroupSelectorModal = ({ show, onSelectGroup, onHideSelectorPreference, hidePreference }) => {
    if (!show) {
        return null;
    }

    // --- Check if the hostname is localhost or a LAN IP ---
    const isDevelopmentEnvironment =
        window.location.hostname === 'localhost' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') || // Common private IP range
        window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); // Common private IP range 172.16.0.0 – 172.31.255.255

    const overlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(31, 41, 55, 0.75)',
        overflowY: 'auto',
        height: '100%',
        width: '100%',
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const modalContentStyle = {
        position: 'relative',
        padding: '1.5rem',
        border: '1px solid #4b5563',
        width: 'auto',
        maxWidth: '40rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        borderRadius: '0.375rem',
        backgroundColor: '#111827',
        color: '#d1d5db',
        textAlign: 'center',
    };

    const titleStyle = {
        fontSize: '1.5rem',
        lineHeight: '1.5',
        fontWeight: 500,
        color: '#ffffff',
        marginTop: '0.75rem',
    };

    const textContainerStyle = {
        marginTop: '1rem',
        paddingLeft: '1.75rem',
        paddingRight: '1.75rem',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
    };

    const paragraphStyle = {
        fontSize: '1.125rem',
        color: '#9ca3af',
    };

    const baseButtonStyle = {
        padding: '1rem',
        fontSize: '1.125rem',
        borderRadius: '0.375rem',
        width: '100%',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '120px',
        backgroundColor: 'transparent',
        color: '#ffffff',
        border: '1px solid #ffffff',
    };

    const imageStyle = {
        maxHeight: '50px',
        marginBottom: '0.5rem',
        objectFit: 'contain',
    };

    const checkboxContainerStyle = {
        marginTop: '2rem',
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
    };

    const labelStyle = {
        fontSize: '1rem',
        color: '#6b7280',
        verticalAlign: 'middle',
    };


    return (
        <div style={overlayStyle}>
            <div style={modalContentStyle}>
                <div style={titleStyle}>Welcome!</div>
                <div style={textContainerStyle}>
                    <p style={paragraphStyle}>
                        Please select the set of forms you'd like to work with:
                    </p>
                </div>
                <div
                    className="d-block d-sm-flex justify-content-center"
                    style={{gap: '1.5rem', flexWrap: 'wrap'}}
                >
                    <Button
                        variant="outline-light"
                        style={{...baseButtonStyle}}
                        onClick={() => onSelectGroup('PHMC')}
                        className="agency-group-button-phmc flex-sm-fill"
                    >
                        <Image src={phmcLogo} alt="PHMC Logo" style={imageStyle} />
                        PHMC Forms
                    </Button>
                    <Button
                        variant="outline-light"
                        style={{...baseButtonStyle}}
                        onClick={() => onSelectGroup('SAAA')}
                        className="agency-group-button-saaa flex-sm-fill"
                    >
                        <Image src={saaLogo} alt="SAAA Logo" style={imageStyle} />
                        SAAA Forms
                    </Button>
                    {/* --- Conditionally render the PHMC Recruitment Button --- */}
                    {isDevelopmentEnvironment && (
                        <Button
                            variant="outline-light"
                            style={{...baseButtonStyle}}
                            onClick={() => onSelectGroup('PHMC Recruitment')}
                            className="agency-group-button-phmc-recruitment flex-sm-fill" // Optional: new class for specific styling
                        >
                            {/* Using PHMC logo as a placeholder. Replace src with your recruitment icon if you have one. */}
                            <Image src={phmcLogo} alt="PHMC Recruitment Logo" style={imageStyle} />
                            [DEV]PHMC Recruitment
                        </Button>
                    )}
                </div>
                <div style={checkboxContainerStyle}>
                    <Form.Check
                        type="checkbox"
                        id="hideAgencyGroupSelector"
                        label={
                            <span style={labelStyle}>
                                Remember my choice and don't show this again.
                            </span>
                        }
                        checked={hidePreference}
                        onChange={(e) => onHideSelectorPreference(e.target.checked)}
                    />
                </div>
            </div>
        </div>
    );
};

export default AgencyGroupSelectorModal;
