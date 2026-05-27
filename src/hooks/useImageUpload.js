import { useState } from 'react';
import * as Sentry from "@sentry/react";
import { uploadImageToImgBB, uploadDataUrlToImgBB } from '../utils/imageUploadUtils';

export const useImageUpload = (showNotification, setFormData) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (imageSource, fieldName) => {
        setIsUploading(true);
        let imageUrls = [];

        try {
            let filesToUpload = [];
            if (!imageSource) {
                setIsUploading(false);
                return [];
            }
            if (typeof imageSource === 'string') {
                filesToUpload.push(imageSource);
            } else if (imageSource && typeof imageSource === 'object' && imageSource.target && imageSource.target.files) {
                filesToUpload = Array.from(imageSource.target.files);
            } else {
                filesToUpload.push(imageSource);
            }

            for (const file of filesToUpload) {
                const result = typeof file === 'string'
                    ? await uploadDataUrlToImgBB(file)
                    : await uploadImageToImgBB(file);

                imageUrls.push(result);
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
