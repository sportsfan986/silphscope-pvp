import React, { useEffect, useState } from 'react';
import type {
  TeamDeltaResolutionChoice,
  TeamSyncDeltaConflict
} from '../data/teamSyncReconciler';

interface TeamSyncConflictModalProps {
  conflicts: TeamSyncDeltaConflict[];
  isApplying: boolean;
  onApply: (chosenMap: Record<string, TeamDeltaResolutionChoice>) => void;
  onDecideLater: () => void;
}

function formatTsLabel(ms?: number | null): string {
  if (!ms || ms < 1_000_000_000_000) return 'Unknown time';
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatChoiceText(
  conflict: TeamSyncDeltaConflict,
  choice: TeamDeltaResolutionChoice
): string {
  const localName = String(conflict.localTeam?.name || 'This Device').trim() || 'This Device';
  const remoteName = String(conflict.remoteTeam?.name || 'Cloud').trim() || 'Cloud';
  switch (choice) {
    case 'USE_CLOUD':
      return `☁️ Use Cloud Version ("${remoteName}")`;
    case 'USE_LOCAL':
      return `📱 Use This Device's Version ("${localName}")`;
    case 'MERGE_CLOUD_NAME_LOCAL_BODY':
      return `🔀 Merge: Cloud Name ("${remoteName}") + Local Team/Moves/IVs`;
    case 'MERGE_LOCAL_NAME_CLOUD_BODY':
      return `🔀 Merge: Local Name ("${localName}") + Cloud Team/Moves/IVs`;
    case 'KEEP_BOTH':
      return '📋 Keep Both as Separate Teams';
    case 'CONFIRM_DELETE':
      return conflict.kind === 'REMOTE_DELETED_LOCAL_ACTIVE'
        ? '🗑️ Delete on This Device (Match Cloud)'
        : '🗑️ Confirm Delete on All Devices';
    case 'RESTORE_KEEP':
      return conflict.kind === 'REMOTE_DELETED_LOCAL_ACTIVE'
        ? '♻️ Keep & Restore on All Devices'
        : '☁️ Restore Cloud Team on All Devices';
    case 'MERGE_INTO_CLOUD_KEEP_CLOUD_NAME':
      return `☁️ Merge into Cloud Team (Keep "${remoteName}")`;
    case 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME':
      return `📱 Merge into Cloud Team (Rename to "${localName}")`;
  }
}

function getKindBadge(kind: TeamSyncDeltaConflict['kind']): {
  label: string;
  className: string;
} {
  switch (kind) {
    case 'CONCURRENT_EDIT':
      return {
        label: 'Renamed / Edited on Both',
        className: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      };
    case 'AMBIGUOUS_DIFF':
      return {
        label: 'Version Upgrade / Tied Diff',
        className: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      };
    case 'REMOTE_DELETED_LOCAL_ACTIVE':
      return {
        label: 'Deleted on Another Device',
        className: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      };
    case 'LOCAL_DELETED_REMOTE_ACTIVE':
      return {
        label: 'Deleted Locally vs Active Cloud',
        className: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      };
    case 'DUPLICATE_LINEUP_DIFF_ID':
      return {
        label: 'Duplicate Lineup (2 IDs)',
        className: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      };
  }
}

export const TeamSyncConflictModal: React.FC<TeamSyncConflictModalProps> = ({
  conflicts,
  isApplying,
  onApply,
  onDecideLater
}) => {
  const [chosenMap, setChosenMap] = useState<Record<string, TeamDeltaResolutionChoice>>({});

  useEffect(() => {
    const initial: Record<string, TeamDeltaResolutionChoice> = {};
    for (const c of conflicts) {
      initial[c.conflictKey] = c.recommendedChoice;
    }
    setChosenMap(initial);
  }, [conflicts]);

  if (!conflicts || conflicts.length === 0) return null;

  const setAllCloud = () => {
    const next: Record<string, TeamDeltaResolutionChoice> = {};
    for (const c of conflicts) {
      if (c.kind === 'REMOTE_DELETED_LOCAL_ACTIVE') next[c.conflictKey] = 'CONFIRM_DELETE';
      else if (c.kind === 'LOCAL_DELETED_REMOTE_ACTIVE') next[c.conflictKey] = 'RESTORE_KEEP';
      else if (c.kind === 'DUPLICATE_LINEUP_DIFF_ID')
        next[c.conflictKey] = 'MERGE_INTO_CLOUD_KEEP_CLOUD_NAME';
      else next[c.conflictKey] = 'USE_CLOUD';
    }
    setChosenMap(next);
  };

  const setAllLocal = () => {
    const next: Record<string, TeamDeltaResolutionChoice> = {};
    for (const c of conflicts) {
      if (c.kind === 'REMOTE_DELETED_LOCAL_ACTIVE') next[c.conflictKey] = 'RESTORE_KEEP';
      else if (c.kind === 'LOCAL_DELETED_REMOTE_ACTIVE') next[c.conflictKey] = 'CONFIRM_DELETE';
      else if (c.kind === 'DUPLICATE_LINEUP_DIFF_ID')
        next[c.conflictKey] = 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME';
      else next[c.conflictKey] = 'USE_LOCAL';
    }
    setChosenMap(next);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              🔄 Resolve Team Sync Deltas ({conflicts.length})
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Clean non-conflicting updates were auto-merged. Choose how to resolve each remaining
              difference so every device matches.
            </p>
          </div>
          <button
            type="button"
            disabled={isApplying}
            onClick={onDecideLater}
            className="text-slate-400 hover:text-white font-bold text-lg px-2 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {conflicts.length >= 2 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isApplying}
              onClick={setAllCloud}
              className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold transition disabled:opacity-50"
            >
              ☁️ Cloud for All
            </button>
            <button
              type="button"
              disabled={isApplying}
              onClick={setAllLocal}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition disabled:opacity-50"
            >
              📱 This Device for All
            </button>
          </div>
        )}

        <div className="overflow-y-auto space-y-3 pr-1 flex-1">
          {conflicts.map((c) => {
            const badge = getKindBadge(c.kind);
            const title =
              c.remoteTeam?.name || c.localTeam?.name || c.deletedMeta?.name || 'Unnamed Team';
            const league =
              c.remoteTeam?.league || c.localTeam?.league || c.deletedMeta?.league || 'GREAT LEAGUE';
            const currentChoice = chosenMap[c.conflictKey] || c.recommendedChoice;

            return (
              <div
                key={c.conflictKey}
                className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                    {c.combatMode === 'show6' ? 'SHOW 6' : 'GBL'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs font-bold text-white truncate">{title}</span>
                  <span className="text-[11px] text-slate-400">({league})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-700/70">
                    <div className="font-bold text-slate-200">
                      📱 This Device{' '}
                      <span className="text-slate-400 font-normal">
                        ({formatTsLabel(c.localTeam?.updatedAt ?? c.deletedMeta?.updatedAt)})
                      </span>
                    </div>
                    {c.localTeam ? (
                      <div className="text-slate-300 mt-0.5">
                        <span className="font-semibold">"{c.localTeam.name}"</span>
                        <div className="text-slate-400">
                          {(c.localTeam.pokemon || []).slice(0, 3).map((m) => m.name).join(' / ')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-rose-300 mt-0.5">Deleted locally</div>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-700/70">
                    <div className="font-bold text-sky-300">
                      ☁️ Cloud{' '}
                      <span className="text-slate-400 font-normal">
                        ({formatTsLabel(c.remoteTeam?.updatedAt ?? c.deletedMeta?.updatedAt)})
                      </span>
                    </div>
                    {c.remoteTeam ? (
                      <div className="text-slate-200 mt-0.5">
                        <span className="font-semibold">"{c.remoteTeam.name}"</span>
                        <div className="text-slate-400">
                          {(c.remoteTeam.pokemon || []).slice(0, 3).map((m) => m.name).join(' / ')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-rose-300 mt-0.5">Deleted on another device</div>
                    )}
                  </div>
                </div>

                {c.diffLines.length > 0 && (
                  <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                    {c.diffLines.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                )}

                <div className="space-y-1.5 pt-1">
                  {c.availableChoices.map((choice) => (
                    <label
                      key={choice}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${
                        currentChoice === choice
                          ? 'bg-sky-500/15 border-sky-400/60 text-white font-semibold'
                          : 'bg-slate-900/40 border-slate-700/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`conflict-${c.conflictKey}`}
                        checked={currentChoice === choice}
                        disabled={isApplying}
                        onChange={() =>
                          setChosenMap((prev) => ({
                            ...prev,
                            [c.conflictKey]: choice
                          }))
                        }
                        className="accent-sky-400"
                      />
                      <span>{formatChoiceText(c, choice)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={isApplying}
            onClick={onDecideLater}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50"
          >
            Decide Later
          </button>
          <button
            type="button"
            disabled={isApplying}
            onClick={() => onApply(chosenMap)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition disabled:opacity-50"
          >
            {isApplying ? 'Applying & Syncing...' : '✅ Apply & Sync All Devices'}
          </button>
        </div>
      </div>
    </div>
  );
};
