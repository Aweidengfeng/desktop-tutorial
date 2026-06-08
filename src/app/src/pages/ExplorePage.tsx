import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Common';
import { guidesApi, peaksApi } from '../api/client';
import type { Guide, Peak } from '../types';

type Tab = 'peaks' | 'guides' | 'expeditions';

const DIFFICULTY_LABELS: Record<string, string> = {
  入门: 'bg-emerald-950 text-emerald-400',
  中等: 'bg-blue-950 text-blue-400',
  高难: 'bg-amber-950 text-amber-400',
  极难: 'bg-rose-950 text-rose-400',
};

function PeakCard({ peak }: { peak: Peak }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex gap-4 p-4">
      {peak.imageUrl ? (
        <img src={peak.imageUrl} alt={peak.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-slate-800" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-slate-600 text-3xl">terrain</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-100">{peak.name}</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {peak.altitude ? `${peak.altitude.toLocaleString()}m` : ''}
          {peak.location ? ` · ${peak.location}` : ''}
        </p>
        {peak.difficulty && (
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_LABELS[peak.difficulty] || 'bg-slate-700 text-slate-300'}`}>
            {peak.difficulty}
          </span>
        )}
        {peak.bestSeason && (
          <p className="text-xs text-slate-500 mt-1.5">最佳季节：{peak.bestSeason}</p>
        )}
      </div>
    </div>
  );
}

function GuideCard({ guide }: { guide: Guide }) {
  const name = guide.user?.nickname || guide.user?.username || guide.name || `向导 #${guide.id}`;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
          {name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{name}</p>
          {guide.rating != null && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-amber-400 text-sm">star</span>
              <span className="text-xs text-slate-400">{guide.rating.toFixed(1)} · {guide.reviewsCount ?? 0} 评价</span>
            </div>
          )}
        </div>
        {guide.pricePerDay != null && (
          <div className="text-right">
            <p className="text-sm font-semibold text-primary-light">
              {guide.currency || '¥'}{guide.pricePerDay.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">/ 天</p>
          </div>
        )}
      </div>
      {guide.bio && <p className="text-xs text-slate-400 line-clamp-2">{guide.bio}</p>}
      {guide.specialties && guide.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {guide.specialties.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'peaks';
  const [search, setSearch] = useState('');
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPeaks = async (pg = 1, q = '') => {
    setLoading(true); setError('');
    try {
      const res = await peaksApi.list({ page: pg, pageSize: 20, search: q || undefined });
      const items: Peak[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setPeaks((prev) => pg === 1 ? items : [...prev, ...items]);
      setHasMore(items.length === 20);
      setPage(pg);
    } catch { setError('加载失败，请重试'); }
    finally { setLoading(false); }
  };

  const loadGuides = async (pg = 1) => {
    setLoading(true); setError('');
    try {
      const res = await guidesApi.list({ page: pg, pageSize: 20 });
      const items: Guide[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setGuides((prev) => pg === 1 ? items : [...prev, ...items]);
      setHasMore(items.length === 20);
      setPage(pg);
    } catch { setError('加载失败，请重试'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setPage(1); setSearch('');
    if (tab === 'peaks') loadPeaks(1, '');
    else if (tab === 'guides') loadGuides(1);
  }, [tab]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { if (tab === 'peaks') loadPeaks(1, val); }, 400);
  };

  const setTab = (t: Tab) => setSearchParams({ tab: t });

  return (
    <AppShell title="探索">
      {/* Tab bar */}
      <div className="flex bg-slate-900 border-b border-slate-800 sticky top-14 z-30">
        {([['peaks', '山峰'], ['guides', '向导'], ['expeditions', '探险']] as [Tab, string][]).map(([t, label]) => (
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

      {/* Search */}
      {tab !== 'expeditions' && (
        <div className="px-4 py-3 sticky top-[calc(3.5rem+2.75rem)] z-20 bg-slate-950/95 backdrop-blur">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xl">search</span>
            <input
              type="search"
              placeholder={tab === 'peaks' ? '搜索山峰名称...' : '搜索向导...'}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
            />
          </div>
        </div>
      )}

      <div className="px-4 pb-6 space-y-3">
        {error && <ErrorBanner message={error} onRetry={() => tab === 'peaks' ? loadPeaks(1, search) : loadGuides(1)} />}

        {loading && page === 1 ? (
          <Spinner className="py-16" />
        ) : tab === 'peaks' ? (
          peaks.length === 0 ? (
            <EmptyState icon="terrain" title="没有找到山峰" description={search ? `"${search}" 没有匹配结果` : '暂无数据'} />
          ) : (
            <>
              {peaks.map((p) => <PeakCard key={p.id} peak={p} />)}
              {hasMore && (
                <button onClick={() => loadPeaks(page + 1, search)} disabled={loading}
                  className="w-full py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50">
                  {loading ? '加载中...' : '加载更多'}
                </button>
              )}
            </>
          )
        ) : tab === 'guides' ? (
          guides.length === 0 ? (
            <EmptyState icon="hiking" title="暂无向导" />
          ) : (
            <>
              {guides.map((g) => <GuideCard key={g.id} guide={g} />)}
              {hasMore && (
                <button onClick={() => loadGuides(page + 1)} disabled={loading}
                  className="w-full py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50">
                  {loading ? '加载中...' : '加载更多'}
                </button>
              )}
            </>
          )
        ) : (
          <EmptyState icon="travel_explore" title="商业探险" description="即将上线，敬请期待" />
        )}
      </div>
    </AppShell>
  );
}
