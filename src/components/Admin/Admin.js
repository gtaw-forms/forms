import React, { useState, useEffect } from 'react';
import AdminAuthAndActions from './AdminAuthAndActions';
import { useNotification } from '../../contexts/NotificationContext';

const Admin = ({ formData, setFormData, showNotification }) => {
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null, error: null });

    useEffect(() => {
        const GITHUB_COMMIT_CACHE_KEY = 'githubCommitInfo';
        const GITHUB_COMMIT_CACHE_EXPIRATION_MS = 15 * 60 * 1000; // Cache for 15 minutes

        const fetchCommit = () => {
            // 1. Try to load from cache first
            try {
                const cachedCommitDataString = localStorage.getItem(GITHUB_COMMIT_CACHE_KEY);
                if (cachedCommitDataString) {
                    const cachedData = JSON.parse(cachedCommitDataString);
                    const isCacheFresh = (Date.now() - cachedData.timestamp) < GITHUB_COMMIT_CACHE_EXPIRATION_MS;
                    if (isCacheFresh) {
                        setCommitInfo(cachedData.info);
                        return; // Exit if fresh data is found in cache
                    }
                }
            } catch (e) {
                console.error("Error reading commit info from cache:", e);
            }

            // 2. If cache is stale or doesn't exist, fetch from API
            fetch('https://api.github.com/repos/GTAW-PHMC/forms/commits/gh-pages')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`GitHub API responded with status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const commitDate = new Date(data.commit.author.date);
                    const newCommitInfo = {
                        sha: data.sha.substring(0, 7),
                        date: commitDate.toLocaleString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
                        }),
                        error: null // Clear any previous error on success
                    };
                    setCommitInfo(newCommitInfo);

                    // 3. Cache the new data
                    try {
                        localStorage.setItem(GITHUB_COMMIT_CACHE_KEY, JSON.stringify({
                            timestamp: Date.now(),
                            info: newCommitInfo
                        }));
                    } catch (e) {
                        console.error("Error writing commit info to cache:", e);
                    }
                })
                .catch(error => {
                    console.error('Error fetching commit:', error);
                    // 4. On failure, set an error message but keep old data if it exists
                    setCommitInfo(prev => ({
                        ...prev,
                        error: 'Could not fetch latest update information.'
                    }));
                });
        };

        fetchCommit();
    }, []); // This effect runs once on mount

    return (
        <div>
            <AdminAuthAndActions 
                formData={formData} 
                setFormData={setFormData} 
                showNotification={showNotification} 
                commitInfo={commitInfo} 
            />
        </div>
    );
};

export default Admin;
