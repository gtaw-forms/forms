import React, { createContext, useState, useContext } from 'react';

const ModalContext = createContext();

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
    const [showEasterEggModal, setShowEasterEggModal] = useState(false);
    const [easterEggType, setEasterEggType] = useState(null);
    const [showAgencySelector, setShowAgencySelector] = useState(false);
    const [hideAgencySelector, setHideAgencySelector] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal] = useState(false);
    const [showPHMCModal, setShowPHMCModal] = useState(false);
    const [switchableModalTitle, setSwitchableModalTitle] = useState('');
    const [switchableFormsList, setSwitchableFormsList] = useState([]);
    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
    const [showSavedReports, setShowSavedReports] = useState(false);

    // Global Image Previewer State
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [imagesPreviewList, setImagesPreviewList] = useState([]);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

    const openImagePreview = (url, list = [], index = 0) => {
        setImagePreviewUrl(url);
        setImagesPreviewList(list);
        setCurrentPreviewIndex(index);
    };

    const closeImagePreview = () => {
        setImagePreviewUrl(null);
        setImagesPreviewList([]);
        setCurrentPreviewIndex(0);
    };

    const value = {
        showEasterEggModal, setShowEasterEggModal,
        easterEggType, setEasterEggType,
        showAgencySelector, setShowAgencySelector,
        hideAgencySelector, setHideAgencySelector,
        showEmployeeModal, setShowEmployeeModal,
        showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal,
        showPHMCModal, setShowPHMCModal,
        switchableModalTitle, setSwitchableModalTitle,
        switchableFormsList, setSwitchableFormsList,
        showFeatureRequestModal, setShowFeatureRequestModal,
        showSavedReports, setShowSavedReports,


        // Global Image Previewer
        imagePreviewUrl, setImagePreviewUrl,
        imagesPreviewList, setImagesPreviewList,
        currentPreviewIndex, setCurrentPreviewIndex,
        openImagePreview, closeImagePreview,
    };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
};
