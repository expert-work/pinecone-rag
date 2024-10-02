'use client';

import React, { useState } from 'react';

export function DumpJobsButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleDumpJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dumpjobs', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to dump jobs');
      }
      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error('Error dumping jobs:', error);
      alert('Failed to dump jobs. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleDumpJobs} disabled={isLoading}>
      {isLoading ? 'Dumping...' : 'Dump Jobs to Pinecone'}
    </button>
  );
}