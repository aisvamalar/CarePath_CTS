/**
 * QuickSight Dashboard Embedding Component
 * Fetches signed embed URL from backend and displays QuickSight dashboard
 */

import { useEffect, useState, useRef } from 'react';
import apiClient from '../services/apiClient';

interface QuickSightDashboardProps {
  height?: string;
  className?: string;
}

interface EmbedUrlResponse {
  embed_url: string;
  dashboard_id: string;
}

export default function QuickSightDashboard({ 
  height = '800px',
  className = '' 
}: QuickSightDashboardProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const fetchEmbedUrl = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiClient.get<EmbedUrlResponse>(
          '/api/v1/quicksight/embed-url'
        );
        
        setEmbedUrl(response.data.embed_url);
      } catch (err: any) {
        console.error('Failed to fetch QuickSight embed URL:', err);
        
        if (err.response?.status === 500 && err.response?.data?.detail?.includes('not configured')) {
          setError('QuickSight dashboard is not configured yet. Please contact your administrator.');
        } else if (err.response?.status === 404) {
          setError('Dashboard not found. Please verify the dashboard configuration.');
        } else {
          setError(err.response?.data?.detail || 'Failed to load analytics dashboard. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmbedUrl();
  }, []);

  if (loading) {
    return (
      <div className={`quicksight-container ${className}`} style={{ height }}>
        <div className="quicksight-loading">
          <div className="quicksight-spinner" />
          <p>Loading analytics dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`quicksight-container ${className}`} style={{ height }}>
        <div className="quicksight-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Unable to load dashboard</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className={`quicksight-container ${className}`} style={{ height }}>
        <div className="quicksight-error">
          <p>No dashboard URL available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`quicksight-container ${className}`} style={{ height, position: 'relative' }}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
        }}
        title="QuickSight Analytics Dashboard"
        allow="fullscreen"
      />
    </div>
  );
}
