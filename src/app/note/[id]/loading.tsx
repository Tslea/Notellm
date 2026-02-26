export default function NoteDetailLoading() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 pt-safe-top">
          <div className="h-5 w-14 bg-gray-100 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
            <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />
            <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-safe-bottom animate-pulse">
        <div className="h-7 w-2/3 bg-gray-100 rounded mb-4" />
        <div className="space-y-2 mb-6">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-4 w-3/4 bg-gray-100 rounded" />
        </div>
        <div className="border-t border-gray-100 my-6" />
        <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-4 w-2/3 bg-gray-100 rounded" />
        </div>
      </main>
    </div>
  );
}
