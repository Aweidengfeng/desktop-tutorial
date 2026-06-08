import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar, EmptyState, ErrorBanner, Spinner } from '../components/ui/Common';
import { postsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post } from '../types';

const QUICK_ACTIONS = [
  { icon: 'terrain',    label: '探索山峰', to: '/explore?tab=peaks' },
  { icon: 'hiking',     label: '找向导',   to: '/explore?tab=guides' },
  { icon: 'groups',     label: '俱乐部',   to: '/community?tab=clubs' },
  { icon: 'group_work', label: '找队友',   to: '/community?tab=teams' },
  { icon: 'edit_note',  label: '发帖子',   to: '/community?action=post' },
  { icon: 'travel_explore', label: '商业探险', to: '/explore?tab=expeditions' },
] as const;

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(post.liked ?? false);
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0);

  const handleLike = async () => {
    try {
      await postsApi.like(post.id);
      setLiked((l) => !l);
      setLikesCount((c) => liked ? c - 1 : c + 1);
    } catch {
      // ignore
    }
  };

  return (
    <article className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
      {/* Author */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar src={post.author?.avatar} name={post.author?.nickname || post.author?.username} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">
            {post.author?.nickname || post.author?.username || '匿名用户'}
          </p>
          <p className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString('zh-CN')}</p>
        </div>
        {post.peak && (
          <span className="text-xs text-primary-light bg-primary/20 px-2 py-0.5 rounded-full">
            {post.peak.name}
          </span>
        )}
      </div>

      {/* Image */}
      {post.imageUrls?.[0] && (
        <img src={post.imageUrls[0]} alt="" className="w-full aspect-video object-cover" />
      )}

      {/* Content */}
      <div className="px-4 py-3">
        {post.title && <h3 className="text-sm font-semibold text-slate-100 mb-1">{post.title}</h3>}
        <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">{post.content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pb-3 pt-1 border-t border-slate-800">
        <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <span className="material-symbols-outlined text-base">{liked ? 'favorite' : 'favorite_border'}</span>
          <span>{likesCount}</span>
        </button>
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <span className="material-symbols-outlined text-base">chat_bubble_outline</span>
          <span>{post.commentsCount ?? 0}</span>
        </span>
      </div>
    </article>
  );
}

export function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await (isAuthenticated ? postsApi.feed : postsApi.list)({ page: pg, pageSize: 10 });
      const items: Post[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setPosts((prev) => pg === 1 ? items : [...prev, ...items]);
      setHasMore(items.length === 10);
      setPage(pg);
    } catch {
      setError('加载失败，请下拉重试');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadPosts(1); }, [loadPosts]);

  return (
    <AppShell
      title="巅峰探索"
      headerRight={
        !isAuthenticated ? (
          <button onClick={() => navigate('/auth/login')} className="text-sm text-primary-light font-medium">
            登录
          </button>
        ) : (
          <Avatar src={user?.avatar} name={user?.nickname || user?.username} size="sm" />
        )
      }
    >
      {/* 快捷入口 */}
      <section className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ icon, label, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-3.5 transition-colors"
            >
              <span className="material-symbols-outlined text-primary-light text-2xl">{icon}</span>
              <span className="text-xs text-slate-300 font-medium">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 动态流 */}
      <section className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">
            {isAuthenticated ? '我的关注' : '最新动态'}
          </h2>
          <button onClick={() => navigate('/community')} className="text-xs text-primary-light">查看全部</button>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => loadPosts(1)} />}

        <div className="space-y-3 pb-4">
          {loading && page === 1 ? (
            <Spinner className="py-12" />
          ) : posts.length === 0 ? (
            <EmptyState icon="feed" title="暂无内容" description="快去探索山峰，发现精彩动态" />
          ) : (
            <>
              {posts.map((p) => <PostCard key={p.id} post={p} />)}
              {hasMore && (
                <button
                  onClick={() => loadPosts(page + 1)}
                  disabled={loading}
                  className="w-full py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  {loading ? '加载中...' : '加载更多'}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
