import React from 'react';
import phmcLogo from '../../assets/phmc.png';

const PatientMigrationModal = ({ show, onHide }) => {
    if (!show) return null;

    const handleDiscordClick = () => {
        window.open("https://discord.gg/fg7ssSMkj9", "_blank");
        onHide();
    };

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.95)', // Slightly darker
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 99999, // Extremely high z-index
                backdropFilter: 'blur(12px)', // Increased blur
                padding: '20px'
            }}
            onClick={onHide}
        >
            <div 
                style={{
                    backgroundColor: '#0d1117',
                    borderRadius: '20px',
                    border: '1px solid #30363d',
                    width: '100%',
                    maxWidth: '480px',
                    padding: '3rem',
                    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9)',
                    position: 'relative',
                    textAlign: 'center',
                    animation: 'migrationSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                    @keyframes migrationSlideUp {
                        from { opacity: 0; transform: translateY(30px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .migration-action-btn {
                        background-color: #5865F2;
                        color: white;
                        border: none;
                        padding: 16px;
                        font-weight: 800;
                        font-size: 1.1rem;
                        border-radius: 12px;
                        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        width: 100%;
                        box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
                    }
                    .migration-action-btn:hover {
                        background-color: #4752c4;
                        transform: translateY(-3px);
                        box-shadow: 0 8px 25px rgba(88, 101, 242, 0.5);
                    }
                    .migration-action-btn:active {
                        transform: translateY(-1px);
                    }
                    .migration-secondary-link {
                        background: none;
                        border: none;
                        color: #484f58;
                        font-size: 0.95rem;
                        margin-top: 15px;
                        cursor: pointer;
                        transition: color 0.2s;
                        font-weight: 500;
                    }
                    .migration-secondary-link:hover {
                        color: #8b949e;
                        text-decoration: underline;
                    }
                `}</style>

                <div className="mb-4">
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '120px',
                            height: '120px',
                            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.15) 0%, transparent 70%)',
                            zIndex: -1
                        }}></div>
                        <img 
                            src={phmcLogo} 
                            alt="PHMC Logo" 
                            style={{ 
                                height: '90px', 
                                marginBottom: '15px'
                            }} 
                        />
                    </div>
                    <h2 style={{ color: '#fff', fontWeight: '800', fontSize: '1.75rem', marginBottom: '8px' }}>
                        Patient Files Migration
                    </h2>
                    <div style={{ 
                        color: '#60a5fa', 
                        fontSize: '0.75rem', 
                        textTransform: 'uppercase', 
                        fontWeight: '900', 
                        letterSpacing: '2px',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px'
                    }}>
                        Important Alert
                    </div>
                </div>

                <div style={{ color: '#8b949e', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
                    <p>Patient Files have officially transitioned to our new Discord Bot.</p>
                    <p style={{ fontSize: '0.95rem', color: '#8b949e' }}>
                        Legacy Forms will be enabled should Cloudflare or Discord suffer a major outage.
                    </p>
                    
                    <div 
                        style={{ 
                            backgroundColor: '#161b22', 
                            border: '1px solid #30363d', 
                            borderRadius: '12px',
                            padding: '15px',
                            marginTop: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center' }}>
<svg xmlns="http://www.w3.org/2000/svg" width="50" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
</svg>                        </span>
                        <code style={{ color: '#e6edf3', fontSize: '1rem', background: 'none', padding: 0 }}>patient-appointments channel</code>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button 
                        onClick={handleDiscordClick}
                        className="migration-action-btn"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '2px' }}>
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8642-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.077 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0741 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                        </svg>
                        Open PHMC Discord
                    </button>
                    <button 
                        onClick={onHide} 
                        className="migration-secondary-link"
                    >
                        Continue to legacy forms
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PatientMigrationModal;