import { useState, useEffect } from 'react';

const TAGS = ['resupply', 'poop', 'hostel', 'camp', 'shelter', 'water', 'viewpoint'] as const;

interface AddPointFormProps {
  onSubmit: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => Promise<boolean>;
  onFormToggle: (open: boolean) => void;
  pickedCoords: { lat: number; lng: number } | null;
  forceOpen?: boolean;
}

export function AddPointForm({ onSubmit, onFormToggle, pickedCoords, forceOpen }: AddPointFormProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen && !open) {
      setOpen(true);
      onFormToggle(true);
    }
  }, [forceOpen]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    onFormToggle(next);
  };
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [alt, setAlt] = useState('');
  const [msg, setMsg] = useState('');
  const [tag, setTag] = useState('');

  // Sync picked coords into form
  if (pickedCoords && lat !== pickedCoords.lat.toFixed(6)) {
    setLat(pickedCoords.lat.toFixed(6));
    setLng(pickedCoords.lng.toFixed(6));
  }

  async function handleSubmit() {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return;

    const ok = await onSubmit({
      latitude,
      longitude,
      altitude: alt ? parseFloat(alt) : null,
      message: msg.trim() || null,
      tag: tag || null,
    });

    if (ok) {
      setLat('');
      setLng('');
      setAlt('');
      setMsg('');
      setTag('');
    }
  }

  return (
    <div className="add-form">
      <button className="add-form-toggle" onClick={toggleOpen}>
        + ADD_TRACKING_POINT
      </button>
      {open && (
        <div className="add-form-fields open">
          <div className="coord-row">
            <div>
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 34.627"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div>
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. -84.194"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
          <label>Altitude (m, optional)</label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 1152"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
          <label>Tag</label>
          <select className="tag-select" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">-- none --</option>
            {TAGS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label>Message (optional)</label>
          <textarea
            placeholder="e.g. Camp for the night near shelter"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <p className="pick-hint active">TAP_MAP_TO_SET_COORDINATES</p>
          <div className="add-form-actions">
            <button className="primary" onClick={handleSubmit}>SUBMIT_POINT</button>
          </div>
        </div>
      )}
    </div>
  );
}
