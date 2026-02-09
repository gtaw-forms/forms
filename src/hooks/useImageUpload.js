import { useState } from 'react';
import * as Sentry from "@sentry/react";

export const useImageUpload = (showNotification, setFormData) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (imageSource, fieldName) => {
        setIsUploading(true);
        let imageUrls = [];

        try {
            const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
            if (!imgbbApiKey) {
                showNotification('ImgBB API Key is not configured.', 'error');
                setIsUploading(false);
                return;
            }

            let filesToUpload = [];
            if (typeof imageSource === 'string') {
                filesToUpload.push(imageSource);
            } else if (imageSource.target && imageSource.target.files) {
                filesToUpload = Array.from(imageSource.target.files);
            } else {
                filesToUpload.push(imageSource);
            }

            for (const file of filesToUpload) {
                const formData = new FormData();
                let base64Image;

                if (typeof file === 'string') {
                    base64Image = file.split(',')[1];
                } else {
                    base64Image = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
                
                formData.append('image', base64Image);

                const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) { // Check for HTTP errors
                    const errorText = await response.text();
                    throw new Error(`ImgBB API returned status ${response.status}: ${errorText}`);
                }

                const data = await response.json();

                if (data.success) {
                    imageUrls.push({ 
                        url: data.data.url, 
                        thumb: data.data.thumb?.url || data.data.url 
                    });
                } else {
                    console.error('ImgBB upload failed:', data.error.message);
                    showNotification(`ImgBB upload failed for one of the images: ${data.error.message}`, 'exclamation-circle');
                }
            }

            if (imageUrls.length > 0) {
                showNotification(`${imageUrls.length} image(s) uploaded successfully!`, 'check-circle');

                if (fieldName) {
                    if (fieldName.includes('-')) {
                        const [key, indexStr] = fieldName.split('-');
                        const index = parseInt(indexStr, 10);

                        setFormData(prev => {
                            const newDecedents = [...prev.decedents];
                            const currentDecedent = newDecedents[index];
                            const currentValue = currentDecedent[key] || '';
                            const newValue = currentValue ? `${currentValue}, ${imageUrls.map(img => img.url).join(', ')}` : imageUrls.map(img => img.url).join(', ');
                            newDecedents[index] = { ...currentDecedent, [key]: newValue };

                            return { ...prev, decedents: newDecedents };
                        });

                    } else {
                        setFormData(prev => {
                            const currentValue = prev[fieldName] || '';
                            const newValue = currentValue ? `${currentValue}, ${imageUrls.map(img => img.url).join(', ')}` : imageUrls.map(img => img.url).join(', ');
                            return {
                                ...prev,
                                [fieldName]: newValue
                            };
                        });
                    }
                }
            }

        } catch (error) {
            console.error('Upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'handleImageUpload' } });
            showNotification('Upload failed!', 'exclamation-circle');
        } finally {
            setIsUploading(false);
        }
        return imageUrls;
    };

    return { isUploading, handleImageUpload };
};
