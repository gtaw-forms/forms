import React, { createContext, useState, useContext } from 'react';

const ModalContext = createContext();

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
    const [showEmsBingoModal, setShowEmsBingoModal] = useState(false);
    const [showGtaCallback, setShowGtaCallback] = useState(false);
    const [showEasterEggModal, setShowEasterEggModal] = useState(false);
    const [easterEggType, setEasterEggType] = useState(null);
    const [showAgencySelector, setShowAgencySelector] = useState(false);
    const [hideAgencySelector, setHideAgencySelector] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showEmsAmaModal, setShowEmsAmaModal] = useState(false);
    const [showBusinessCard, setShowBusinessCard] = useState(false);
    const [showCoronerTips, setShowCoronerTips] = useState(false);
    const [showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal] = useState(false);
    const [showCctvRequestModal, setShowCctvRequestModal] = useState(false);
    const [showPHMCModal, setShowPHMCModal] = useState(false);
    const [switchableModalTitle, setSwitchableModalTitle] = useState('');
    const [switchableFormsList, setSwitchableFormsList] = useState([]);
    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);

    const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);

    const value = {
        showEmsBingoModal, setShowEmsBingoModal,
        showGtaCallback, setShowGtaCallback,
        showEasterEggModal, setShowEasterEggModal,
        easterEggType, setEasterEggType,
        showAgencySelector, setShowAgencySelector,
        hideAgencySelector, setHideAgencySelector,
        showEmployeeModal, setShowEmployeeModal,
        showEmsAmaModal, setShowEmsAmaModal,
        showBusinessCard, setShowBusinessCard,
        showCoronerTips, setShowCoronerTips,
        showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal,
        showCctvRequestModal, setShowCctvRequestModal,
        showPHMCModal, setShowPHMCModal,
        switchableModalTitle, setSwitchableModalTitle,
        switchableFormsList, setSwitchableFormsList,
        showFeatureRequestModal, setShowFeatureRequestModal,

        showPrivacyPolicyModal, setShowPrivacyPolicyModal,
    };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
};
