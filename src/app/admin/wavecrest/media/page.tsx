// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
export default function WavecrestMediaPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Wavecrest Media</h1>
      <p className="text-sm text-slate-600 mb-8">
        Upload and manage estate photos and videos
      </p>

      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Coming Soon</h2>
          <p className="text-sm text-slate-500 max-w-xs">
            Media library will be available once blog functionality is enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
