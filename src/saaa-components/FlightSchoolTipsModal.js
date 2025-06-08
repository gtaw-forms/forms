// src/saaa-components/FlightSchoolTipsModal.js
import React from 'react';
import { Modal, Button } from 'react-bootstrap';

// --- Copied Styles from CoronerTipsModal ---
const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '25px',
    borderRadius: '8px', width: '85%', maxWidth: '700px', // You can adjust maxWidth if needed for this content
    maxHeight: '85vh', overflowY: 'auto', position: 'relative',
    border: '1px solid #30363d', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
};
const modalHeaderStyle = {
    fontSize: '1.4em', fontWeight: 'bold', marginBottom: '15px',
    textAlign: 'center', borderBottom: '1px solid #30363d', paddingBottom: '15px',
    color: '#c9d1d9', // Added to ensure text color is consistent
    display: 'flex', // Added for close button alignment
    justifyContent: 'space-between', // Added for close button alignment
    alignItems: 'center', // Added for close button alignment
};
const modalBodyStyle = { // Style for the body content area
    paddingTop: '10px', // Add some space above the body content
    color: '#c9d1d9', // Ensure text color
    whiteSpace: 'pre-line', // Keep your existing whiteSpace for formatting
    // minHeight: '300px', // Consider if you need a min-height or let content define it
};
const modalFooterStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #30363d',
    gap: '8px',
};
const closeButtonStyle = { // For the 'X' button in the header
    background: 'none', border: 'none', color: '#f85149', // Or #c9d1d9 for less prominent
    fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
// --- End Copied Styles ---

const FlightSchoolTipsModal = ({ show, onHide }) => {
    if (!show) {
        return null;
    }

    return (
        <div style={modalStyle} onClick={onHide}> {/* Apply overlay style */}
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}> {/* Apply modal content style */}
                <div style={modalHeaderStyle}> {/* Apply modal header style */}
                    <span style={{ flexGrow: 1, textAlign: 'center' }}> {/* Added span to help center title with close button */}
                        Flight Schools & Aviation Academies - Licensing Information
                    </span>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>
                <Modal.Body style={modalBodyStyle}> {/* Apply modal body style */}
                    {/* Your existing Modal.Body content */}
                    <h5>DEFINITIONS</h5>
                    <p>
                        <strong>Flight school:</strong> an organization or an entity which provides training for a Pilot License
                        <br />
                        <strong>Certified Flight Instructor:</strong> a person who hold a valid Certified Flight Instructor license issued by the San Andreas Aviation Authority
                        <br />
                        <strong>Chief Pilot:</strong> a person responsible for overseeing the training material, handling special incidents and setting up the requirements for a practical exam in a Flight School
                    </p>

                    <hr style={{ borderColor: '#6c757d' }} />

                    <h5><strong>REGULATIONS</strong></h5>
                    <p>
                        (a) Operating a Flight School within the State of San Andreas is prohibited, unless:
                        <ul>
                            <li>The Flight School holds a valid license by the San Andreas Aviation Authority.</li>
                            <li>The Flight School has a training plan that is approved by the San Andreas Aviation Authority.</li>
                            <li>The Flight School has an appointed Chief Pilot with 1,000 or plus flight hours, who'll be responsible for overseeing the training material, handling special incidents and setting up the requirements for a practical exam.</li>
                            <li>The Flight School employs at least one appointed examiner which is responsible for performing Practical Exams for a Pilot License.</li>
                            <li>The Flight School employs at least one Certified Flight Instructor licensed by the San Andreas Aviation Authority.</li>
                        </ul>
                        ((In the case of denial, any applicants may re-apply no sooner than 3 months after the date of denial. Additionally, the applicant may request an appeal.))
                    </p>
                </Modal.Body>
                <div style={modalFooterStyle}> {/* Apply modal footer style */}
                    <Button variant="secondary" onClick={onHide}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FlightSchoolTipsModal;
