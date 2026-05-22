export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
      <p className="mt-2 text-slate-500">模块开发中</p>
    </div>
  );
}
