import { useEffect, useState } from 'react';
import styles from './Blog.module.css';

const GHOST_URL = 'https://ghost-production-1882.up.railway.app';
const GHOST_KEY = '0d6476834a0eeaa76e910081c9';

interface Post {
  title: string;
  html: string;
  feature_image: string | null;
  published_at: string;
  reading_time: number;
}

interface BlogPostProps {
  slug: string;
  onBack: () => void;
  onClose: () => void;
}

export function BlogPost({ slug, onBack, onClose }: BlogPostProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${GHOST_URL}/ghost/api/content/posts/slug/${slug}/?key=${GHOST_KEY}&formats=html`)
      .then(r => r.json())
      .then((data: { posts: Post[] }) => {
        setPost(data.posts[0] ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  return (
    <div className={styles.blogPage}>
      <div className={styles.blogHeader}>
        <div className={styles.blogNav}>
          <button onClick={onBack}>BACK</button>
          <h2>TRAIL_JOURNAL</h2>
        </div>
        <button onClick={onClose}>CLOSE</button>
      </div>
      <div className={styles.blogContent}>
        {loading && <div className={styles.blogLoading}>Loading...</div>}
        {!loading && !post && <div className={styles.blogEmpty}>Post not found.</div>}
        {post && (
          <article className={styles.blogArticle}>
            {post.feature_image && (
              <img
                className={styles.blogArticleImage}
                src={post.feature_image}
                alt={post.title}
              />
            )}
            <h1 className={styles.blogArticleTitle}>{post.title}</h1>
            <div className={styles.blogArticleMeta}>
              <span>{new Date(post.published_at).toLocaleDateString()}</span>
              {post.reading_time > 0 && <span>{post.reading_time} min read</span>}
            </div>
            <div
              className={styles.blogArticleBody}
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          </article>
        )}
      </div>
    </div>
  );
}
