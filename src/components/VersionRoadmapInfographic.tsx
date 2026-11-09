import React, { useState } from 'react';
import {
  VERSION_EVOLUTION_HISTORY,
  ACTIVE_ROADMAP_ITEMS,
  VersionRelease,
  RoadmapItem
} from '../data/roadmapData';

export const VersionRoadmapInfographic: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'roadmap'>('timeline');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'HUD / Combat Engine', 'Analytics & Team Builder', 'HUD / Compliance', 'Networking & Web'];

  const filteredRoadmap = selectedCategory === 'all'
    ? ACTIVE_ROADMAP_ITEMS
    : ACTIVE_ROADMAP_ITEMS.filter((item: RoadmapItem) => item.category === selectedCategory);

  return (
    <section
      id="version-roadmap"
      className="rounded-3xl p-6 sm:p-8 border space-y-8 relative overflow-hidden"
      style={{
        backgroundColor: '#0A1526',
        borderColor: '#1E3A5F',
        boxShadow: '0 20px 40px -15px rgba(2, 6, 23, 0.7)'
      }}
    >
      {/* Decorative ambient gradients */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #2DD4BF, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ background: 'radial-gradient(circle, #FACC15, transparent 70%)' }}
      />

      {/* Header and Toggle */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest uppercase text-teal-400 bg-teal-400/10 border border-teal-400/30 px-2.5 py-0.5 rounded-full">
              Evolution &amp; Future Vision
            </span>
            <span className="text-xs font-semibold text-slate-400">
              v1.00 → v7.27
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
            Continuous Evolution &amp; Future Roadmap
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            SilphScope PvP has evolved across 25+ major iterations into an uncompromising real-time combat intelligence HUD. We never stop building — explore the journey so far and what is coming next.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-700/80 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>📜</span>
            <span>Release History ({VERSION_EVOLUTION_HISTORY.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'roadmap'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🚀</span>
            <span>Future Roadmap ({ACTIVE_ROADMAP_ITEMS.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: VERSION RELEASE TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="relative z-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {VERSION_EVOLUTION_HISTORY.map((item: VersionRelease) => {
              const isCurrent = item.badge === 'CURRENT';
              return (
                <div
                  key={item.version}
                  className={`rounded-2xl p-5 border flex flex-col justify-between transition hover:scale-[1.01] duration-200 relative overflow-hidden ${
                    isCurrent ? 'ring-1 ring-teal-400/50' : ''
                  }`}
                  style={{
                    backgroundColor: isCurrent ? '#0c1d33' : '#071222',
                    borderColor: isCurrent ? '#2DD4BF' : '#19304E'
                  }}
                >
                  {isCurrent && (
                    <div className="absolute top-0 right-0">
                      <span className="bg-teal-400 text-slate-950 text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl shadow">
                        Live APK
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl p-2 rounded-xl bg-slate-800/70 border border-slate-700/60">
                        {item.icon}
                      </span>
                      <div>
                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                          {item.version}
                        </div>
                        <div className="text-[10.5px] font-bold text-slate-400">
                          {item.date}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-teal-300 line-clamp-1">
                        {item.codename}
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                        {item.summary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/70">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Key Capabilities Added:
                      </div>
                      <ul className="space-y-1">
                        {item.highlights.map((highlight: string, idx: number) => (
                          <li
                            key={idx}
                            className="text-[10.5px] text-slate-200 flex items-start gap-1.5 leading-tight"
                          >
                            <span className="text-teal-400 font-bold shrink-0">✓</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>SilphScope Core</span>
                    <span className="text-slate-500 font-mono">Clean Screen 1-Pass</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Summary Banner */}
          <div
            className="rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ backgroundColor: '#091527', borderColor: '#1F3C64' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="text-xs font-bold text-white">
                  Zero Game Impact &amp; 100% In-Memory Processing Invariant
                </div>
                <div className="text-[11px] text-slate-300">
                  Every feature released maintains our &lt;0.5% CPU budget, single-pass VirtualDisplay capture, and local memory execution.
                </div>
              </div>
            </div>
            <a
              href="https://github.com/sportsfan986/silphscope-pvp/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition shrink-0"
            >
              Read Full 1,100+ Line Changelog →
            </a>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE ROADMAP */}
      {activeTab === 'roadmap' && (
        <div className="relative z-10 space-y-6">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 mr-1">Filter by Area:</span>
            {categories.map((cat: string) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer capitalize ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                {cat === 'all' ? '🌟 All Upcoming Features' : cat}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoadmap.map((item: RoadmapItem) => (
              <div
                key={item.id}
                className="rounded-2xl p-5 border flex flex-col justify-between space-y-4 hover:border-amber-400/50 transition duration-200"
                style={{ backgroundColor: '#071222', borderColor: '#19304E' }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl p-2 rounded-xl bg-slate-800/70 border border-slate-700/60">
                      {item.icon}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                      {item.badge} • {item.category}
                    </div>
                    <h3 className="text-sm font-black text-white mt-0.5">
                      {item.title}
                    </h3>
                    <p className="text-[11.5px] text-slate-300 mt-1 leading-snug">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Target Implementation Vectors:
                    </div>
                    <ul className="space-y-1">
                      {item.keyGoals.map((goal: string, idx: number) => (
                        <li key={idx} className="text-[10.5px] text-slate-200 flex items-start gap-1.5 leading-tight">
                          <span className="text-amber-400 font-bold shrink-0">✦</span>
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Queued in Backlog</span>
                  <span className="text-amber-400/80 font-mono">Spare Tokens / Next Sprint</span>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Community Contribution / Feature Suggestion Box */}
          <div
            className="rounded-2xl p-5 border flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ backgroundColor: '#091527', borderColor: '#FACC15', borderWidth: '1px' }}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Have a Combat Feature Idea or Competitive Suggestion?
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Roadmap items are continually prioritized from real tournament play, top Battlers&apos; feedback, and automated nightly telemetry audits. Every subscriber tier directly funds new engineering tokens.
              </p>
            </div>
            <a
              href="https://github.com/sportsfan986/silphscope-pvp/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl font-black text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 transition shadow-lg shrink-0 cursor-pointer"
            >
              Submit Feature Idea on GitHub →
            </a>
          </div>
        </div>
      )}
    </section>
  );
};
