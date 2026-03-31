import { useState } from 'react';
import { BlogList } from './BlogList';
import { BlogPost } from './BlogPost';

interface BlogProps {
  onClose: () => void;
}

export function Blog({ onClose }: BlogProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  if (selectedSlug) {
    return (
      <BlogPost
        slug={selectedSlug}
        onBack={() => setSelectedSlug(null)}
        onClose={onClose}
      />
    );
  }

  return <BlogList onSelectPost={setSelectedSlug} onClose={onClose} />;
}
