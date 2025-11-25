import { createContext, useContext, useCallback } from 'react';

const FormContext = createContext();

export const useFormContext = () => useContext(FormContext);

export const FormProvider = ({ formData, setFormData, initialFormData, setLastWebhookIdentifier, showNotification, children }) => {
    // Move clearForm logic here
    const clearForm = useCallback(() => {
        setFormData(prevFormData => ({
            ...initialFormData,
            coronerEmployee: prevFormData.coronerEmployee,
            phmcEmployee: prevFormData.phmcEmployee,
            coronerBadge: prevFormData.coronerBadge,
            coronerRank: prevFormData.coronerRank,
            coronerDiscord: prevFormData.coronerDiscord,
            SubmitDate: new Date().toISOString().split('T')[0],
        }));
        const fieldsToRemove = [
            'dateTime', 'department', 'pronouncedTimeOfDeath', 'placeOfDeath', 'mannerOfDeath'
        ];
        fieldsToRemove.forEach(field => {
            localStorage.removeItem(field);
            localStorage.removeItem(`${field}_timestamp`);
        });
        setLastWebhookIdentifier(null);
        if (showNotification) showNotification('Form cleared! Employee selections preserved.', 'check-circle');
    }, [initialFormData, setFormData, setLastWebhookIdentifier, showNotification]);

    return (
        <FormContext.Provider value={{ formData, setFormData, clearForm }}>
            {children}
        </FormContext.Provider>
    );
};
