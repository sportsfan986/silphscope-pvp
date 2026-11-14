import React, { useMemo, useRef } from "react";
import {
  type BuiltPokemonEntry,
  type IvPresetMode,
  evaluateIvSpreadDetails,
  findPokemonByName,
  getPresetIvSpread,
  parseIvTriplet
} from "../data/pokemonDb";
import { cleanSpeciesNameWithoutShadow } from "../data/ivMatrixEngine";

export interface IvTripletChangePayload {
  atkIv: number;
  defIv: number;
  staIv: number;
  ivs: string;
  cp: number;
  level: number;
  isBestBuddy: boolean;
  rank?: number;
  pctOfRank1?: number;
}

export interface IvTripletInputProps {
  speciesName: string;
  league: string;
  ivs?: string;
  isBestBuddy?: boolean;
  onChange: (next: IvTripletChangePayload) => void;
  showBestBuddyToggle?: boolean;
  showPresets?: boolean;
  compact?: boolean;
  matchingBuilt?: BuiltPokemonEntry[];
  onPickBuilt?: (entry: BuiltPokemonEntry) => void;
  onSaveToBuilt?: () => void;
  savedHighlight?: boolean;
  disabled?: boolean;
  accentLabel?: string;
}

const IV_OPTIONS = Array.from({ length: 16 }, (_, idx) => idx);

function clampIv(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(15, Math.round(val)));
}

