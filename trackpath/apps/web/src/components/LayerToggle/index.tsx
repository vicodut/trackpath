import { useState } from 'react';
import { TAGS, TAG_EMOJIS } from '../../lib/constants';
import styles from './LayerToggle.module.css';

export { TAGS as TAG_LIST } from '../../lib/constants';

export const HIGHLIGHT_CATEGORIES = [
  'shelter', 'summit', 'campsite', 'town', 'road-crossing', 'landmark', 'state-border', 'water-source',
] as const;

const HIGHLIGHT_EMOJIS: Record<string, string> = {
  shelter: '🛖',
  summit: '🏔️',
  campsite: '⛺',
  town: '🏘️',
  'road-crossing': '🛣️',
  landmark: '⭐',
  'state-border': '🚩',
  'water-source': '💧',
};

export interface LayerVisibility {
  garminPath: boolean;
  garminPoints: boolean;
  strava: boolean;
  atTrail: boolean;
  weather: boolean;
  tileStyle: 'osm' | 'topo';
  tags: Record<string, boolean>;
  highlights: Record<string, boolean>;
}

interface LayerToggleProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
}

const LAYER_LABELS: { key: keyof Omit<LayerVisibility, 'tags' | 'highlights' | 'tileStyle'>; label: string }[] = [
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
    <div className={styles.layerToggle} onClick={(e) => { e.stopPropagation(); }}>
      <div className={styles.layerToggleHeader} onClick={() => { setOpen(!open); }}>
        <span className={styles.layerToggleTitle}>Layers</span>
        <span className={styles.layerToggleIcon}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.layerToggleBody}>
          <div className={styles.mapStyleSection}>
            <span className={styles.mapStyleLabel}>Map style</span>
            <div className={styles.tileStyleRow}>
              {(['osm', 'topo'] as const).map((key) => (
                <button
                  key={key}
                  className={`${styles.tileStyleBtn} ${layers.tileStyle === key ? styles.tileStyleActive : ''}`}
                  onClick={() => { onChange({ ...layers, tileStyle: key }); }}
                >
                  {key === 'osm' ? 'Street' : 'Topo'}
                </button>
              ))}
            </div>
          </div>
          {LAYER_LABELS.map(({ key, label }) => (
            <label key={key} className={styles.layerToggleRow}>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => { onChange({ ...layers, [key]: !layers[key] }); }}
              />
              <span>{label}</span>
            </label>
          ))}
          <div className={styles.layerToggleGroup}>
            <div className={styles.layerToggleGroupHeader} onClick={() => { setTagsOpen(!tagsOpen); }}>
              <span>Tags</span>
              <span className={styles.layerToggleIcon}>{tagsOpen ? '▾' : '▸'}</span>
            </div>
            {tagsOpen && (
              <div className={styles.layerToggleGroupBody}>
                {TAGS.map((tag) => (
                  <label key={tag} className={styles.layerToggleRow}>
                    <input
                      type="checkbox"
                      checked={layers.tags[tag]}
                      onChange={() => { onChange({
                        ...layers,
                        tags: { ...layers.tags, [tag]: !layers.tags[tag] },
                      }); }}
                    />
                    <span>{TAG_EMOJIS[tag]} {tag}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={styles.layerToggleGroup}>
            <div className={styles.layerToggleGroupHeader} onClick={() => { setHighlightsOpen(!highlightsOpen); }}>
              <span>Highlights</span>
              <span className={styles.layerToggleIcon}>{highlightsOpen ? '▾' : '▸'}</span>
            </div>
            {highlightsOpen && (
              <div className={styles.layerToggleGroupBody}>
                {HIGHLIGHT_CATEGORIES.map((cat) => (
                  <label key={cat} className={styles.layerToggleRow}>
                    <input
                      type="checkbox"
                      checked={layers.highlights[cat]}
                      onChange={() => { onChange({
                        ...layers,
                        highlights: { ...layers.highlights, [cat]: !layers.highlights[cat] },
                      }); }}
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
