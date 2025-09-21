import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { database } from '../firebase';
import { ref, get, child } from 'firebase/database';
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
            loadingNotificationId = showNotification("Application loading...", 'spinner fa-spin', 0);

            const dbRootRef = ref(database);
            const staffRef = child(dbRootRef, 'staff');
            const staffSnapshot = await get(staffRef);

            if (staffSnapshot.exists()) {
                const staffData = staffSnapshot.val();
                setPhmcListData(staffData?.phmc || []);
                setCoronerListData(staffData?.coroner || []);
                showNotification("Application loaded!", 'check-circle', 2000);
            } else {
                showNotification('Application failure! Contact System Administrator.', 'error');
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

    const loadSelectOptions = useCallback(async () => {
        let loadingNotificationId;
        try {
            loadingNotificationId = showNotification("Loading form options...", 'spinner fa-spin', 0);
            const selectOptionsRef = ref(database, 'selectOptions');
            const snapshot = await get(selectOptionsRef);

            if (snapshot.exists()) {
                const fetchedSelectOptions = snapshot.val();
                setSelectOptions(fetchedSelectOptions || {});
                setPhysicianRecruitmentDetails(fetchedSelectOptions.physicianRecruitmentDetails || {});
                setPsychRecruitmentDetails(fetchedSelectOptions.psychPositionDetailsData || {});
                setAdminRecruitmentDetails(fetchedSelectOptions.adminPositionDetailsData || {});
                setEmsRecruitmentDetails(fetchedSelectOptions.emsPositionDetailsData || {});
                setNurseRecruitmentDetails(fetchedSelectOptions.nursePositionDetailsData || {});
                setCoronerRecruitmentDetails(fetchedSelectOptions.coronerPositionDetailsData || {});
                showNotification("Form options loaded!", 'check-circle', 2000);
            } else {
                showNotification('Form options not found on server.', 'error');
            }
        } catch (error) {
            showNotification("An error occurred loading form options.", 'error');
            console.error("Error fetching selectOptions:", error);
        } finally {
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        }
    }, [showNotification, removeNotification]);

    const loadAgencyData = useCallback(async () => {
        let loadingNotificationId;
        try {
            loadingNotificationId = showNotification("Loading agency data...", 'spinner fa-spin', 0);
            const agencyRef = ref(database, 'agencies');
            const snapshot = await get(agencyRef);

            if (snapshot.exists()) {
                setAgencyDataStore(snapshot.val() || {});
                showNotification("Agency data loaded!", 'check-circle', 2000);
            } else {
                showNotification('Agency data not found on server.', 'error');
            }
        } catch (error) {
            showNotification("An error occurred loading agency data.", 'error');
            console.error("Error fetching agency data:", error);
        } finally {
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        }
    }, [showNotification, removeNotification]);

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
        loadSelectOptions,
        loadAgencyData,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};