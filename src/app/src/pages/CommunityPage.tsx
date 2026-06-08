import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar, EmptyState, ErrorBanner, Spinner } from '../components/ui/Common';
import { clubsApi, postsApi, teamsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Club, Post, Team } from '../types';

type Tab = 'posts' | 'clubs' | 'teams';

function ClubCard({ club }: { club: Club }) {
  const [joined, setJoined] = useState(club.isJoined ?? false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    try {
      if (joined) await clubsApi.leave(club.id);
      else await clubsApi.join(club.id);
      setJoined((j) => !j);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {club.coverUrl && (
        <img src={club.coverUrl} alt={club.name} className="w-full h-28 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">{club.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{club.memberCount ?? 0} 成员</p>
          </div>
          <button
            onClick={handleJoin}
            disabled={loading}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
              joined ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-primary text-white hover:bg-primary-light'
            }`}
          >
            {loading ? '...' : joined ? '已加入' : '加入'}
          </button>
        </div>
        {club.description && (
          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{club.description}</p>
        )}
      </div>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const [joined, setJoined] = useState(team.isJoined ?? false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    try {
      if (!joined) { await teamsApi.join(team.id); setJoined(true); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{team.name}</h3>
          {team.targetPeak && (
            <p className="text-xs text-primary-light mt-0.5">{team.targetPeak.name}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">{team.memberCount ?? 0} 人 {team.plannedDate ? `· ${new Date(team.plannedDate).toLocaleDateString('zh-CN')}` : ''}</p>
        </div>
        <button
          onClick={handleJoin}
          disabled={loading || joined}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
            joined ? 'bg-slate-700 text-slate-400' : 'bg-primary text-white hover:bg-primary-light'
          }`}
        >
          {loading ? '...' : joined ? '已申请' : '申请加入'}
        </button>
      </div>
      {team.description && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{team.description}</p>}
    </div>
  );
}

function PostFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = async (pg = 1) => {
    setLoading(true); setError('');
    try {
      const res = await postsApi.list({ page: pg, pageSize: 10 });
      const items: Post[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setPosts((prev) => pg === 1 ? items : [...prev, ...items]);
      setHasMore(items.length === 10);
      setPage(pg);
    } catch { setError('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  if (loading && page === 1) return <Spinner className="py-12" />;
  if (error) return <ErrorBanner message={error} onRetry={() => load(1)} />;
  if (posts.length === 0) return <EmptyState icon="feed" title="暂无帖子" />;

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <article key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar src={p.author?.avatar} name={p.author?.nickname || p.author?.username} size="sm" />
            <div>
              <p className="text-sm font-medium text-slate-200">{p.author?.nickname || p.author?.username || '用户'}</p>
              <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</p>
            </div>
          </div>
          {p.imageUrls?.[0] && (
            <img src={p.imageUrls[0]} alt="" className="w-full aspect-video rounded-xl object-cover mb-3" />
          )}
          {p.title && <h3 className="text-sm font-semibold text-slate-100 mb-1">{p.title}</h3>}
          <p className="text-sm text-slate-300 line-clamp-4 leading-relaxed">{p.content}</p>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">favorite_border</span>
              {p.likesCount ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">chat_bubble_outline</span>
              {p.commentsCount ?? 0}
            </span>
          </div>
        </article>
      ))}
      {hasMore && (
        <button onClick={() => load(page + 1)} disabled={loading}
          className="w-full py-3 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50">
          {loading ? '加载中...' : '加载更多'}
        </button>
      )}
    </div>
  );
}

function ClubList() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    clubsApi.list({ pageSize: 20 })
      .then((res) => setClubs(Array.isArray(res.data) ? res.data : res.data.data ?? []))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="py-12" />;
  if (error) return <ErrorBanner message={error} />;
  if (clubs.length === 0) return <EmptyState icon="groups" title="暂无俱乐部" />;
  return <div className="space-y-3">{clubs.map((c) => <ClubCard key={c.id} club={c} />)}</div>;
}

function TeamList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    teamsApi.list({ pageSize: 20 })
      .then((res) => setTeams(Array.isArray(res.data) ? res.data : res.data.data ?? []))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="py-12" />;
  if (error) return <ErrorBanner message={error} />;
  if (teams.length === 0) return <EmptyState icon="group_work" title="暂无队伍" description="发起队伍，寻找志同道合的伙伴" />;
  return <div className="space-y-3">{teams.map((t) => <TeamCard key={t.id} team={t} />)}</div>;
}

export function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'posts';

  const setTab = (t: Tab) => setSearchParams({ tab: t });

  return (
    <AppShell
      title="社区"
      headerRight={
        isAuthenticated && (
          <button
            onClick={() => navigate('/community/create')}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-300">edit_note</span>
          </button>
        )
      }
    >
      {/* Tab bar */}
      <div className="flex bg-slate-900 border-b border-slate-800 sticky top-14 z-30">
        {([['posts', '动态'], ['clubs', '俱乐部'], ['teams', '找队友']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t ? 'text-primary-light border-primary-light' : 'text-slate-500 border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-6">
        {tab === 'posts' && <PostFeed />}
        {tab === 'clubs' && <ClubList />}
        {tab === 'teams' && <TeamList />}
      </div>
    </AppShell>
  );
}
