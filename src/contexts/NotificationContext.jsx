import React, { createContext, useState, useRef, useCallback, useContext, useEffect } from 'react';
import Notification from '../components/UI/Notification';

const DEFAULT_NOTIFICATION_DURATION = 5000; 

const getIconClass = (icon) => {
    if (icon.startsWith('fa-')) {
        return `fas ${icon}`;
    }
    switch (icon) {
        case 'check-circle':
            return 'fas fa-check-circle';
        case 'exclamation-circle':
            return 'fas fa-exclamation-circle';
        case 'info-circle':
            return 'fas fa-info-circle';
        case 'spinner fa-spin':
            return 'fas fa-spinner fa-spin';
        case 'save':
            return 'fas fa-save';
        case 'upload':
            return 'fas fa-upload';
        case 'plus-circle':
            return 'fas fa-plus-circle';
        case 'exclamation-triangle':
            return 'fas fa-exclamation-triangle';
        case 'warning':
            return 'fas fa-exclamation-triangle';
        default:
            return 'fas fa-info-circle';
    }
};

const getNotificationType = (icon) => {
    switch (icon) {
        case 'check-circle':
        case 'success':
            return 'success';
        case 'exclamation-circle':
        case 'error':
            return 'danger';
        case 'warning':
        case 'exclamation-triangle':
            return 'warning';
        case 'info-circle':
        case 'info':
            return 'info';
        case 'spinner fa-spin':
            return 'primary';
        default:
            return 'info';
    }
};

const NotificationContext = createContext();

export const useNotification = () => {
    return useContext(NotificationContext);
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const loadingNotificationIdRef = useRef(null);
    const resultNotificationIdRef = useRef(null);

    const removeNotification = useCallback((idToRemove) => {
        setNotifications(prevNotifications =>
            prevNotifications.filter(notif => notif.id !== idToRemove)
        );
        if (loadingNotificationIdRef.current === idToRemove) {
            loadingNotificationIdRef.current = null;
        }
        if (resultNotificationIdRef.current === idToRemove) {
            resultNotificationIdRef.current = null;
        }
    }, []);

    const showNotification = useCallback((message, icon = 'check-circle', duration = DEFAULT_NOTIFICATION_DURATION, options = {}) => {
        const { key, actions = [] } = options;
        const newNotificationId = key || Date.now() + Math.random();

        const newNotification = {
            id: newNotificationId,
            message: message,
            icon: getIconClass(icon),
            type: getNotificationType(icon),
            actions: actions,
        };

        setNotifications(prevNotifications => {
            const existingNotificationIndex = key ? prevNotifications.findIndex(n => n.id === key) : -1;
            
            let updatedNotifications;

            if (existingNotificationIndex !== -1) {
                // Update existing notification
                updatedNotifications = [...prevNotifications];
                const existingNotification = updatedNotifications[existingNotificationIndex];
                
                // Clear the old dismiss timer
                if (existingNotification.dismissTimer) {
                    clearTimeout(existingNotification.dismissTimer);
                }
                
                updatedNotifications[existingNotificationIndex] = {
                    ...existingNotification,
                    ...newNotification,
                };
            } else {
                updatedNotifications = [...prevNotifications, newNotification];
            }

            const currentNotification = key ? updatedNotifications.find(n => n.id === key) : newNotification;

            if (currentNotification && duration > 0) {
                const timerId = setTimeout(() => {
                    removeNotification(newNotificationId);
                }, duration);
                // Store timer to clear it if updated
                currentNotification.dismissTimer = timerId;
            }

            return updatedNotifications;
        });

        return newNotificationId;
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification, removeNotification }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1060,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none',
            }}>
                {notifications.map(notification => (
                    <Notification
                        key={notification.id}
                        message={notification.message}
                        icon={notification.icon}
                        type={notification.type}
                        onDismiss={() => removeNotification(notification.id)}
                        actions={notification.actions.map(action => ({
                            ...action,
                            handler: () => action.handler(notification.id)
                        }))}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};