// src/saaa-form-generators/generateFlightSchool.js
const generateFlightSchool = (formData) => {
    const {
        regFullName = 'N/A',
        regContactNumber = 'N/A',
        regPosition = 'N/A',
        companyName = 'N/A',
        companyAddress = 'N/A',
        aircraftTypesSelected = [], // Expects an array of selected type values
        aircraftModelsSelected = [], // Expects an array of selected model values
        chiefPilotFullName = 'N/A',
        chiefPilotContactNumber = 'N/A',
        trainingPlanLink = 'N/A',
    } = formData;

    // Helper to mark checkboxes in BBCode
    const markIfSelected = (value, selectedArray) => selectedArray.includes(value) ? '[X]' : '[ ]';

    const aircraftTypesBBCode = `
${markIfSelected('SingleEngineFixedWing', aircraftTypesSelected)} Single-Engine, Fixed-wing
${markIfSelected('MultiEngineFixedWing', aircraftTypesSelected)} Multi-Engine, Fixed-Wing
${markIfSelected('TailWheel', aircraftTypesSelected)} Tail-wheel
${markIfSelected('SingleEngineHelicopter', aircraftTypesSelected)} Single-Engine Helicopter
${markIfSelected('MultiEngineHelicopter', aircraftTypesSelected)} Multi-Engine Helicopter
${markIfSelected('Ultralight', aircraftTypesSelected)} Ultralight
    `.trim();

    const aircraftModelsBBCode = `
${markIfSelected('Vestra', aircraftModelsSelected)} Vestra
${markIfSelected('Miljet', aircraftModelsSelected)} Miljet
${markIfSelected('BuckinghamLuxor', aircraftModelsSelected)} Buckingham Luxor
${markIfSelected('BuckinghamShamal', aircraftModelsSelected)} Buckingham Shamal
${markIfSelected('Cuban800', aircraftModelsSelected)} Cuban 800
${markIfSelected('Duster', aircraftModelsSelected)} Duster
${markIfSelected('Dodo', aircraftModelsSelected)} Dodo
${markIfSelected('Mallard', aircraftModelsSelected)} Mallard
${markIfSelected('Mammatus', aircraftModelsSelected)} Mammatus
${markIfSelected('Velum', aircraftModelsSelected)} Velum
${markIfSelected('BuckinghamNimbus', aircraftModelsSelected)} Buckingham Nimbus
${markIfSelected('BuckinghamAlphaZ1', aircraftModelsSelected)} Buckingham Alpha-Z1
${markIfSelected('BuckinghamHowardNX25', aircraftModelsSelected)} Buckingham Howard NX-25
${markIfSelected('MammothMogul', aircraftModelsSelected)} Mammoth Mogul
${markIfSelected('P45Nokota', aircraftModelsSelected)} P-45 Nokota
${markIfSelected('WesternCompanySeabreeze', aircraftModelsSelected)} Western Company Seabreeze
${markIfSelected('PegassiUltralight', aircraftModelsSelected)} Pegassi Ultralight
${markIfSelected('JobuiltValum5Seats', aircraftModelsSelected)} Jobuilt Valum (5 seats)
${markIfSelected('Valkyrie', aircraftModelsSelected)} Valkyrie
${markIfSelected('Swift', aircraftModelsSelected)} Swift
${markIfSelected('Buzzard', aircraftModelsSelected)} Buzzard
${markIfSelected('Frogger', aircraftModelsSelected)} Frogger
${markIfSelected('Maverick', aircraftModelsSelected)} Maverick
${markIfSelected('PoliceMaverick', aircraftModelsSelected)} Police Maverick
${markIfSelected('Volatus', aircraftModelsSelected)} Volatus
${markIfSelected('SuperVolito', aircraftModelsSelected)} SuperVolito
${markIfSelected('Havok', aircraftModelsSelected)} Havok
    `.trim();


    const bbCode = `[center][align=center][img]https://i.imgur.com/gmUb00L.png[/img][/align]

[size=200][color=#535a6c]SAN ANDREAS AVIATION ADMINISTRATION[/color][/size]

[size=180][color=#535a6c]LICENSING: FLIGHT SCHOOLS & AVIATION ACADEMIES[/color][/size][/center]



[size=150][color=#535a6c]REGISTRANT INFORMATION[/color][/size]
[hr][/hr]
[size=120]
[b]Full name:[/b] ${regFullName}
[b]Contact number:[/b] ${regContactNumber}
[b]Position:[/b] ${regPosition}
[/size]


[size=150][color=#535a6c]COMPANY/ENTITY INFORMATION[/color][/size]
[hr][/hr]
[size=120]
[b]Name:[/b] ${companyName}
[b]Address:[/b] ${companyAddress}
[b]Aircraft Types (Mark with X those which the company provides training on):[/b]
${aircraftTypesBBCode}

[b]Aircraft Makes & Models (Mark with X those which are in the company's fleet)[/b]
${aircraftModelsBBCode}
[/size]


[size=150][color=#535a6c]CHIEF PILOT INFORMATION[/color][/size]
[hr][/hr]
[size=120]
[b]Full name:[/b] ${chiefPilotFullName}
[b]Contact number:[/b] ${chiefPilotContactNumber}
[/size]


[size=150][color=#535a6c]TRAINING PLAN[/color][/size]
[hr][/hr]
[size=120][i]Free text, link to a Google Sheets / Google Docs / PDF file / Other[/i]
${trainingPlanLink}
[/size]`;

    return bbCode;
};

export default generateFlightSchool;
