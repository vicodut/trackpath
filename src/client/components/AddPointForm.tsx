import { useState } from 'react';

interface AddPointFormProps {
  onSubmit: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null }) => Promise<boolean>;
  onPickFromMap: () => void;
  pickingFromMap: boolean;
  pickedCoords: { lat: number; lng: number } | null;
}

export function AddPointForm({ onSubmit, onPickFromMap, pickingFromMap, pickedCoords }: AddPointFormProps) {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [alt, setAlt] = useState('');
  const [msg, setMsg] = useState('');

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
    });

    if (ok) {
      setLat('');
      setLng('');
      setAlt('');
      setMsg('');
    }
  }

  return (
    <div className="add-form">
      <button className="add-form-toggle" onClick={() => setOpen(!open)}>
        + Add a tracking point
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
          <label>Message (optional)</label>
          <textarea
            placeholder="e.g. Camp for the night near shelter"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <p className={`pick-hint ${pickingFromMap ? 'active' : ''}`}>
            {pickingFromMap ? 'Click anywhere on the map...' : 'Click on the map to pick coordinates'}
          </p>
          <div className="add-form-actions">
            <button onClick={onPickFromMap}>Pick on map</button>
            <button className="primary" onClick={handleSubmit}>Add point</button>
          </div>
        </div>
      )}
    </div>
  );
}
