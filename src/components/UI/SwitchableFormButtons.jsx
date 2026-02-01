import React from 'react';
import { Button } from 'react-bootstrap';

const SwitchableFormButtons = ({ bbCodeVersion, openSwitchableModal, formGroups }) => {
    const {
        coronerFormsSubGroup,
        physicalEvalFormsSubGroup,
        psychEvalFormsSubGroup,
        generalConsultFormsSubGroup,
        commentaryNoteFormsSubGroup,
        mentalHealthFormsSubGroup,
        phmcInternalEmails
    } = formGroups;

    const switchableFormButtonConfig = [
        { versions: [1, 2, 4, 8, 11, 37], text: "Coroner Forms", icon: "fa fa-laptop", modalArgs: ["Coroner Forms", coronerFormsSubGroup] },
        { versions: [6, 7], text: "Switch Physical Evaluation Forms", icon: "fas fa-exchange-alt", modalArgs: ["Select Physical Evaluation Form", physicalEvalFormsSubGroup] },
        { versions: [28, 29], text: "Switch Psychological Evaluation Form", icon: "fas fa-exchange-alt", modalArgs: ["Select Psychological Evaluation Form", psychEvalFormsSubGroup] },
        { versions: [20, 21], text: "Switch General Consultation Forms", icon: "fas fa-exchange-alt", modalArgs: ["Select General Consultation Form", generalConsultFormsSubGroup] },
        { versions: [22, 23], text: "Switch Commentary Note Form", icon: "fas fa-exchange-alt", modalArgs: ["Select Commentary Note Form", commentaryNoteFormsSubGroup] },
        { versions: [14, 16], text: "Switch Mental Health Form", icon: "fas fa-exchange-alt", modalArgs: ["Select Mental Health Form", mentalHealthFormsSubGroup] },
        { versions: [27, 35], text: "Change Email Forms", icon: "fas fa-exchange-alt", modalArgs: ["Select Email Form", phmcInternalEmails] },
    ];

    const switchableButton = switchableFormButtonConfig.find(config => config.versions.includes(bbCodeVersion));

    if (!switchableButton) {
        return null;
    }

    return (
        <Button
            className="changelog-button"
            variant='secondary'
            onClick={() => openSwitchableModal(...switchableButton.modalArgs)}
        >
            <i className={switchableButton.icon}></i>
            <span> {switchableButton.text}</span>
        </Button>
    );
};

export default SwitchableFormButtons;
