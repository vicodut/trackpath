import styles from './ResourcesPage.module.css';

interface ResourcesPageProps {
  trailProgressKm: number | null;
  onClose: () => void;
}

const KM_TO_MILE = 0.621371;

const RESOURCES = [
  {
    id: 'atforecast',
    title: 'AT Forecast',
    desc: 'Weather forecasts specifically for Appalachian Trail shelters. Get the current forecast for the shelter nearest to Maurice\'s position.',
    url: 'https://www.atforecast.app/',
  },
  {
    id: 'wherearethehikers',
    title: 'Where Are The Hikers',
    desc: 'Track thru-hikers progress on the AT. See where the hiker bubble is and how Maurice compares to other NOBOs.',
    url: 'https://www.wherearethehikers.com/',
  },
  {
    id: 'thetrek',
    title: 'The Trek',
    desc: 'The go-to community for thru-hikers. Trail journals, gear reviews, news and stories from the AT.',
    url: 'https://thetrek.co/',
  },
  {
    id: 'ata',
    title: 'Appalachian Trail Conservancy',
    desc: 'Official site of the ATC — trail conditions, permits, leave no trace guidelines and everything official.',
    url: 'https://appalachiantrail.org/',
  },
  {
    id: 'hostels',
    title: 'AT Hostels Listing',
    desc: 'Complete listing of hostels along the Appalachian Trail — town services, prices, shuttles.',
    url: 'https://thetrek.co/appalachian-trail/appalachian-trail-hostels-listing/',
  },
] as const;

export function ResourcesPage({ trailProgressKm, onClose }: ResourcesPageProps) {
  const miles = trailProgressKm != null ? Math.round(trailProgressKm * KM_TO_MILE) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Resources</h2>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className={styles.content}>
        {RESOURCES.map(r => (
          <div key={r.id} className={styles.card}>
            <span className={styles.cardTitle}>{r.title}</span>
            <p className={styles.cardDesc}>{r.desc}</p>
            {r.id === 'atforecast' && miles == null && (
              <span className={styles.noMile}>No position yet — trip hasn't started</span>
            )}
            <div className={styles.cardActions}>
              {r.id === 'atforecast' && miles != null && (
                <a
                  className={styles.btnPrimary}
                  href={`${r.url}nearest_shelter?nobo_mile=${miles}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ⛅ My location ({miles} mi)
                </a>
              )}
              <a
                className={r.id === 'atforecast' && miles != null ? styles.btnGhost : styles.btnPrimary}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
