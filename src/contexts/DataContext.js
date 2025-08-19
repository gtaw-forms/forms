import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { useNotification } from './NotificationContext';

const DataContext = createContext();

export const useData = () => {
    return useContext(DataContext);
};

export const DataProvider = ({ children }) => {
    const { showNotification, removeNotification } = useNotification();
    const [phmcListData, setPhmcListData] = useState([]);
    const [coronerListData, setCoronerListData] = useState([]);
    const [agencyDataStore, setAgencyDataStore] = useState({});
    const [selectOptions, setSelectOptions] = useState({});
    const [physicianRecruitmentDetails, setPhysicianRecruitmentDetails] = useState({});
    const [psychRecruitmentDetails, setPsychRecruitmentDetails] = useState({});
    const [adminRecruitmentDetails, setAdminRecruitmentDetails] = useState({});
    const [emsRecruitmentDetails, setEmsRecruitmentDetails] = useState({});
    const [nurseRecruitmentDetails, setNurseRecruitmentDetails] = useState({});
    const [coronerRecruitmentDetails, setCoronerRecruitmentDetails] = useState({});
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        let loadingNotificationId;
        try {
            loadingNotificationId = showNotification("Data Loading...", 'spinner fa-spin', 0);

            const dbRootRef = ref(database);
            const snapshot = await get(dbRootRef);

            if (snapshot.exists()) {
                const allData = snapshot.val();
                let fetchedSelectOptions = allData.selectOptions || {};

                setPhmcListData(allData.staff?.phmc || []);
                setCoronerListData(allData.staff?.coroner || []);
                setAgencyDataStore(allData.agencies || {});
                setSelectOptions(allData.selectOptions || {});

                setSelectOptions(fetchedSelectOptions);
                setPhysicianRecruitmentDetails(fetchedSelectOptions.physicianRecruitmentDetails || {});
                setPsychRecruitmentDetails(fetchedSelectOptions.psychPositionDetailsData || {});
                setAdminRecruitmentDetails(fetchedSelectOptions.adminPositionDetailsData || {});
                setEmsRecruitmentDetails(fetchedSelectOptions.emsPositionDetailsData || {});
                setNurseRecruitmentDetails(fetchedSelectOptions.nursePositionDetailsData || {});
                setCoronerRecruitmentDetails(fetchedSelectOptions.coronerPositionDetailsData || {});

                showNotification("Data Loaded!", 'check-circle', 2000);
            } else {
                showNotification('Initial application data not found on server.', 'error');
            }
        } catch (error) {
            showNotification("An error has happened, contact the maintainer", 'error');
            console.error("Error fetching data from Realtime Database:", error);
        } finally {
            setIsLoadingData(false);
            setLoading(false);
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        }
    }, [showNotification, removeNotification]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const refreshData = async () => {
        await loadData();
    };

    const value = {
        phmcListData,
        coronerListData,
        agencyDataStore,
        selectOptions,
        physicianRecruitmentDetails,
        psychRecruitmentDetails,
        adminRecruitmentDetails,
        emsRecruitmentDetails,
        nurseRecruitmentDetails,
        coronerRecruitmentDetails,
        isLoadingData,
        loading,
        refreshData,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};