import React from 'react';
import type { AppCombatMode, Show6RosterOf6Preset, TeamPreset } from '../data/gblData';
import type { WebBattleLogEntry } from './AppThemeAndModels';

export interface TrashBinModalsProps {
  showTeamsTrashModal: boolean;
  setShowTeamsTrashModal: React.Dispatch<React.SetStateAction<boolean>>;
  appCombatMode: AppCombatMode;
  deletedTeamsTrash: TeamPreset[];
  show6DeletedRostersTrash: Array<{ target: 'MY' | 'OPP'; roster: Show6RosterOf6Preset }>;
  setShow6Rosters6: React.Dispatch<React.SetStateAction<Show6RosterOf6Preset[]>>;
  setShow6OpponentRosters6: React.Dispatch<React.SetStateAction<Show6RosterOf6Preset[]>>;
  saveShow6DeletedRostersTrashToStorage: (next: Array<{ target: 'MY' | 'OPP'; roster: Show6RosterOf6Preset }>) => void;
  restoreTeamPresetsFromTrash: (items: TeamPreset[]) => void;
  saveDeletedTeamsTrashToStorage: (next: TeamPreset[]) => void;
  showBattlesTrashModal: boolean;
  setShowBattlesTrashModal: React.Dispatch<React.SetStateAction<boolean>>;
  deletedBattlesTrash: WebBattleLogEntry[];
  restoreBattleLogsFromTrash: (items: WebBattleLogEntry[]) => void;
  saveDeletedBattlesTrashToStorage: (next: WebBattleLogEntry[]) => void;
}

export function TrashBinModals(props: TrashBinModalsProps) {
  const {
    showTeamsTrashModal,
    setShowTeamsTrashModal,
    appCombatMode,
    deletedTeamsTrash,
    show6DeletedRostersTrash,
    setShow6Rosters6,
    setShow6OpponentRosters6,
    saveShow6DeletedRostersTrashToStorage,
    restoreTeamPresetsFromTrash,
    saveDeletedTeamsTrashToStorage,
    showBattlesTrashModal,
    setShowBattlesTrashModal,
    deletedBattlesTrash,
    restoreBattleLogsFromTrash,
    saveDeletedBattlesTrashToStorage
  } = props;
  return (
    <>
        {showTeamsTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">
                  🗑️ {appCombatMode === 'show6' ? 'Show 6 Mode' : 'Standard GBL'} Deleted Teams Trash Bin (
                  {appCombatMode === 'show6'
                    ? deletedTeamsTrash.length + show6DeletedRostersTrash.length
                    : deletedTeamsTrash.length}
                  )
                </h3>
                <button
                  onClick={() => setShowTeamsTrashModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              {deletedTeamsTrash.length === 0 &&
              (appCombatMode !== 'show6' || show6DeletedRostersTrash.length === 0) ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No deleted teams in {appCombatMode === 'show6' ? 'Show 6' : 'GBL'} Trash. Any team you delete in this mode can be restored from here anytime.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {appCombatMode === 'show6' &&
                    show6DeletedRostersTrash.map((item) => (
                      <div
                        key={item.roster.id}
                        className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono mr-1.5">
                              {item.target === 'MY' ? 'MY 6' : 'OPP 6'}
                            </span>
                            {item.roster.name}{' '}
                            <span className="text-[10px] text-amber-400 font-mono">({item.roster.league})</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.roster.pokemon.map((p) => p.name).join(' • ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.target === 'MY') {
                                setShow6Rosters6((prev) => [
                                  item.roster,
                                  ...prev.filter((r) => r.id !== item.roster.id)
                                ]);
                              } else {
                                setShow6OpponentRosters6((prev) => [
                                  item.roster,
                                  ...prev.filter((r) => r.id !== item.roster.id)
                                ]);
                              }
                              saveShow6DeletedRostersTrashToStorage(
                                show6DeletedRostersTrash.filter((x) => x.roster.id !== item.roster.id)
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                          >
                            ♻️ Restore
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              saveShow6DeletedRostersTrashToStorage(
                                show6DeletedRostersTrash.filter((x) => x.roster.id !== item.roster.id)
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  {deletedTeamsTrash.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {t.name}{' '}
                          <span className="text-[10px] text-sky-400 font-mono">({t.league})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.pokemon.map((p) => p.name).join(' / ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => restoreTeamPresetsFromTrash([t])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                        >
                          ♻️ Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDeletedTeamsTrashToStorage(deletedTeamsTrash.filter((x) => x.id !== t.id))
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                {deletedTeamsTrash.length > 0 ||
                (appCombatMode === 'show6' && show6DeletedRostersTrash.length > 0) ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (deletedTeamsTrash.length > 0) {
                          restoreTeamPresetsFromTrash(deletedTeamsTrash);
                        }
                        if (appCombatMode === 'show6' && show6DeletedRostersTrash.length > 0) {
                          const myToRestore = show6DeletedRostersTrash
                            .filter((x) => x.target === 'MY')
                            .map((x) => x.roster);
                          const oppToRestore = show6DeletedRostersTrash
                            .filter((x) => x.target === 'OPP')
                            .map((x) => x.roster);
                          if (myToRestore.length > 0) {
                            setShow6Rosters6((prev) => [...myToRestore, ...prev]);
                          }
                          if (oppToRestore.length > 0) {
                            setShow6OpponentRosters6((prev) => [...oppToRestore, ...prev]);
                          }
                          saveShow6DeletedRostersTrashToStorage([]);
                        }
                        setShowTeamsTrashModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      ♻️ Restore All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        saveDeletedTeamsTrashToStorage([]);
                        if (appCombatMode === 'show6') {
                          saveShow6DeletedRostersTrashToStorage([]);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold"
                    >
                      🗑️ Empty Trash
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setShowTeamsTrashModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Battles Trash Bin Modal */}
        {showBattlesTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">
                  🗑️ Deleted Battles Trash Bin ({deletedBattlesTrash.length})
                </h3>
                <button
                  onClick={() => setShowBattlesTrashModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              {deletedBattlesTrash.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No deleted battles in Trash. Any battle you delete or clear can be restored from here anytime.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {deletedBattlesTrash.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className={b.result === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}>
                            {b.result === 'WIN' ? '🏆 WIN' : '💀 LOSS'}
                          </span>
                          <span>• {b.userTeamName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Vs: {b.opponents.length > 0 ? b.opponents.join(', ') : 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => restoreBattleLogsFromTrash([b])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                        >
                          ♻️ Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDeletedBattlesTrashToStorage(deletedBattlesTrash.filter((x) => x.id !== b.id))
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                {deletedBattlesTrash.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        restoreBattleLogsFromTrash(deletedBattlesTrash);
                        setShowBattlesTrashModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      ♻️ Restore All ({deletedBattlesTrash.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeletedBattlesTrashToStorage([])}
                      className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold"
                    >
                      🗑️ Empty Trash
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setShowBattlesTrashModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
