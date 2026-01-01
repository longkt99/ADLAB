import { getAllPosts } from '@/lib/api/posts';
import { PostsHeader } from './posts-ui';
import PostsContent from './PostsContent';

export const dynamic = 'force-dynamic';

// ============================================
// Main Page Component (Server Component)
// ============================================

export default async function PostsPage() {
  // Fetch all posts server-side
  const posts = await getAllPosts({ orderBy: 'created_at', order: 'desc' });

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PostsHeader postsCount={posts.length} />

      {/* Client-side filtering and rendering */}
      <PostsContent initialPosts={posts} />
    </div>
  );
}
