export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="px-4 pt-safe-top">
          <div className="flex items-center justify-between py-3">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="flex items-center gap-1">
              <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse" />
              <div className="w-10 h-10 bg-gray-200 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-safe-bottom">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
                <div className="h-3 w-12 bg-gray-100 rounded ml-auto" />
              </div>
              <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
              <div className="h-3 w-full bg-gray-100 rounded mb-1" />
              <div className="h-3 w-2/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
