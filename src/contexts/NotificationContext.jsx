import React, { createContext, useState, useRef, useCallback, useContext } from 'react';
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

import { ToastContainer } from 'react-bootstrap';

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

    const showNotification = useCallback((message, icon = 'check-circle', duration = DEFAULT_NOTIFICATION_DURATION, actions = []) => {
        const newNotificationId = Date.now() + Math.random();
        const isInteractive = actions && actions.length > 0;
        const isPersistentLoading = duration === 0 && !isInteractive;

        const newNotification = {
            id: newNotificationId,
            message: message,
            icon: getIconClass(icon),
            type: getNotificationType(icon),
            actions: actions,
        };

        setNotifications(prevNotifications => {
            let updatedNotifications = [...prevNotifications];

            if (isPersistentLoading) {
                if (loadingNotificationIdRef.current) {
                    updatedNotifications = updatedNotifications.filter(n => n.id !== loadingNotificationIdRef.current);
                }
                loadingNotificationIdRef.current = newNotificationId;
            } 
            // Removed aggressive filtering of 'result' notifications to allow stacking
            
            updatedNotifications.push(newNotification);

            if (!isInteractive && !isPersistentLoading && duration > 0) {
                setTimeout(() => {
                    removeNotification(newNotificationId);
                }, duration);
            }

            return updatedNotifications;
        });
        return newNotificationId;
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification, removeNotification }}>
            {children}
            <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1060, position: 'fixed' }}>
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
            </ToastContainer>
        </NotificationContext.Provider>
    );
};