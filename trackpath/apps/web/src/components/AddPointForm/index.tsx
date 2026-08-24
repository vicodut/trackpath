import { useState, useEffect } from 'react';
import { TAGS, TAG_EMOJIS } from '../../lib/constants';
import { useIsMobile } from '../../hooks/useIsMobile';
import styles from './AddPointForm.module.css';

interface AddPointFormProps {
  onSubmit: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => Promise<boolean>;
  onFormToggle: (open: boolean) => void;
  onSuccess?: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  forceOpen?: boolean;
}

export function AddPointForm({ onSubmit, onFormToggle, onSuccess, pickedCoords, forceOpen }: AddPointFormProps) {
  const isMobile = useIsMobile();
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
  useEffect(() => {
    if (pickedCoords) {
      setLat(pickedCoords.lat.toFixed(6));
      setLng(pickedCoords.lng.toFixed(6));
    }
  }, [pickedCoords?.lat, pickedCoords?.lng]);

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
      setOpen(false);
      onFormToggle(false);
      onSuccess?.();
    }
  }

  const mobileFields = (
    <>
      {lat && lng ? (
        <div className={styles.addFormCoordsLabel}>
          📍 {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
        </div>
      ) : (
        <p className={`${styles.pickHint} ${styles.pickHintActive}`}>TAP_MAP_TO_SET_COORDINATES</p>
      )}
      <div className={styles.addFormTagGrid}>
        {TAGS.map((t) => (
          <button
            key={t}
            className={`${styles.addFormTagBtn} ${tag === t ? styles.addFormTagBtnActive : ''}`}
            onClick={() => { setTag(tag === t ? '' : t); }}
          >
            <span className={styles.addFormTagEmoji}>{TAG_EMOJIS[t]}</span>
            <span className={styles.addFormTagLabel}>{t}</span>
          </button>
        ))}
      </div>
      <textarea
        placeholder="Message (optional)"
        value={msg}
        onChange={(e) => { setMsg(e.target.value); }}
        rows={3}
      />
      <div className={styles.addFormActions}>
        <button className="primary" onClick={handleSubmit} disabled={!lat || !lng}>SUBMIT_POINT</button>
      </div>
    </>
  );

  if (isMobile && open) {
    return (
      <>
        <div className={styles.addForm}>
          <button className={styles.addFormToggle} onClick={toggleOpen}>
            + ADD_TRACKING_POINT
          </button>
        </div>
        <div className={styles.mobileModal}>
          <div className={styles.mobileModalHeader}>
            <span className={styles.mobileModalTitle}>+ ADD_TRACKING_POINT</span>
            <button className={styles.mobileModalClose} onClick={toggleOpen}>✕</button>
          </div>
          <div className={styles.mobileModalBody}>
            {mobileFields}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={styles.addForm}>
      <button className={styles.addFormToggle} onClick={toggleOpen}>
        + ADD_TRACKING_POINT
      </button>
      {open && (
        <div className={styles.addFormFields}>
          <div className={styles.coordRow}>
                <div>
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 34.627"
                    value={lat}
                    onChange={(e) => { setLat(e.target.value); }}
                  />
                </div>
                <div>
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. -84.194"
                    value={lng}
                    onChange={(e) => { setLng(e.target.value); }}
                  />
                </div>
              </div>
              <label>Altitude (m, optional)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 1152"
                value={alt}
                onChange={(e) => { setAlt(e.target.value); }}
              />
              <label>Tag</label>
              <select className="tag-select" value={tag} onChange={(e) => { setTag(e.target.value); }}>
                <option value="">-- none --</option>
                {TAGS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label>Message (optional)</label>
              <textarea
                placeholder="e.g. Camp for the night near shelter"
                value={msg}
                onChange={(e) => { setMsg(e.target.value); }}
              />
              <p className={`${styles.pickHint} ${styles.pickHintActive}`}>TAP_MAP_TO_SET_COORDINATES</p>
              <div className={styles.addFormActions}>
                <button className="primary" onClick={handleSubmit}>SUBMIT_POINT</button>
              </div>
        </div>
      )}
    </div>
  );
}

