const generateAirportRegistration = (formData) => {
    const {
        // Registrant Information
        registrantFirstName = '',
        registrantLastName = '',
        registrantDateOfBirth = '',
        registrantPlaceOfBirth = '',
        registrantAddress = '',
        registrantContactNumber = '',

        // Registration Type
        registrationTypeCommercial = false,
        registrationTypePrivate = false,
        registrationTypeUtility = false,

        // Agency / Company Information
        companyName = '',
        companyDateOfEstablishment = '',
        companyTypePrivate = false,
        companyTypeGovernment = false,

        // Aircraft Information
        aircraftType = '',
        aircraftModel = '',
        aircraftDateOfPurchase = '',
        aircraftImageLink = '', // Assuming this will be a URL

        // Callsigns
        requestedCallsign = '',

    } = formData;


    const bbCode = `[divbox=#FFFFFF]
[table]
[tr]
[td]
[saaa=150][/saaa][/td]

[td][align=left][color=#FFFFFF][b][font=arial][size=150]
Administrative Services Bureau

Registration of Aircraft Tail Numbers in the State of San Andreas[/size][/font]
[size=110][font=arial]
San Andreas Aviation Administration

[/align][/td]
[/tr]
[/table]
[/divbox]


[divbox=#FFFFFF][b]1. [color=#107fc0]Registering an Aircraft[/color][/b][/divbox]

[divbox=#FFFFFF]
[u]Registrant Information:[/u]
Firstname: ${registrantFirstName}
Lastname: ${registrantLastName}
Date of Birth: ${registrantDateOfBirth}
Place of Birth: ${registrantPlaceOfBirth}
Address: ${registrantAddress}
Contact Number: ${registrantContactNumber}
[/divbox]

[divbox=#FFFFFF]
[u]Registration Type:[/u]
[${registrationTypeCommercial ? 'X' : '-'}] Commercial
[${registrationTypePrivate ? 'X' : '-'}] Private
[${registrationTypeUtility ? 'X' : '-'}] Utility
[/divbox]

[divbox=#FFFFFF]
[u]Agency / Company Information:[/u]
Name: ${companyName}
Date of Establishment: ${companyDateOfEstablishment}
Type:
[${companyTypePrivate ? 'X' : '-'}] Private
[${companyTypeGovernment ? 'X' : '-'}] Government
[/divbox]

[divbox=#FFFFFF]
[u]Aircraft Information:[/u]
Type: ${aircraftType}
Model: ${aircraftModel}
Date of Purchase: ${aircraftDateOfPurchase}
Photographic Image of the Aircraft: ${aircraftImageLink}
[/divbox]

[divbox=#FFFFFF]
[u]Callsigns[/u]
(see [url=https://saaa.gta.world/viewtopic.php?p=3205#p3205]here[/url])
Requested callsign (E.g. HighFlyer; WingmanMike): ${requestedCallsign}
[/divbox]`;

    // You might want to add a section for ackAuthorize if it's meant to be displayed
    // For example:
    // bbCode += `\n\n[divbox=#FFFFFF]Authorization Acknowledged: ${ackAuthorize ? 'Yes' : 'No'}[/divbox]`;

    return bbCode;
};

export default generateAirportRegistration;
