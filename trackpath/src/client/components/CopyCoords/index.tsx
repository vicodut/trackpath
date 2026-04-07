import { useState } from 'react';

export function CopyCoords({ lat, lon }: { lat: number; lon: number }) {
  const [copied, setCopied] = useState(false);
  const text = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <span
      onClick={copy}
      title="Click to copy"
      style={{
        display: 'inline-block',
        marginTop: 4,
        fontSize: '0.95em',
        color: copied ? '#52a852' : '#666',
        cursor: 'pointer',
        userSelect: 'none',
        borderBottom: '1px dashed currentColor',
      }}
    >
      {copied ? '✓ copied' : text}
    </span>
  );
}
