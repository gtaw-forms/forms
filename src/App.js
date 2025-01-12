import '@fortawesome/fontawesome-free/css/all.min.css';
import React, { useState, useEffect } from 'react';
import './App.css';
import Paperwork from './myPaperwork2.png';
import Feedback from './feedback.png';
import Notification from './components/Notification';
import LSPDLogo from './assets/lspd.png';
import LSSDLogo from './assets/lssd.png';
import LSFDLogo from './assets/lsfd.png';
import PHMCLogo from './assets/phmc.png';
import { Form, Button, InputGroup } from 'react-bootstrap';

function App() {
    const [formData, setFormData] = useState({
        coronerRank: 'Forensic Attendant',
        placeOfDeath: '',
        department: '',
        dateTime: '',
        coronerName: '',
        serialNumber: '',
        decedentName: '',
        pronouncedTimeOfDeath: '',
        synopsis: '',
        probableCauseOfDeath: '',
        mannerOfDeath: '',
        typeOfDeath: 'PK',
        decedentOOC: '',
        scenePhotos: '',
        additionalImages: '',
        requestingOfficer: '',
        coronerDiscord: '',
        coronerPHNumber: '50056',
        deathReport: '',
        additionalReports: '',
        showAdditionalReports: false,
        internalReport: '',
        internalAdditionalReports: '',
        showInternalAdditionalReports: false,
        policeNotification: '',
        partiesInvolved: [''],
        // test
        treatmentLocation: '',
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [bbCodeVersion, setBbCodeVersion] = useState(1);
    const [notification, setNotification] = useState(null);
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null });

    useEffect(() => {
        fetch('https://api.github.com/repos/LPX-Dev/phmc-death-report/commits/gh-pages')
            .then(response => response.json())
            .then(data => {
                setCommitInfo({
                    sha: data.sha.substring(0, 7),
                    date: new Date(data.commit.author.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                });
            })
            .catch(error => console.error('Error fetching commit:', error));
    }, []);

    const handleImageUpload = async (event, fieldName) => {
        const files = event.target.files;
        if (!files.length) return;

        setIsUploading(true);
        const uploadedUrls = [];

        try {
            for (let file of files) {
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.REACT_APP_IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();
                if (data.success) {
                    uploadedUrls.push(data.data.url);
                }
            }

            if (uploadedUrls.length > 0) {
                const currentValue = formData[fieldName];
                const newValue = currentValue
                    ? `${currentValue}, ${uploadedUrls.join(', ')}`
                    : uploadedUrls.join(', ');

                setFormData(prev => ({
                    ...prev,
                    [fieldName]: newValue
                }));
                showNotification(`${uploadedUrls.length} image(s) uploaded successfully!`, 'check-circle');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            showNotification('Upload failed!', 'exclamation-circle');
        } finally {
            setIsUploading(false);
        }
    };

    const [showChangelog, setShowChangelog] = useState(false);

    const [coronerList] = useState([
        { name: 'Anne Carter', badge: '4892', jobTitle: 'Chief Medical Examiner' },
        { name: 'Yari Woods', badge: '113472', jobTitle: 'Deputy Chief Medical Examiner' },
        { name: 'Matthias Morse', badge: '169662', jobTitle: 'Medical Examiner' },
        { name: 'Rebecca Rose', badge: '170228', jobTitle: 'Medical Examiner' },
        { name: 'Chloe Howard', badge: '54372', jobTitle: 'Medical Examiner' },
        { name: 'Elena Hill', badge: '108273', jobTitle: 'Coroner Investigator' },
        { name: 'Wesley Kramer', badge: '16511', jobTitle: 'Coroner Investigator' },
        { name: 'Laurent Hall', badge: '91338854', jobTitle: 'Supervisor Forensic Attendant' },
        { name: 'Roger McFarlane', badge: '1552', jobTitle: 'Senior Forensic Attendant' },
        { name: 'Pubert Kennedy', badge: '171763', jobTitle: 'Forensic Attendant' },
        { name: 'Alyson Frost', badge: '5573', jobTitle: 'Senior Forensic Attendant' },
        { name: 'Justin Moran', badge: '165127', jobTitle: 'Forensic Attendant' },
        { name: 'Patrick Boyd', badge: '171368', jobTitle: 'Forensic Attendant' },
    ]);

    // Add utility function
    const containsNumbers = (str) => /\d/.test(str);

    // Update handleChange function
    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const updates = { [name]: value };

            // Handle badge number and job title auto-fill for coroner selection
            if (name === 'coronerName') {
                const selectedCoroner = coronerList.find(c => c.name === value);
                if (selectedCoroner) {
                    updates.serialNumber = selectedCoroner.badge;
                    updates.coronerRank = selectedCoroner.jobTitle;
                }
            }

            // Handle badge number formatting for requesting officer
            if (name === 'requestingOfficer' && containsNumbers(value)) {
                if (!value.startsWith('BN#')) {
                    updates[name] = `BN#${value}`;
                }
            }

            // Allow manual override of badge number
            if (name === 'serialNumber') {
                updates.serialNumber = value;
            }

            return { ...prev, ...updates };
        });
    };

    const handleDoeChange = (type) => (e) => {
        if (type === 'john') {
            setIsJohnDoe(e.target.checked);
            setIsJaneDoe(false);
            if (e.target.checked) {
                setFormData(prev => ({ ...prev, decedentName: 'John Doe' }));
            } else if (formData.decedentName === 'John Doe') {
                setFormData(prev => ({ ...prev, decedentName: '' }));
            }
        } else {
            setIsJaneDoe(e.target.checked);
            setIsJohnDoe(false);
            if (e.target.checked) {
                setFormData(prev => ({ ...prev, decedentName: 'Jane Doe' }));
            } else if (formData.decedentName === 'Jane Doe') {
                setFormData(prev => ({ ...prev, decedentName: '' }));
            }
        }
    };


    const departmentFullName = (abbreviation) => {
        switch (abbreviation) {
            case 'LSPD':
                return 'Los Santos Police Department';
            case 'LSFD':
                return 'Los Santos Fire Department';
            case 'LSSD':
                return 'Los Santos Sheriff Department';
            case 'PHMC':
                return 'Pillbox Hill Medical Center';
            case 'SANFIRE':
                return 'San Andreas Department of Forestry and Fire Protection';
            case 'SADCR':
                return 'San Andreas Department of Corrections and Rehabilitation';
            case 'LSGOV':
                return 'Los Santos City Government';
            case '911 Call':
                return 'Emergency 911 Dispatch Center';
            default:
                return '';
        }
    };
    function getBrowserName(userAgent) {
        if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
            return "Google Chrome";
        } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
            return "Safari";
        } else if (userAgent.includes("Firefox")) {
            return "Mozilla Firefox";
        } else if (userAgent.includes("Edg")) {
            return "Microsoft Edge";
        } else if (userAgent.includes("MSIE") || userAgent.includes("Trident")) {
            return "Internet Explorer";
        } else {
            return "Unknown Browser";
        }
    }
    function getBrowserName(userAgent) {
        if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
            return "Google Chrome";
        } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
            return "Safari";
        } else if (userAgent.includes("Firefox")) {
            return "Mozilla Firefox";
        } else if (userAgent.includes("Edg")) {
            return "Microsoft Edge";
        } else if (userAgent.includes("MSIE") || userAgent.includes("Trident")) {
            return "Internet Explorer";
        } else {
            return "Unknown Browser";
        }
    }

    const generateBBCode = () => {
        const {
            coronerRank,
            placeOfDeath,
            department,
            dateTime,
            coronerName,
            serialNumber,
            decedentName,
            pronouncedTimeOfDeath,
            synopsis,
            probableCauseOfDeath,
            mannerOfDeath,
            typeOfDeath,
            scenePhotos,
            additionalImages
        } = formData;

        const scenePhotosBBCode = scenePhotos.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');
        const additionalImagesBBCode = additionalImages.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

        const bbCode = `[divbox=transparent][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=transparent][br][/br][center]DEATH INVESTIGATION REPORT[/center]
[hr][/hr]

[center][b]A. WRITTEN REPORT[/b][/center]

[list=none][color=transparent]spacer[/color]
The County Coroner's Office has been called regarding the decease that occurred at the location of [b]${placeOfDeath}[/b]. Upon receiving the call from[b] ${departmentFullName(department)}[/b], Coroner's Office dispatched a ${coronerRank} to the crime scene to conduct an investigation on the [b]${dateTime}[/b].

The ${coronerRank}, [b]${coronerName}[/b], Serial Number[b] ${serialNumber}[/b], arrived at the scene and identified the individual as[b]${decedentName}[/b], who was pronounced dead at [b]${pronouncedTimeOfDeath}[/b]. Following an initial investigation, The ${coronerRank} came up with the following [b]synopsis[/b]: ${synopsis}

Based on the information gathered from the scene investigation and the decedent's medical history (if available), the probable cause of death was determined to be [b]${probableCauseOfDeath}[/b]. The manner of death was classified as [b]${mannerOfDeath}[/b].
[/list]

[list=none][color=transparent]spacer[/color][center][b]B. PHOTOGRAPHIC DOCUMENTARY RECORD[/b][/center]

[divbox=transparent][center][size=85][b][u]SCENE PHOTOGRAPHY[/u][/b][/size][/center][hr][/hr]
[divbox=transparent][center][size=85][b][u]SCENE PHOTOGRAPHY[/u][/b][/size][/center][hr][/hr]
${scenePhotosBBCode}
[/divbox]

[divbox=transparent][center][size=85][b][u](( OUT OF CHARACTER ))[/u][/b][/size][/center][hr][/hr]
[divbox=transparent][center][size=85][b][u](( OUT OF CHARACTER ))[/u][/b][/size][/center][hr][/hr]
[size=75] This section clarifies whether or not if the player was character killed or player killed. 
In this case the player was; ${typeOfDeath}
In this case the player was; ${typeOfDeath}

[morgue screen, cinjuries, cdna links: [/size]
[morgue screen, cinjuries, cdna links: [/size]
${additionalImagesBBCode}
[/divbox]
[center][b]C. STATEMENT[/b][/center]

[divbox=transparent][center][size=85]As a ${coronerRank}, I have made detailed notes of my findings and conclusions, and these notes are available for review if necessary. However, I must note that these notes do not contain any personal opinions and are solely based on the evidence and facts available to me.

In conclusion, I hope that this report provides the necessary information required for the agency to move forward with any necessary actions. Please let me know if you require any additional information or if I can be of further assistance.

I certify that the information contained in this report is true and accurate to the best of my knowledge and belief. I have reviewed the report and ensured that all information included is complete and accurate. [/size][/divbox]

[center][b]D. PRIVACY AND CONFIDENTIALITY[/b][/center]

[divbox=transparent][center][size=85]This document from the Forensic Medicine and Pathology Department of Pillbox Hill Medical Center certifies the authenticity of the information contained within. Any unauthorized distribution or use of this information is in violation of the Health Insurance Portability and Accountability Act (HIPAA), as well as state and federal privacy laws, including but not limited to the San Andreas Confidentiality of Medical Information Act (CMIA) and the San Andreas Information Practices Act (IPA).

It is imperative that all parties handling this document respect the privacy and confidentiality of the decedent and their family. Any violation of these laws may result in legal action being taken against the responsible parties.

This document is provided for official purposes only and is not to be construed as legal advice or medical diagnosis. If additional information or clarification is needed, please contact the Forensic Medicine and Pathology Department of Pillbox Hill Medical Center.[/size][/divbox][/divbox]`;

        return bbCode;
    };

    const generateBBCode2 = () => {
        const {
            requestingOfficer,
            department,
            coronerName,
            coronerRank,
            coronerDiscord,
            coronerPHNumber,
            deathReport,
            additionalReports,
            showAdditionalReports
        } = formData;

        // Base BBCode template
        let bbCode = `[center][img]https://i.imgur.com/ItaoQkO.png[/img][/center]
[hr][/hr]
    
TO: ${requestingOfficer} - ${department}
FROM: ${coronerName} @ phmc.health
SUBJECT: Death Report Paperwork

For the attention of: [b]${department}[/b] - [b]${requestingOfficer}[/b]

This Coroner Report has been written by ${coronerRank} ${coronerName} you can find the enclosed documents attached to this email. 

[b]AUTOPSY INFORMATION / REQUEST(S)[/B] 
If you require an autopsy, please follow this link and follow the instructions: [url=https://phmc.gta.world/viewforum.php?f=265]Autopsy Portal[/url].


[altspoiler=Request a Autopsy FAQ]
1) How do I request an autopsy report and/or a death certificate?
Autopsies and death certificates can aid in various situations, especially whenever the cause of death plays a vital role in. Our professionals attempt to handle each and every request in a timely manner. However, given the fact that the effort of documentation is immense, a request fee is associated along with it. Upon its payment, the report or certificate will be sent to you directly.


2) Is there a fee associated with the request process?
Yes, there is a $2,000 fee associated with the request. This fee covers administrative costs related to processing and maintaining your requested report/certificate securely within our systems. It ensures the continued improvement of our services, maintaining the highest standards in healthcare data management.


3) How do I pay the $2,000 request fee?
To pay your $2,000 request fee, please log into the banking website and navigate to the "Payment" section. Select your preferred payment method (e.g., credit card, debit card), insert our routing number (020000062), enter the required payment details, review the transaction, and confirm your payment. (( Type /transfer 2000 020000062 ))

(( Autopsies for Player Kills (PK) and Character Kills (CK) will only be accepted if they are deemed strictly necessary and relevant to an important case or investigation. Prior to making a request for such an autopsy, a member of the Medical-Examiners must be notified and consulted with. Furthermore, it is mandatory to provide information about /cdamages and /cexamine. In the event that this information is not available, please do not hesitate to contact an administrator in-game, who can provide it. If these steps are not followed, an automatic denial will cause your request to be archived.

Also if it is a PK, please be sure to use John/Jane Doe with their character name in OOC brackets . Ex: John Doe (( James Smith ))

[url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=50]Click here to contact a Medical-Examiner to get the green light![/url] ))
[/altspoiler]
If you have further enquiries, feel free to reach out to the following individual:
[list] ${coronerName}
[*] Phone Number: ${coronerPHNumber}
[*] (( Discord: ${coronerDiscord} ))[/list]

[altspoiler=Forensic and Pathology Report]
${deathReport}
[code]
${deathReport}
[/code]
[/altspoiler]

${showAdditionalReports && additionalReports ? `
[altspoiler=Additional Coroner Reports]
${additionalReports}
[code]
${additionalReports}[/code]
[/altspoiler]
` : ''}

Kind regards
${coronerRank} ${coronerName}[/b]
Pillbox Hill Medical Center - Pathology  and Forensic Medicine

[size=75]The content of this email is intended for the person or entity to which it is addressed only. This email may contain confidential information. If you are not the person to whom this message is addressed, be aware that any use, reproduction, or distribution of this message is strictly prohibited. If you received this in error, please contact the sender and immediately delete this email and any attachments.[/size]`;

        return bbCode;
    };

    const generateInternalBBCode = () => {
        const {
            coronerName,
            coronerRank,
            coronerBadge,
            incidentDescription,
            incidentLocation,
            incidentDateTime,
            policeNotification,
            treatmentLocation,
            showInternalAdditionalReports,
            incidentPhotos,
        } = formData;

        const notificationText = policeNotification === 'Yes'
            ? '[b]Law Enforcement was notified[/b]'
            : '[b]Law Enforcement was [color=red]not[/color] notified[/b]';

        const partiesList = formData.partiesInvolved
            .map((party, index) => party ? `${index + 1}. ${party}` : '')
            .filter(party => party)
            .join('\n');

        let bbCode = `
[b]EMPLOYEE NAME:[/b] ${coronerName} ${coronerRank} ${coronerBadge}${incidentDescription}
${incidentDateTime} ${incidentLocation} ${policeNotification} ${treatmentLocation}
${policeNotification}
${partiesList} ${incidentPhotos}
${notificationText}
`;

        return bbCode;
    };

    const generateTitle = () => {
        if (bbCodeVersion === 1) {
            const { typeOfDeath, decedentName, decedentOOC, dateTime } = formData;
            const date = new Date(dateTime).toLocaleDateString('en-US');
            return `[${typeOfDeath}] ${decedentName} ((${decedentOOC})) - ${date}`;
        } else {
            const { decedentName, decedentOOC } = formData;
            return `Coroner Report - ${decedentName} | ${decedentOOC}`;
        }
    };

    const clearForm = () => {
        setFormData({
            coronerRank: 'Forensic Attendant',
            placeOfDeath: '',
            department: '',
            dateTime: '',
            coronerName: '',
            serialNumber: '',
            decedentName: '',
            pronouncedTimeOfDeath: '',
            synopsis: '',
            probableCauseOfDeath: '',
            mannerOfDeath: '',
            typeOfDeath: 'PK',
            decedentOOC: '',
            scenePhotos: '',
            additionalImages: '',
            requestingOfficer: '',
            deathReport: '',
            additionalReports: '',
            showAdditionalReports: false,
            internalReport: '',
            internalAdditionalReports: '',
            showInternalAdditionalReports: false,
            policeNotification: '',
            partiesInvolved: ['']
        });
        showNotification('Form cleared successfully!', 'check-circle');
    };

    const showNotification = (message, icon = 'check-circle') => {
        setNotification({
            message,
            icon
        });

        setTimeout(() => {
            setNotification(null);
        }, 3000);
    };

    const toggleBBCodeVersion = () => {
        setBbCodeVersion(prev => {
            const newVersion = prev === 1 ? 2 : prev === 2 ? 3 : 1;
            const message = `Switched to ${newVersion === 1 ? 'Death Investigation Report' :
                newVersion === 2 ? 'Email Generator' :
                    'Placeholder!'
                }`;
            showNotification(message, 'exchange-alt');
            return newVersion;
        });
    };

    const addParty = () => {
        setFormData(prev => ({
            ...prev,
            partiesInvolved: [...prev.partiesInvolved, '']
        }));
    };

    const handlePartyChange = (index, value) => {
        setFormData(prev => {
            const newParties = [...prev.partiesInvolved];
            newParties[index] = value;
            return {
                ...prev,
                partiesInvolved: newParties
            };
        });
    };

    // Add removeParty function
    const removeParty = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            partiesInvolved: prev.partiesInvolved.filter((_, index) => index !== indexToRemove)
        }));
    };

    return (
        <div className="App">
            <div className="header-info-wrapper">
                <div className="header-info">
                    {commitInfo.date && (
                        <>
                            <span className="version-info">
                                <a href="https://github.com/LPX-Dev/phmc-death-report/tree/gh-pages" target="_blank" rel="noopener noreferrer">
                                    This website was updated on {commitInfo.date} with version #{commitInfo.sha}</a>
                            </span>
                            <span className="contact-info">
                                Need help? Contact Alyson Frost on <a
                                    href="discord://discord.com/users/193126556146630656"
                                    className="discord-link"
                                >
                                    Discord <i className="fab fa-discord"></i>
                                </a>
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div className="container">
                <div className="form-container">
                    <button
                        type="button"
                        className="changelog-button"
                        onClick={() => setShowChangelog(true)}
                    >
                        <i className="fas fa-history"></i>
                        View Changelog
                    </button>

                    {showChangelog && (
                        <div className="modal-overlay">
                            <div className="modal">
                                <div className="modal-header">
                                    <h3>Changelog - Version 2.2</h3>
                                    <button
                                        className="close-button"
                                        onClick={() => setShowChangelog(false)}
                                        aria-label="Close changelog"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <div className="modal-content">
                                    <ul>
                                        <li>Migrated to Bootstrap Components</li>
                                        <li>Added QOL features</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                    <a href="https://github.com/LPX-Dev/phmc-death-report/tree/gh-pages" target="_blank" rel="noopener noreferrer">
                        <h5>This website is fully open source and was made by Fr0sty, you can report bugs in the PHMC Discord.</h5></a>
                    <br></br>
                    <div className="button-group">
                        <button
                            type="button"
                            className="changelog-button"
                            onClick={() => window.open('https://phmc.gta.world/viewforum.php?f=255', '_blank')}
                        >
                            <i className="fas fa-hospital"></i>
                            PHMC
                        </button>
                        <button
                            className="changelog-button"
                            onClick={toggleBBCodeVersion}
                        >
                            <i className="fas fa-exchange-alt"></i>
                            Switch to {bbCodeVersion === 1 ? 'Email Generator' : bbCodeVersion === 2 ? 'Placeholder Name' : 'Coroner Report'}
                        </button>
                    </div>
                    {notification && (
                        <Notification
                            message={notification.message}
                            icon={notification.icon}
                            onDismiss={() => setNotification(null)}
                        />
                    )}
                    <form>
                        {bbCodeVersion === 1 ? (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Dispatch Date and Time:</Form.Label>
                                    <Form.Control
                                        type="datetime-local"
                                        name="dateTime"
                                        value={formData.dateTime}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <div className="radio-inline-container">
                                        <span className="radio-text">Decedent Name:</span>
                                        <div className="radio-button-group">
                                            <Form.Check
                                                type="radio"
                                                id="johnDoe"
                                                label="John Doe"
                                                checked={isJohnDoe}
                                                onChange={handleDoeChange('john')}
                                                inline
                                            />
                                            <Form.Check
                                                type="radio"
                                                id="janeDoe"
                                                label="Jane Doe"
                                                checked={isJaneDoe}
                                                onChange={handleDoeChange('jane')}
                                                inline
                                            />
                                        </div>
                                    </div>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        as="textarea"
                                        name="decedentName"
                                        value={formData.decedentName}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent's Name ((OOC)):</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        placeholder="John Snow"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Type of Death:</Form.Label>
                                    <Form.Select
                                        name="typeOfDeath"
                                        value={formData.typeOfDeath}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="PK">PK</option>
                                        <option value="CK">CK</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Place of Death:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="placeOfDeath"
                                        value={formData.placeOfDeath}
                                        onChange={handleChange}
                                        placeholder="Mirror Park"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Pronounced Time of Death:</Form.Label>
                                    <Form.Control
                                        type="datetime-local"
                                        name="pronouncedTimeOfDeath"
                                        value={formData.pronouncedTimeOfDeath}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Brief Summary:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="synopsis"
                                        value={formData.synopsis}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Probable Cause of Death:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="probableCauseOfDeath"
                                        value={formData.probableCauseOfDeath}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Manner of Death:</Form.Label>
                                    <Form.Select
                                        name="mannerOfDeath"
                                        value={formData.mannerOfDeath}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="" disabled>Select Manner</option>
                                        <option value="Natural">Natural - the death resulted from natural causes, such as disease or old age.</option>
                                        <option value="Accident">Accidental - the death resulted from an unintentional or unexpected event, such as a car accident or drug overdose.</option>
                                        <option value="Suicide">Suicide - the death resulted from a self-inflicted injury with the intention to end ones life.</option>
                                        <option value="Homicide">Homicide - the death resulted from the intentional actions of another person, such as a murder, manslaughter and/or legally justified means such as self defense. </option>
                                        <option value="Undetermined">Undetermined - the evidence is insufficient to determine the manner of death</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Requesting Agency:</Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="" disabled>Select Department</option>
                                        <option value="LSFD">LSFD</option>
                                        <option value="LSPD">LSPD</option>
                                        <option value="LSSD">LSSD</option>
                                        <option value="PHMC">PHMC</option>
                                        <option value="SANFIRE">SANFIRE</option>
                                        <option value="SADCR">SADCR</option>
                                        <option value="LSGOV">LSGOV</option>
                                        <option value="911 Call">Emergency 911 Dispatch</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Coroner Name:</Form.Label>
                                    <Form.Select
                                        name="coronerName"
                                        value={formData.coronerName}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select Coroner</option>
                                        {coronerList.map(coroner => (
                                            <option key={coroner.badge} value={coroner.name}>
                                                {coroner.name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Job Classification:</Form.Label>
                                    <Form.Select
                                        name="coronerRank"
                                        value={formData.coronerRank}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="Trainee Forensic Attendant">Trainee Forensic Attendant</option>
                                        <option value="Forensic Attendant">Forensic Attendant</option>
                                        <option value="Senior Forensic Attendant">Senior Forensic Attendant </option>
                                        <option value="Supervising Forensic Attendant">Supervising Forensic Attendant</option>
                                        <option value="Coroner Investigator">Coroner Investigator</option>
                                        <option value="Supervising Coroner Investigator">Supervising Coroner Investigator</option>
                                        <option value="Medical Examiner">Medical Examiner</option>
                                        <option value="Supervising Medical Examiner">Supervising Medical Examiner</option>
                                        <option value="Deputy Chief Medical Examiner">Deputy Chief Medical Examiner</option>
                                        <option value="Chief Medical Examiner">Chief Medical Examiner</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>
                                        Badge Number: ((/badge [Your ID]))
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="serialNumber"
                                        value={formData.serialNumber}
                                        onChange={handleChange}
                                        placeholder="Enter or select coroner for auto-fill"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 upload-container">
                                    <Form.Label>
                                        Scene Photos Links (comma-separated):
                                    </Form.Label>
                                    <InputGroup>
                                        <Form.Control
                                            as="textarea"
                                            name="scenePhotos"
                                            value={formData.scenePhotos}
                                            onChange={handleChange}
                                            rows="2"
                                            required
                                            className="form-control"
                                        />
                                        <Button
                                            variant="success"
                                            disabled={isUploading}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.multiple = true;
                                                input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                                                input.click();
                                            }}
                                        >
                                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                            {isUploading ? 'Uploading...' : 'Upload Images'}
                                        </Button>

                                    </InputGroup>
                                    <span className="imgbb-attribution">
                                        Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                    </span>
                                </Form.Group>
                                <Form.Group className="mb-3 upload-container">
                                    <Form.Label>
                                        Morgue Screen, Cinjuries, CDNA Links (comma-separated)
                                    </Form.Label>

                                    <div className="input-group">
                                        <Form.Control
                                            as="textarea"
                                            name="additionalImages"
                                            value={formData.additionalImages}
                                            onChange={handleChange}
                                            rows="2"
                                            required
                                            className="form-control"
                                        />
                                        <Button
                                            variant="success"
                                            disabled={isUploading}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.multiple = true;
                                                input.onchange = (e) => handleImageUpload(e, 'additionalImages');
                                                input.click();
                                            }}
                                        >
                                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                            {isUploading ? 'Uploading...' : 'Upload Images'}
                                        </Button>
                                    </div>
                                    <span className="imgbb-attribution">
                                        Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                    </span>

                                </Form.Group>

                            </>
                        ) : bbCodeVersion === 2 ? (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Officer Name or Badge Number:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Requesting Agency:</Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="" disabled>Select Department</option>
                                        <option value="LSFD">LSFD</option>
                                        <option value="LSPD">LSPD</option>
                                        <option value="LSSD">LSSD</option>
                                        <option value="PHMC">PHMC</option>
                                        <option value="SANFIRE">SANFIRE</option>
                                        <option value="SADCR">SADCR</option>
                                        <option value="LSGOV">LSGOV</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Coroner Name:</Form.Label>
                                    <Form.Select
                                        name="coronerName"
                                        value={formData.coronerName}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select Coroner</option>
                                        {coronerList.map(coroner => (
                                            <option key={coroner.badge} value={coroner.name}>
                                                {coroner.name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Job Classification:</Form.Label>
                                    <Form.Select
                                        name="coronerRank"
                                        value={formData.coronerRank}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="Trainee Forensic Attendant">Trainee Forensic Attendant</option>
                                        <option value="Forensic Attendant">Forensic Attendant</option>
                                        <option value="Senior Forensic Attendant">Senior Forensic Attendant </option>
                                        <option value="Supervising Forensic Attendant">Supervising Forensic Attendant</option>
                                        <option value="Coroner Investigator">Coroner Investigator</option>
                                        <option value="Supervising Coroner Investigator">Supervising Coroner Investigator</option>
                                        <option value="Medical Examiner">Medical Examiner</option>
                                        <option value="Supervising Medical Examiner">Supervising Medical Examiner</option>
                                        <option value="Deputy Chief Medical Examiner">Deputy Chief Medical Examiner</option>
                                        <option value="Chief Medical Examiner">Chief Medical Examiner</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>
                                        Coroner Contact Number:
                                        </Form.Label>
                                        <span className="helper-text">
                                            (By default PHMC Landline is added, if you have a work number please add it)
                                        </span>

                                    <Form.Control
                                        as="textarea"
                                        name="coronerPHNumber"
                                        value={formData.coronerPHNumber}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                        />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Coroner Discord Name:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="coronerDiscord"
                                        value={formData.coronerDiscord}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent(s) Names:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="decedentName"
                                        value={formData.decedentName}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                    />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Decedent OOC Name:</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            name="decedentOOC"
                                            value={formData.decedentOOC}
                                            onChange={handleChange}
                                            rows="1"
                                            required
                                            className="form-control"
                                        />
                                    </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Paste Death Report BBCode:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <div className="input-group-horizontal">
                                        <Form.Label>Additional Reports:</Form.Label>
                                        <Form.Check
                                            type="checkbox"
                                            checked={formData.showAdditionalReports}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                showAdditionalReports: e.target.checked
                                            }))}
                                        />
                                    </div>
                                    {formData.showAdditionalReports && (
                                        <>
                                            <Form.Label>Additional Coroner Reports</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                id="additionalReports"
                                                name="additionalReports"
                                                value={formData.additionalReports}
                                                onChange={handleChange}
                                                rows="4"
                                                placeholder="Paste additional coroner reports here"
                                                className="form-control"
                                            />
                                        </>
                                    )}
                                </Form.Group>
                            </>
                        ) : (
                            // BBCode 3 - Internal Report
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Officer Name or Badge Number:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Requesting Agency:</Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="" disabled>Select Department</option>
                                        <option value="LSFD">LSFD</option>
                                        <option value="LSPD">LSPD</option>
                                        <option value="LSSD">LSSD</option>
                                        <option value="PHMC">PHMC</option>
                                        <option value="SANFIRE">SANFIRE</option>
                                        <option value="SADCR">SADCR</option>
                                        <option value="LSGOV">LSGOV</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Coroner Name:</Form.Label>
                                    <Form.Select
                                        name="coronerName"
                                        value={formData.coronerName}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select Coroner</option>
                                        {coronerList.map(coroner => (
                                            <option key={coroner.badge} value={coroner.name}>
                                                {coroner.name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Job Classification:</Form.Label>
                                    <Form.Select
                                        name="coronerRank"
                                        value={formData.coronerRank}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="Trainee Forensic Attendant">Trainee Forensic Attendant</option>
                                        <option value="Forensic Attendant">Forensic Attendant</option>
                                        <option value="Senior Forensic Attendant">Senior Forensic Attendant </option>
                                        <option value="Supervising Forensic Attendant">Supervising Forensic Attendant</option>
                                        <option value="Coroner Investigator">Coroner Investigator</option>
                                        <option value="Supervising Coroner Investigator">Supervising Coroner Investigator</option>
                                        <option value="Medical Examiner">Medical Examiner</option>
                                        <option value="Supervising Medical Examiner">Supervising Medical Examiner</option>
                                        <option value="Deputy Chief Medical Examiner">Deputy Chief Medical Examiner</option>
                                        <option value="Chief Medical Examiner">Chief Medical Examiner</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>
                                        Coroner Contact Number:
                                            </Form.Label>
                                            <span className="helper-text">
                                                (By default PHMC Landline is added, if you have a work number please add it)
                                            </span>
                                    <Form.Control
                                        as="textarea"
                                        name="coronerPHNumber"
                                        value={formData.coronerPHNumber}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                        />

                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Coroner Discord Name:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="coronerDiscord"
                                        value={formData.coronerDiscord}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent(s) Names:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="decedentName"
                                        value={formData.decedentName}
                                        onChange={handleChange}
                                        rows="1"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Paste Internal Report BBCode:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="internalReport"
                                        value={formData.internalReport}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <div className="input-group-horizontal">
                                        <Form.Label>Additional Internal Reports:</Form.Label>
                                        <Form.Check
                                            type="checkbox"
                                            checked={formData.showInternalAdditionalReports}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                showInternalAdditionalReports: e.target.checked
                                            }))}
                                        />
                                    </div>
                                    {formData.showInternalAdditionalReports && (
                                        <>
                                            <Form.Label>Additional Internal Reports</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                id="internalAdditionalReports"
                                                name="internalAdditionalReports"
                                                value={formData.internalAdditionalReports}
                                                onChange={handleChange}
                                                rows="4"
                                                placeholder="Paste additional internal reports here"
                                                className="form-control"
                                            />
                                        </>
                                    )}
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>WHERE WAS THE TREATMENT PROVIDED?</Form.Label>
                                    <Form.Select
                                        name="treatmentLocation"
                                        value={formData.treatmentLocation}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select location...</option>
                                        <option value="On Site">On Site</option>
                                        <option value="Emergency Room">Emergency Room</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Police Notification:</Form.Label>
                                    <Form.Select
                                        name="policeNotification"
                                        value={formData.policeNotification}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Name | Role | Contact of Parties Involved:</Form.Label>
                                    <div className="parties-container">
                                        {formData.partiesInvolved.map((party, index) => (
                                            <div key={index} className="party-input">
                                                <span>{index + 1}.</span>
                                                <Form.Control
                                                    type="text"
                                                    value={party}
                                                    onChange={(e) => handlePartyChange(index, e.target.value)}
                                                    placeholder="Name / Role / Contact"
                                                    className="form-control"
                                                />
                                                <Button
                                                    variant="danger"
                                                    onClick={() => removeParty(index)}
                                                    className="remove-party-button"
                                                >
                                                    REMOVE FIELD
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="primary"
                                            onClick={addParty}
                                            className="add-party-button"
                                        >
                                            <i className="fas fa-plus"></i> Add Party
                                        </Button>
                                    </div>
                                </Form.Group>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={clearForm}
                            className="upload-button"
                        >
                            <i className="fas fa-trash-alt"></i>
                            Clear Form
                        </button>
                    </form>
                </div>
                <div className="output-container">
                    <div className="image-container">
                        <a href="discord://discord.com/channels/860254678653992992/1247889726204022956" target="_blank" rel="noopener noreferrer">
                            <img src={Feedback}
                                height={350}
                                width={350}
                                className="Center"
                            />
                        </a>
                    </div>
                    <div className="form-type-header">
                        <h3>You are viewing:
                            {bbCodeVersion === 1 ? ' Death Investigation Report' :
                                bbCodeVersion === 2 ? ' Coroner Email Generator' :
                                    'You shouldn`t be able to see this!'}
                        </h3>
                    </div>
                    <h2>Generated BBCode</h2>


                    <div className="bbcode-output">
                        <pre>{bbCodeVersion === 1 ? generateBBCode() : bbCodeVersion === 2 ? generateBBCode2() : generateInternalBBCode()}</pre>
                    </div>
                    <h1>Generated Title</h1>
                    <div className="title-output">
                        <pre>{generateTitle()}</pre>
                    </div>

                    {bbCodeVersion === 2 && (
                        <div className="agency-buttons">
                            <h5>Agency Email Methods: </h5>
                            <a
                                href="https://lspd.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={LSPDLogo}
                                    alt="LSPD"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                            <a
                                href="https://lssd.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={LSSDLogo}
                                    alt="LSSD"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                            <a
                                href="https://lsfd.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={LSFDLogo}
                                    alt="LSFD"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                            <a
                                href="https://phmc.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={PHMCLogo}
                                    alt="PHMC"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                        </div>
                    )}

                    <div className="button-container">
                        <button
                            type="button"
                            className="changelog-button"
                            onClick={() => {
                                const title = generateTitle();
                                navigator.clipboard.writeText(title).then(() => {
                                    showNotification('Title copied to clipboard!', 'check-circle');
                                });
                            }}
                        >
                            <i className="fas fa-copy"></i>
                            Copy Title
                        </button>

                        <button
                            type="button"
                            className="changelog-button"
                            onClick={() => {
                                const bbCode = bbCodeVersion === 1 ? generateBBCode() : bbCodeVersion === 2 ? generateBBCode2() : generateInternalBBCode();
                                const currentDateTime = new Date().toLocaleString();
                                const userAgent = navigator.userAgent;
                                const browserName = getBrowserName(userAgent);
                                const { decedentName, decedentOOC, coronerName, requestingOfficer } = formData;
                                const version = bbCodeVersion === 1 ? "Death Report" : "Coroner Email Report";

                                navigator.clipboard.writeText(bbCode).then(() => {
                                    showNotification(`${bbCodeVersion === 1 ? "Death Report" : "Coroner Report"} copied!`, 'check-circle');

                                    // Send POST request to Discord Webhook
                                    fetch(process.env.REACT_APP_DISCORD_WEBHOOK, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            content: bbCodeVersion === 1
                                                ? `${coronerName} has used your website to fill out a Death Report: \nDecedent's Name: ${decedentName}\nDecedent's OOC Name: ${decedentOOC}\nTimestamp: ${currentDateTime}\nBrowser: ${browserName}\nVersion: ${version}\n`
                                                : `${coronerName} has used your website to fill out an Coroner Email Report: \nRequesting Officer: ${requestingOfficer}\nTimestamp: ${currentDateTime}\nBrowser: ${browserName}\nVersion: ${version}\n`
                                                    `${coronerName} has used your website to fill out an Internal Incident Report: ADD VALUES\n`
                                        })
                                    }).catch(error => {
                                        console.error('Error:', error);
                                        fetch(process.env.REACT_APP_DISCORD_WEBHOOK, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                content: `An error occurred in ${version}: ${error.message}\nTimestamp: ${currentDateTime}\nBrowser: ${browserName}\n`
                                            })
                                        });
                                    });
                                });
                            }}
                        >
                            <i className="fas fa-clipboard"></i>
                            Copy {bbCodeVersion === 1 ? "Death Report" :
                                bbCodeVersion === 2 ? "Coroner Report" :
                                    "Internal Report"}
                        </button>
                    </div>

                    {bbCodeVersion === 3 ? (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/viewforum.php?f=269" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={Paperwork}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="Internal Reports Link"
                                />
                            </a>
                        </div>
                    ) : bbCodeVersion === 1 && (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/posting.php?mode=post&f=267" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={Paperwork}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="Death Reports Link"
                                />
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
