import { useEffect, useState } from 'react';
import styles from './Blog.module.css';

const GHOST_URL = 'https://ghost-production-1882.up.railway.app';
const GHOST_KEY = '0d6476834a0eeaa76e910081c9';

interface Post {
  id: string;
  title: string;
  slug: string;
  feature_image: string | null;
  excerpt: string;
  published_at: string;
  reading_time: number;
}

interface BlogListProps {
  onSelectPost: (slug: string) => void;
  onClose: () => void;
}

export function BlogList({ onSelectPost, onClose }: BlogListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${GHOST_URL}/ghost/api/content/posts/?key=${GHOST_KEY}&fields=id,title,slug,feature_image,excerpt,published_at,reading_time&order=published_at%20desc`)
      .then(r => r.json())
      .then((data: { posts: Post[] }) => {
        setPosts(data.posts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={styles.blogPage}>
      <div className={styles.blogHeader}>
        <h2>TRAIL_JOURNAL</h2>
        <button onClick={onClose}>CLOSE</button>
      </div>
      <div className={styles.blogContent}>
        {loading && <div className={styles.blogLoading}>Loading...</div>}
        {!loading && posts.length === 0 && (
          <div className={styles.blogEmpty}>No posts yet.</div>
        )}
        {posts.map(post => (
          <article
            key={post.id}
            className={styles.blogCard}
            onClick={() => onSelectPost(post.slug)}
          >
            {post.feature_image && (
              <img
                className={styles.blogCardImage}
                src={post.feature_image}
                alt={post.title}
              />
            )}
            <div className={styles.blogCardBody}>
              <h3 className={styles.blogCardTitle}>{post.title}</h3>
              <p className={styles.blogCardExcerpt}>{post.excerpt}</p>
              <div className={styles.blogCardMeta}>
                <span>{new Date(post.published_at).toLocaleDateString()}</span>
                {post.reading_time > 0 && <span>{post.reading_time} min read</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
