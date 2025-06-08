// src/saaa-form-generators/generateHeliport.js

const generateHeliport = (formData) => {
    const {
        // Personal Information
        registrantFullName = 'N/A',
        registrantContactNumbers = 'N/A', // Can be a single string or comma-separated
        registrantResidentialAddress = 'N/A',

        // Heliport Information
        heliportAddresses = 'N/A', // Can be a single string or comma-separated
        heliportNumPads = 'N/A',
        heliportPhotoLinks = 'No photographs provided.', // Link(s) to photos
        heliportLayoutPlanLinks = 'No layout plan provided.', // Link(s) to layout plan

        // Acknowledgement
        ackAuthorize = false,
    } = formData;

    const acknowledgementText = ackAuthorize
        ? `[X] By submitting this request, I, [b]${registrantFullName}[/b], hereby certify that the above statements are true and correct to the best of my knowledge. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, or maliciously adulterating this request will result in immediate rejection and an indefinite ban from applying for a flight instructor certification.`
        : `[ ] By submitting this request, I, [b]${registrantFullName}[/b], hereby certify that the above statements are true and correct to the best of my knowledge. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, or maliciously adulterating this request will result in immediate rejection and an indefinite ban from applying for a flight instructor certification. (NOT ACKNOWLEDGED)`;

    const bbCode = `[center]

[align=center][img]https://i.imgur.com/gmUb00L.png[/img][/align]
[size=200][color=#535a6c]SAN ANDREAS AVIATION ADMINISTRATION[/color][/size]

[size=180][color=#535a6c]LICENSING: HELIPORT REGISTRATION FORM[/color][/size][/center]





[size=150][color=#535a6c]PERSONAL INFORMATION[/color][/size]
[hr][/hr]
[size=120]
[b]Full name:[/b] ${registrantFullName}

[b]Contact number(s):[/b] ${registrantContactNumbers}

[b]Residential Address:[/b] ${registrantResidentialAddress}
[/size]


[size=150][color=#535a6c]HELIPORT INFORMATION[/color][/size]
[hr][/hr]
[size=120]
[b]Address(es):[/b] ${heliportAddresses}

[b]Number of requested pads:[/b] ${heliportNumPads}

---------------------------

[b]Photograph(s) of the location(s):[/b]
${heliportPhotoLinks}

[b]Layout plan:[/b]
${heliportLayoutPlanLinks}
[/size]





[size=150][color=#535a6c]ACKNOWLEDGEMENT & AUTHORIZATION[/color][/size]
[hr][/hr]
[size=120]
${acknowledgementText}
[/size]`;

    return bbCode;
};

export default generateHeliport;
