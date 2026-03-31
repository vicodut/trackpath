import { useState } from 'react';
import styles from './LayerToggle.module.css';

export const TAG_LIST = ['resupply', 'poop', 'hostel', 'camp', 'shelter', 'water', 'viewpoint'] as const;

const TAG_EMOJIS: Record<string, string> = {
  resupply: '🛒',
  poop: '💩',
  hostel: '🏠',
  camp: '⛺',
  shelter: '🛖',
  water: '💧',
  viewpoint: '👀',
};

export const HIGHLIGHT_CATEGORIES = [
  'shelter', 'summit', 'campsite', 'town', 'road-crossing', 'landmark', 'state-border',
] as const;

const HIGHLIGHT_EMOJIS: Record<string, string> = {
  shelter: '🛖',
  summit: '🏔️',
  campsite: '⛺',
  town: '🏘️',
  'road-crossing': '🛣️',
  landmark: '⭐',
  'state-border': '🚩',
};

export interface LayerVisibility {
  garminPath: boolean;
  garminPoints: boolean;
  strava: boolean;
  atTrail: boolean;
  weather: boolean;
  tags: Record<string, boolean>;
  highlights: Record<string, boolean>;
}

interface LayerToggleProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
}

const LAYER_LABELS: { key: keyof Omit<LayerVisibility, 'tags' | 'highlights'>; label: string }[] = [
  { key: 'atTrail', label: 'AT Trail' },
  { key: 'garminPath', label: 'Garmin path' },
  { key: 'garminPoints', label: 'Garmin points' },
  { key: 'strava', label: 'Strava activities' },
  { key: 'weather', label: 'Weather' },
];

export function LayerToggle({ layers, onChange }: LayerToggleProps) {
  const [open, setOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);

  return (
    <div className={styles.layerToggle} onClick={(e) => e.stopPropagation()}>
      <div className={styles.layerToggleHeader} onClick={() => setOpen(!open)}>
        <span className={styles.layerToggleTitle}>Layers</span>
        <span className={styles.layerToggleIcon}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.layerToggleBody}>
          {LAYER_LABELS.map(({ key, label }) => (
            <label key={key} className={styles.layerToggleRow}>
              <input
                type="checkbox"
                checked={layers[key] as boolean}
                onChange={() => onChange({ ...layers, [key]: !layers[key] })}
              />
              <span>{label}</span>
            </label>
          ))}
          <div className={styles.layerToggleGroup}>
            <div className={styles.layerToggleGroupHeader} onClick={() => setTagsOpen(!tagsOpen)}>
              <span>Tags</span>
              <span className={styles.layerToggleIcon}>{tagsOpen ? '▾' : '▸'}</span>
            </div>
            {tagsOpen && (
              <div className={styles.layerToggleGroupBody}>
                {TAG_LIST.map((tag) => (
                  <label key={tag} className={styles.layerToggleRow}>
                    <input
                      type="checkbox"
                      checked={layers.tags[tag] !== false}
                      onChange={() => onChange({
                        ...layers,
                        tags: { ...layers.tags, [tag]: !layers.tags[tag] },
                      })}
                    />
                    <span>{TAG_EMOJIS[tag]} {tag}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={styles.layerToggleGroup}>
            <div className={styles.layerToggleGroupHeader} onClick={() => setHighlightsOpen(!highlightsOpen)}>
              <span>Highlights</span>
              <span className={styles.layerToggleIcon}>{highlightsOpen ? '▾' : '▸'}</span>
            </div>
            {highlightsOpen && (
              <div className={styles.layerToggleGroupBody}>
                {HIGHLIGHT_CATEGORIES.map((cat) => (
                  <label key={cat} className={styles.layerToggleRow}>
                    <input
                      type="checkbox"
                      checked={layers.highlights[cat] !== false}
                      onChange={() => onChange({
                        ...layers,
                        highlights: { ...layers.highlights, [cat]: !layers.highlights[cat] },
                      })}
                    />
                    <span>{HIGHLIGHT_EMOJIS[cat]} {cat}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