export const IvTripletInput: React.FC<IvTripletInputProps> = ({
  speciesName,
  league,
  ivs,
  isBestBuddy = false,
  onChange,
  showBestBuddyToggle = true,
  showPresets = false,
  compact = false,
  matchingBuilt = [],
  onPickBuilt,
  onSaveToBuilt,
  savedHighlight = false,
  disabled = false,
  accentLabel
}) => {
  const atkRef = useRef<HTMLInputElement | null>(null);
  const defRef = useRef<HTMLInputElement | null>(null);
  const staRef = useRef<HTMLInputElement | null>(null);

  const { cleanName } = useMemo(
    () => cleanSpeciesNameWithoutShadow(speciesName || ""),
    [speciesName]
  );

  const dbMon = useMemo(
    () => (cleanName ? findPokemonByName(cleanName) : undefined),
    [cleanName]
  );

  const [atkIv, defIv, staIv] = useMemo(
    () => parseIvTriplet(ivs, league, dbMon),
    [ivs, league, dbMon]
  );

  const evalDetails = useMemo(() => {
    if (!cleanName) return null;
    return evaluateIvSpreadDetails(cleanName, atkIv, defIv, staIv, league, isBestBuddy);
  }, [cleanName, atkIv, defIv, staIv, league, isBestBuddy]);

  const emitUpdate = (
    nextA: number,
    nextD: number,
    nextS: number,
    nextBb: boolean = isBestBuddy
  ) => {
    const a = clampIv(nextA);
    const d = clampIv(nextD);
    const s = clampIv(nextS);
    const details = cleanName
      ? evaluateIvSpreadDetails(cleanName, a, d, s, league, nextBb)
      : null;
    onChange({
      atkIv: a,
      defIv: d,
      staIv: s,
      ivs: `${a}/${d}/${s}`,
      cp: details?.cp ?? 1500,
      level: details?.level ?? 40,
      isBestBuddy: nextBb,
      rank: details?.rank,
      pctOfRank1: details?.pctOfRank1
    });
  };

  const applyPreset = (mode: IvPresetMode) => {
    if (!cleanName) return;
    const preset = getPresetIvSpread(cleanName, league, mode, isBestBuddy);
    if (!preset) return;
    emitUpdate(preset.atkIv, preset.defIv, preset.staIv, isBestBuddy);
  };

  const handleNumberInput = (
    statIndex: 0 | 1 | 2,
    rawVal: string,
    nextInputRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    const digitsOnly = rawVal.replace(/[^\d]/g, "");
    const parsed = digitsOnly === "" ? 0 : clampIv(parseInt(digitsOnly, 10));
    if (statIndex === 0) emitUpdate(parsed, defIv, staIv);
    else if (statIndex === 1) emitUpdate(atkIv, parsed, staIv);
    else emitUpdate(atkIv, defIv, parsed);

    if (
      nextInputRef?.current &&
      ((digitsOnly.length === 1 && parsed >= 2 && parsed <= 9) || digitsOnly.length >= 2)
    ) {
      nextInputRef.current.focus();
      nextInputRef.current.select();
    }
  };

  const renderStatBox = (
    label: string,
    value: number,
    statIndex: 0 | 1 | 2,
    inputRef: React.RefObject<HTMLInputElement | null>,
    nextRef?: React.RefObject<HTMLInputElement | null>,
    colorAccent?: string
  ) => (
    <div
      className={`flex flex-col ${
        compact ? "min-w-[54px]" : "min-w-[64px]"
      } rounded-lg border border-slate-700/80 bg-slate-950/80 px-1.5 py-1`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-[9px] font-bold uppercase tracking-wider ${
            colorAccent || "text-slate-400"
          }`}
        >
          {label}
        </span>
        <select
          aria-label={`${label} IV selector`}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const v = clampIv(Number(e.target.value));
            if (statIndex === 0) emitUpdate(v, defIv, staIv);
            else if (statIndex === 1) emitUpdate(atkIv, v, staIv);
            else emitUpdate(atkIv, defIv, v);
          }}
          className="w-5 cursor-pointer bg-transparent text-[10px] font-semibold text-cyan-300 focus:outline-none"
          title={`Pick ${label} IV (0–15)`}
        >
          {IV_OPTIONS.map((num) => (
            <option key={num} value={num} className="bg-slate-900 text-slate-100">
              {num}
            </option>
          ))}
        </select>
      </div>
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={0}
        max={15}
        disabled={disabled}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => handleNumberInput(statIndex, e.target.value, nextRef)}
        className={`w-full bg-transparent text-center font-mono font-bold text-white focus:outline-none ${
          compact ? "text-xs py-0" : "text-sm py-0.5"
        }`}
        aria-label={`${label} IV`}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {accentLabel && (
          <span className="text-[10px] font-semibold text-slate-300 mr-0.5">
            {accentLabel}
          </span>
        )}
        {renderStatBox("ATK", atkIv, 0, atkRef, defRef, "text-rose-300")}
        {renderStatBox("DEF", defIv, 1, defRef, staRef, "text-amber-300")}
        {renderStatBox("STA", staIv, 2, staRef, undefined, "text-emerald-300")}

        {showBestBuddyToggle && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => emitUpdate(atkIv, defIv, staIv, !isBestBuddy)}
            className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
              isBestBuddy
                ? "border-pink-400/70 bg-pink-500/20 text-pink-200"
                : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Best Buddy (+1 Level Ribbon / up to Lv 51)"
          >
            🎀 Lv51
          </button>
        )}

        {evalDetails && (
          <div
            className={`flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-950/30 px-2 py-1 font-mono ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            <span className="font-bold text-cyan-200">CP {evalDetails.cp}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">Lv {evalDetails.level}</span>
            <span className="text-slate-500">•</span>
            <span
              className={`font-bold ${
                evalDetails.rank === 1
                  ? "text-amber-300"
                  : evalDetails.rank <= 25
                  ? "text-emerald-300"
                  : "text-slate-300"
              }`}
            >
              #{evalDetails.rank} ({evalDetails.pctOfRank1.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      {(showPresets || matchingBuilt.length > 0 || onSaveToBuilt) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showPresets && (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyPreset("RANK_1")}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                🏆 Rank #1
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyPreset("PVPOKE_DEFAULT")}
                className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                📊 PvPoke
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyPreset("MAX_ATK")}
                className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/20"
              >
                ⚔️ Max Atk
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyPreset("HUNDO")}
                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                💯 15/15/15
              </button>
            </>
          )}

          {matchingBuilt.length > 0 && onPickBuilt && (
            <div className="inline-flex items-center">
              {matchingBuilt.length === 1 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPickBuilt(matchingBuilt[0])}
                  className="rounded border border-indigo-400/50 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/25"
                  title="Apply saved Built Pokémon IVs & moves"
                >
                  📦 Built: {matchingBuilt[0].label || `${matchingBuilt[0].ivs} (${matchingBuilt[0].cp})`}
                </button>
              ) : (
                <select
                  aria-label="Pick Built Pokemon Specimen"
                  disabled={disabled}
                  value=""
                  onChange={(e) => {
                    const hit = matchingBuilt.find((b) => b.id === e.target.value);
                    if (hit) onPickBuilt(hit);
                  }}
                  className="cursor-pointer rounded border border-indigo-400/50 bg-indigo-950/70 px-2 py-0.5 text-[10px] font-bold text-indigo-200 focus:outline-none"
                >
                  <option value="">📦 Pick Built ({matchingBuilt.length})</option>
                  {matchingBuilt.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                      {b.label ? `${b.label} • ` : ""}
                      {b.ivs} • CP {b.cp}
                      {b.isBestBuddy ? " 🎀Lv51" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {onSaveToBuilt && (
            <button
              type="button"
              disabled={disabled || !cleanName}
              onClick={onSaveToBuilt}
              className={`rounded border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                savedHighlight
                  ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              }`}
              title="Save this Pokémon's IVs, CP, Level & Moveset to My Built Roster"
            >
              {savedHighlight ? "✅ Saved Built" : "💾 Save Built"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
