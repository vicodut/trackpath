import { useState } from 'react';

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

export interface LayerVisibility {
  garminPath: boolean;
  garminPoints: boolean;
  strava: boolean;
  atTrail: boolean;
  weather: boolean;
  tags: Record<string, boolean>;
}

interface LayerToggleProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
}

const LAYER_LABELS: { key: keyof Omit<LayerVisibility, 'tags'>; label: string }[] = [
  { key: 'atTrail', label: 'AT Trail' },
  { key: 'garminPath', label: 'Garmin path' },
  { key: 'garminPoints', label: 'Garmin points' },
  { key: 'strava', label: 'Strava activities' },
  { key: 'weather', label: 'Weather' },
];

export function LayerToggle({ layers, onChange }: LayerToggleProps) {
  const [open, setOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  return (
    <div className="layer-toggle" onClick={(e) => e.stopPropagation()}>
      <div className="layer-toggle-header" onClick={() => setOpen(!open)}>
        <span className="layer-toggle-title">Layers</span>
        <span className="layer-toggle-icon">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="layer-toggle-body">
          {LAYER_LABELS.map(({ key, label }) => (
            <label key={key} className="layer-toggle-row">
              <input
                type="checkbox"
                checked={layers[key] as boolean}
                onChange={() => onChange({ ...layers, [key]: !layers[key] })}
              />
              <span>{label}</span>
            </label>
          ))}
          <div className="layer-toggle-group">
            <div className="layer-toggle-group-header" onClick={() => setTagsOpen(!tagsOpen)}>
              <span>Tags</span>
              <span className="layer-toggle-icon">{tagsOpen ? '▾' : '▸'}</span>
            </div>
            {tagsOpen && (
              <div className="layer-toggle-group-body">
                {TAG_LIST.map((tag) => (
                  <label key={tag} className="layer-toggle-row">
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
        </div>
      )}
    </div>
  );
}
