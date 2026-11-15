import React from 'react';

interface LiveRegionProps {
  message?: string;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({ message }) => {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
};
