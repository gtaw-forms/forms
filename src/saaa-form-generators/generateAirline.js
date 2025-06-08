const generateAirline = (formData) => {
    const {
        // Company Information
        companyName = 'N/A',
        contactNumber = 'N/A',
        companyAddress = 'N/A',
        ceoFullName = 'N/A', // This will now be used for acknowledgement

        // Company / Agency specialization
        specCargoCarrier = false,
        specPassengerCarrier = false,
        specOther = false,
        specOtherText = '', // Text for the "Other" specialization

        // Flight Team Information
        chiefPilots = 'N/A', // Text field for chief pilots and licenses
        staffList = 'N/A',   // Text field for staff list and licenses

        // Fleet Information (Aircraft types)
        fleetSingleEngineFixed = false,
        fleetMultiEngineFixed = false,
        fleetTailWheel = false,
        fleetSingleEngineHeli = false,
        fleetMultiEngineHeli = false,
        fleetUltralight = false,

        // Acknowledgement
        ackAuthorize = false,
    } = formData;

    // Using CEO's full name for the acknowledgement if available, otherwise fallback
    const registrantName = ceoFullName !== 'N/A' && ceoFullName.trim() !== ''
        ? ceoFullName
        : 'the applicant';

    const acknowledgementText = ackAuthorize
        ? `[X] By submitting this application, I, ${registrantName}, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies.`
        : `[ ] By submitting this application, I, ${registrantName}, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies. (NOT ACKNOWLEDGED)`;

    let bbCode = `[center]

[align=center][img]https://i.imgur.com/gmUb00L.png[/img][/align]
[size=200][color=#535a6c]SAN ANDREAS AVIATION ADMINISTRATION[/color][/size]

[size=180][color=#535a6c]LICENSING: COMPANY / AGENCY OPERATION PERMIT[/color][/size][/center]





[size=150][color=#535a6c]COMPANY INFORMATION[/color]
[hr][/hr]
[size=120]
[b]Company name:[/b] ${companyName}

[b]Contact number:[/b] ${contactNumber}

[b]Address:[/b] ${companyAddress}

[b]Chief Executive Officer:[/b] ${ceoFullName}

[b]Company / Agency specialization (Mark with X): [/b]
[list][*][b][${specCargoCarrier ? 'X' : ' '}] Cargo carrier[/b]
[*][b][${specPassengerCarrier ? 'X' : ' '}] Passenger carrier[/b]
[*][b][${specOther ? 'X' : ' '}] Other:[/b] ${specOther ? specOtherText : '__________________'} [/list]

[/size]

[size=150][color=#535a6c]FLIGHT TEAM INFORMATION[/color][/size]
[hr][/hr]
[size=120]

[b]Chief pilot(s) + valid license:[/b]
${chiefPilots}

[b]List of staff + valid license(s):[/b]
${staffList}
[/size]


[size=150][color=#535a6c]FLEET INFORMATION[/color][/size]
[hr][/hr]
[size=120]
[b]Which aircraft does the company / agency operate? (Mark with X)[/b]

[list][*][b][${fleetSingleEngineFixed ? 'X' : ' '}] Single-Engine, Fixed-wing[/b]
[*][b][${fleetMultiEngineFixed ? 'X' : ' '}] Multi-Engine, Fixed-Wing[/b]
[*][b][${fleetTailWheel ? 'X' : ' '}] Tail-wheel[/b]
[*][b][${fleetSingleEngineHeli ? 'X' : ' '}] Single-Engine Helicopter[/b]
[*][b][${fleetMultiEngineHeli ? 'X' : ' '}] Multi-Engine Helicopter[/b]
[*][b][${fleetUltralight ? 'X' : ' '}] Ultralight[/b][/list]



[size=150][color=#535a6c]ACKNOWLEDGEMENT & AUTHORIZATION[/color][/size]
[hr][/hr]
[size=120]
${acknowledgementText}`;

    return bbCode;
};

export default generateAirline;
