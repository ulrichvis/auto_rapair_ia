export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          AutoRepair Knowledge
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          A reliable foundation for automotive technical knowledge.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          The application scaffold is ready. PDF ingestion, structured data, and
          review workflows will be added incrementally.
        </p>
      </section>
    </main>
  );
}
