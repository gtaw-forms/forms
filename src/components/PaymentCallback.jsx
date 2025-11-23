import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const PaymentCallback = () => {
    const { token } = useParams();
    const [message, setMessage] = useState('Processing your payment confirmation...');

    useEffect(() => {
        const processPayment = () => {
            if (!token) {
                setMessage('Error: No payment token found. This page should only be accessed via the bank redirect.');
                return;
            }

            // 1. Retrieve the pending payment info from localStorage
            const pendingPaymentJSON = localStorage.getItem('phmc-payment-pending');
            if (!pendingPaymentJSON) {
                setMessage('Error: No pending payment information found in this browser session. If you believe you have completed a payment, please return to the form and try again.');
                return;
            }

            const pendingPayment = JSON.parse(pendingPaymentJSON);
            const { formName, userId, fieldId } = pendingPayment;

            // 2. Set the confirmation in localStorage for the original tab to pick up
            const confirmationData = {
                fieldId: fieldId,
                confirmedAt: new Date().toISOString(),
                status: 'confirmed'
            };
            localStorage.setItem('phmc-payment-confirmed', JSON.stringify(confirmationData));

            // 3. Clean up the pending marker
            localStorage.removeItem('phmc-payment-pending');
            
            setMessage('Payment successful! Your record has been updated. You can now safely close this window.');
        };

        processPayment();

    }, [token]);

    return (
        <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center', backgroundColor: '#f0f2f5', height: '100vh' }}>
            <div style={{ maxWidth: '600px', margin: 'auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                <h2>Payment Confirmation</h2>
                <p style={{ fontSize: '18px', color: '#555' }}>{message}</p>
            </div>
        </div>
    );
};

export default PaymentCallback;
