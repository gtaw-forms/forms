import { useState, useEffect, useCallback } from 'react';

const GITHUB_API_URL = 'https://api.github.com/repos/GTAW-PHMC/forms/commits/source';
const CACHE_KEY = 'githubCommitInfo';
const CACHE_TTL = 15 * 60 * 1000;
const POLL_INTERVAL = 5 * 60 * 1000;

let currentSha = null;
try { currentSha = __GIT_SHA__; } catch (e) { /* not available */ }

export const useUpdateAvailable = () => {
  const [latestSha, setLatestSha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLatestSha = useCallback(async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { sha, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setLatestSha(sha);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(GITHUB_API_URL);
      if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
      const data = await response.json();
      const sha = data.sha.substring(0, 7);

      localStorage.setItem(CACHE_KEY, JSON.stringify({ sha, timestamp: Date.now() }));
      setLatestSha(sha);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLatestSha();
    const interval = setInterval(fetchLatestSha, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLatestSha]);

  const updateAvailable = !!(currentSha && latestSha && currentSha !== latestSha && currentSha !== 'unknown');

  return {
    updateAvailable,
    currentSha,
    latestSha,
    loading,
    error,
    refresh: fetchLatestSha,
  };
};
