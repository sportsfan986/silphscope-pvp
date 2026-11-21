import type { TeamMember, TeamPreset } from './pokemonDb';

export const TEAM_SYNC_BASELINES_STORAGE_KEY = 'gbl_d1_team_sync_baselines_v1';
export const DELETED_TEAM_META_STORAGE_KEY = 'gbl_deleted_team_meta_v1';

export const FACTORY_DEFAULT_TEAM_IDS = new Set<string>([
  'preset-ml-1',
  'preset-ul-1',
  'preset-gl-1',
  'preset-mega-1',
  'show6-preset3-spectral-1',
  'show6-preset3-cauldron-1',
  'show6-preset3-master-1',
  'show6-preset3-bfmaster-1'
]);

export interface TeamSyncBaselineRecord {
  id: string;
  sig: string;
  name: string;
  combatMode: 'gbl' | 'show6';
  updatedAt: number;
}

export interface DeletedTeamMetaRecord {
  id: string;
  name: string;
  league: string;
  combatMode: 'gbl' | 'show6';
  updatedAt: number;
}

export type TeamDeltaConflictKind =
  | 'CONCURRENT_EDIT'
  | 'AMBIGUOUS_DIFF'
  | 'REMOTE_DELETED_LOCAL_ACTIVE'
  | 'LOCAL_DELETED_REMOTE_ACTIVE'
  | 'DUPLICATE_LINEUP_DIFF_ID';

export type TeamDeltaResolutionChoice =
  | 'USE_CLOUD'
  | 'USE_LOCAL'
  | 'MERGE_CLOUD_NAME_LOCAL_BODY'
  | 'MERGE_LOCAL_NAME_CLOUD_BODY'
  | 'KEEP_BOTH'
  | 'CONFIRM_DELETE'
  | 'RESTORE_KEEP'
  | 'MERGE_INTO_CLOUD_KEEP_CLOUD_NAME'
  | 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME';

export interface TeamSyncDeltaConflict {
  conflictKey: string;
  kind: TeamDeltaConflictKind;
  combatMode: 'gbl' | 'show6';
  localTeam: TeamPreset | null;
  remoteTeam: TeamPreset | null;
  deletedMeta: DeletedTeamMetaRecord | null;
  diffLines: string[];
  availableChoices: TeamDeltaResolutionChoice[];
  recommendedChoice: TeamDeltaResolutionChoice;
}

export interface TeamReconcileResult {
  gblTeams: TeamPreset[];
  show6Teams: TeamPreset[];
  deletedTeamIds: string[];
  updatedBaselines: Record<string, TeamSyncBaselineRecord>;
  updatedDeletedMeta: Record<string, DeletedTeamMetaRecord>;
  newOrUpdatedCount: number;
  mutatedLocally: boolean;
  autoPushLocalTeams: TeamPreset[];
  conflicts: TeamSyncDeltaConflict[];
}

export function normLeagueForTeamSig(rawLeague?: string | null): string {
  const s = String(rawLeague ?? '')
    .trim()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
    .toUpperCase();
  return s || 'GREAT LEAGUE';
}

export function normTeamCombatMode(
  rawMode?: string | null,
  rawId?: string | null,
  rawLeague?: string | null
): 'gbl' | 'show6' {
  const m = String(rawMode ?? '').trim().toLowerCase();
  const id = String(rawId ?? '').trim();
  const lg = String(rawLeague ?? '').trim().toUpperCase();
  if (m === 'show6' || id.startsWith('show6-preset3-') || lg.includes('SHOW 6')) {
    return 'show6';
  }
  return 'gbl';
}

export function computeCanonicalTeamContentSig(team: TeamPreset): string {
  const mode = normTeamCombatMode(team.combatMode, team.id, team.league);
  const name = String(team.name ?? '').trim();
  const league = normLeagueForTeamSig(team.league);
  const assignedSet = new Set<string>([league]);
  if (Array.isArray(team.assignedLeagues)) {
    for (const al of team.assignedLeagues) {
      const n = normLeagueForTeamSig(al);
      if (n) assignedSet.add(n);
    }
  }
  const assigned = Array.from(assignedSet)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(',');
  const archetype = String(team.archetype ?? 'ABC').trim().toUpperCase() || 'ABC';
  const slots = (Array.isArray(team.pokemon) ? team.pokemon : [])
    .slice(0, 3)
    .map((s) => {
      const sName = String(s?.name ?? '').trim();
      const cpVal = Math.trunc(Number(s?.cp) || 0);
      const fast = String(s?.fastMove ?? '').trim();
      const c1 = String(s?.chargedMove1 ?? '').trim();
      const c2 = String(s?.chargedMove2 ?? '').trim();
      const ivs = String(s?.ivs ?? '').trim();
      const hasPlus =
        s?.plusMoveLevel !== null &&
        s?.plusMoveLevel !== undefined &&
        Number.isFinite(Number(s.plusMoveLevel));
      const plusLvl = hasPlus ? Math.trunc(Number(s.plusMoveLevel)) : 4;
      const bb = s?.isBestBuddy ? 1 : 0;
      const mega = String(s?.megaFormName ?? '').trim();
      return `${sName}~${cpVal}~${fast}~${c1}~${c2}~${ivs}~${plusLvl}~${bb}~${mega}`;
    })
    .join('||');
  return `${mode}|${name}|${league}|${assigned}|${archetype}|${slots}`;
}

export function computeLineupCpCap(rawLeague?: string | null): number {
  const u = String(rawLeague ?? '').trim().toUpperCase();
  if (!u) return 1500;
  if (u.includes('LITTLE') || u.includes('500')) return 500;
  if (u.includes('MASTER') || u.includes('10000')) return 10000;
  if (u.includes('ULTRA') || u.includes('CAULDRON') || u.includes('2500')) return 2500;
  return 1500;
}

export function computeLineupMergeKey(team: TeamPreset): string | null {
  const pokes = Array.isArray(team.pokemon) ? team.pokemon : [];
  if (pokes.length < 3) return null;
  const mode = normTeamCombatMode(team.combatMode, team.id, team.league);
  const cpCap = computeLineupCpCap(team.league);
  const slotsKey = pokes
    .slice(0, 3)
    .map((s) => {
      const n = String(s?.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      const f = String(s?.fastMove ?? '').trim().toLowerCase();
      const c1 = String(s?.chargedMove1 ?? '').trim().toLowerCase();
      const c2 = String(s?.chargedMove2 ?? '').trim().toLowerCase();
      return `${n}|${f}|${c1}|${c2}`;
    })
    .join('||');
  return `${mode}|${cpCap}|${slotsKey}`;
}

export function computeVaultTeamsDigest(activeTeams: TeamPreset[]): string {
  const entries: Array<{ id: string; entry: string }> = [];
  for (const t of activeTeams || []) {
    const id = String(t?.id ?? '').trim();
    if (!id) continue;
    entries.push({ id, entry: `${id}:${computeCanonicalTeamContentSig(t)}` });
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const payload = entries.map((e) => e.entry).join('\n');
  let h1 = 0x811c9dc5 | 0;
  let h2 = 0x9e3779b9 | 0;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch + 1), 0x85ebca6b | 0);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${entries.length}:${hex1}${hex2}`;
}

export function isUntouchedFactoryPreset(team: TeamPreset): boolean {
  const id = String(team?.id ?? '').trim();
  const upd = Number(team?.updatedAt) || 0;
  return FACTORY_DEFAULT_TEAM_IDS.has(id) && upd <= 1;
}

function formatSlotBrief(slot?: TeamMember | null): string {
  if (!slot) return 'Empty';
  const name = String(slot.name ?? '').trim();
  const fast = String(slot.fastMove ?? '').trim();
  const c1 = String(slot.chargedMove1 ?? '').trim();
  const c2 = String(slot.chargedMove2 ?? '').trim();
  const ivs = String(slot.ivs ?? '').trim();
  const mega = String(slot.megaFormName ?? '').trim();
  const extras: string[] = [];
  if ((Number(slot.cp) || 0) > 0) extras.push(`${Math.trunc(Number(slot.cp))}CP`);
  if (ivs) extras.push(ivs);
  if (mega) extras.push(`Mega:${mega}`);
  if (slot.isBestBuddy) extras.push('BB');
  const moves = [fast, c1, c2].filter(Boolean).join('/');
  const suffix = extras.length > 0 ? ` (${extras.join(', ')})` : '';
  return moves ? `${name} — ${moves}${suffix}` : `${name}${suffix}`;
}

export function describeTeamFieldDiffs(local: TeamPreset, remote: TeamPreset): string[] {
  const lines: string[] = [];
  const lName = String(local.name ?? '').trim();
  const rName = String(remote.name ?? '').trim();
  if (lName !== rName) {
    lines.push(`Name: Local "${lName}" vs Cloud "${rName}"`);
  }
  const lAssigned = Array.from(
    new Set([normLeagueForTeamSig(local.league), ...(local.assignedLeagues || []).map(normLeagueForTeamSig)])
  )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(', ');
  const rAssigned = Array.from(
    new Set([normLeagueForTeamSig(remote.league), ...(remote.assignedLeagues || []).map(normLeagueForTeamSig)])
  )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(', ');
  if (lAssigned !== rAssigned || normLeagueForTeamSig(local.league) !== normLeagueForTeamSig(remote.league)) {
    lines.push(`Leagues: Local [${lAssigned}] vs Cloud [${rAssigned}]`);
  }
  const lArch = String(local.archetype ?? 'ABC').trim().toUpperCase();
  const rArch = String(remote.archetype ?? 'ABC').trim().toUpperCase();
  if (lArch !== rArch) {
    lines.push(`Archetype: Local ${lArch} vs Cloud ${rArch}`);
  }
  const lPokes = Array.isArray(local.pokemon) ? local.pokemon : [];
  const rPokes = Array.isArray(remote.pokemon) ? remote.pokemon : [];
  const maxSlots = Math.min(3, Math.max(lPokes.length, rPokes.length));
  for (let i = 0; i < maxSlots; i++) {
    const lDesc = formatSlotBrief(lPokes[i]);
    const rDesc = formatSlotBrief(rPokes[i]);
    if (lDesc !== rDesc) {
      lines.push(`Slot ${i + 1}: Local [${lDesc}] vs Cloud [${rDesc}]`);
    }
  }
  if (lines.length === 0) {
    lines.push(`Metadata updated (${lName || rName})`);
  }
  return lines;
}

function normalizePresetRecord(team: TeamPreset, forcedMode?: 'gbl' | 'show6'): TeamPreset {
  const id = String(team?.id ?? '').trim();
  const mode = forcedMode || normTeamCombatMode(team?.combatMode, id, team?.league);
  return {
    ...team,
    id,
    name: String(team?.name ?? ''),
    league: (String(team?.league ?? 'GREAT LEAGUE').trim() || 'GREAT LEAGUE') as TeamPreset['league'],
    combatMode: mode,
    updatedAt: Number(team?.updatedAt) || 0,
    pokemon: Array.isArray(team?.pokemon) ? team.pokemon : []
  };
}

function mergeMetricsPreserveSelected(preferred: TeamPreset, other: TeamPreset, preserveSelected: boolean): TeamPreset {
  const prefMetaCount = Object.keys(preferred.metaPoolMetrics || {}).length;
  const otherMetaCount = Object.keys(other.metaPoolMetrics || {}).length;
  return {
    ...preferred,
    isSelected: preserveSelected,
    metaPoolMetrics: prefMetaCount >= otherMetaCount ? preferred.metaPoolMetrics || other.metaPoolMetrics : other.metaPoolMetrics,
    synergySummary: preferred.synergySummary || other.synergySummary,
    leadAggBr: preferred.leadAggBr || other.leadAggBr,
    machineAggBr: preferred.machineAggBr || other.machineAggBr,
    safeSwapBr: preferred.safeSwapBr || other.safeSwapBr,
    closerSwapBr: preferred.closerSwapBr || other.closerSwapBr,
    closerBr: preferred.closerBr || other.closerBr
  };
}

function buildConcurrentEditChoices(
  local: TeamPreset,
  remote: TeamPreset
): { choices: TeamDeltaResolutionChoice[]; preferCloud: boolean } {
  const nameDiffers = String(local.name ?? '').trim() !== String(remote.name ?? '').trim();
  const bodyDiffers =
    computeCanonicalTeamContentSig({ ...local, name: '' }) !== computeCanonicalTeamContentSig({ ...remote, name: '' });
  const choices: TeamDeltaResolutionChoice[] = ['USE_CLOUD', 'USE_LOCAL'];
  if (nameDiffers && bodyDiffers) {
    choices.push('MERGE_CLOUD_NAME_LOCAL_BODY', 'MERGE_LOCAL_NAME_CLOUD_BODY');
  }
  choices.push('KEEP_BOTH');
  return {
    choices,
    preferCloud: (Number(remote.updatedAt) || 0) >= (Number(local.updatedAt) || 0)
  };
}

export function reconcileAllTeamsThreeWay({
  localGblTeams,
  localShow6Teams,
  localDeletedTeamIds,
  localDeletedMeta,
  baselines,
  hasExistingBaseline,
  remoteUpsertedTeams,
  remoteDeletedTeamIds,
  remoteDeletedMeta,
  isFullRemoteSnapshot
}: {
  localGblTeams: TeamPreset[];
  localShow6Teams: TeamPreset[];
  localDeletedTeamIds: string[];
  localDeletedMeta: Record<string, DeletedTeamMetaRecord>;
  baselines: Record<string, TeamSyncBaselineRecord>;
  hasExistingBaseline: boolean;
  remoteUpsertedTeams: TeamPreset[];
  remoteDeletedTeamIds: string[];
  remoteDeletedMeta: Record<string, DeletedTeamMetaRecord>;
  isFullRemoteSnapshot: boolean;
}): TeamReconcileResult {
  const normLocalAll = new Map<string, TeamPreset>();
  const localOrderIds: string[] = [];
  for (const raw of localGblTeams) {
    const t = normalizePresetRecord(raw, 'gbl');
    if (t.id && !normLocalAll.has(t.id)) {
      normLocalAll.set(t.id, t);
      localOrderIds.push(t.id);
    }
  }
  for (const raw of localShow6Teams) {
    const t = normalizePresetRecord(raw, 'show6');
    if (t.id && !normLocalAll.has(t.id)) {
      normLocalAll.set(t.id, t);
      localOrderIds.push(t.id);
    }
  }

  const normRemoteAll = new Map<string, TeamPreset>();
  const remoteOrderIds: string[] = [];
  for (const raw of remoteUpsertedTeams) {
    const t = normalizePresetRecord(raw);
    if (t.id && !normRemoteAll.has(t.id)) {
      normRemoteAll.set(t.id, t);
      remoteOrderIds.push(t.id);
    }
  }

  const localDelSet = new Set<string>((localDeletedTeamIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const remoteDelSet = new Set<string>((remoteDeletedTeamIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const nextBaselines: Record<string, TeamSyncBaselineRecord> = { ...baselines };
  const nextDeletedMeta: Record<string, DeletedTeamMetaRecord> = { ...localDeletedMeta };
  for (const [k, v] of Object.entries(remoteDeletedMeta || {})) {
    const prev = nextDeletedMeta[k];
    if (!prev || (v?.updatedAt || 0) > (prev.updatedAt || 0)) {
      nextDeletedMeta[k] = v;
    }
  }

  const remoteRealCountByMode: Record<'gbl' | 'show6', number> = { gbl: 0, show6: 0 };
  for (const rt of normRemoteAll.values()) {
    if (!isUntouchedFactoryPreset(rt)) {
      const m = rt.combatMode === 'show6' ? 'show6' : 'gbl';
      remoteRealCountByMode[m] += 1;
    }
  }

  const finalTeamsMap = new Map<string, TeamPreset>();
  const autoPushTeams: TeamPreset[] = [];
  const conflicts: TeamSyncDeltaConflict[] = [];
  let newOrUpdatedCount = 0;
  let mutatedLocally = false;

  const remoteOnlyByLineupKey = new Map<string, TeamPreset[]>();
  for (const rid of remoteOrderIds) {
    if (remoteDelSet.has(rid) || localDelSet.has(rid) || normLocalAll.has(rid)) continue;
    const rt = normRemoteAll.get(rid);
    if (!rt) continue;
    const lk = computeLineupMergeKey(rt);
    if (lk) {
      const arr = remoteOnlyByLineupKey.get(lk) || [];
      arr.push(rt);
      remoteOnlyByLineupKey.set(lk, arr);
    }
  }
  const pairedRemoteDupIds = new Set<string>();
  const handledLocalIds = new Set<string>();

  for (const id of localOrderIds) {
    const local = normLocalAll.get(id);
    if (!local) continue;
    localDelSet.delete(id);
    const remote = normRemoteAll.get(id);
    const mode = local.combatMode === 'show6' ? 'show6' : 'gbl';

    if (remoteDelSet.has(id)) {
      handledLocalIds.add(id);
      if (isUntouchedFactoryPreset(local)) {
        localDelSet.add(id);
        delete nextBaselines[id];
        mutatedLocally = true;
        continue;
      }
      finalTeamsMap.set(id, local);
      const rMeta: DeletedTeamMetaRecord = remoteDeletedMeta?.[id] || {
        id,
        name: local.name,
        league: String(local.league),
        combatMode: mode,
        updatedAt: 0
      };
      const base = baselines[id];
      const editedAfterBase = Boolean(base && computeCanonicalTeamContentSig(local) !== base.sig);
      const recChoice: TeamDeltaResolutionChoice =
        editedAfterBase || (rMeta.updatedAt > 0 && (local.updatedAt || 0) > rMeta.updatedAt + 5000)
          ? 'RESTORE_KEEP'
          : 'CONFIRM_DELETE';
      conflicts.push({
        conflictKey: `remote_del|${id}`,
        kind: 'REMOTE_DELETED_LOCAL_ACTIVE',
        combatMode: mode,
        localTeam: local,
        remoteTeam: null,
        deletedMeta: rMeta,
        diffLines: [
          `Team "${local.name}" was deleted on another device (${(local.pokemon || []).slice(0, 3).map((m) => m.name).join(' / ')}).`,
          editedAfterBase ? 'This device also has unsynced local edits.' : 'Still active on this device.'
        ],
        availableChoices: ['CONFIRM_DELETE', 'RESTORE_KEEP'],
        recommendedChoice: recChoice
      });
      continue;
    }

    if (remote) {
      handledLocalIds.add(id);
      const localSig = computeCanonicalTeamContentSig(local);
      const remoteSig = computeCanonicalTeamContentSig(remote);
      const base = baselines[id];

      if (localSig === remoteSig) {
        const merged =
          (remote.updatedAt || 0) > (local.updatedAt || 0)
            ? mergeMetricsPreserveSelected(remote, local, Boolean(local.isSelected))
            : mergeMetricsPreserveSelected(local, remote, Boolean(local.isSelected));
        finalTeamsMap.set(id, merged);
        nextBaselines[id] = {
          id,
          sig: remoteSig,
          name: merged.name,
          combatMode: mode,
          updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0)
        };
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
          mutatedLocally = true;
        }
        continue;
      }

      if (isUntouchedFactoryPreset(local)) {
        const applied: TeamPreset = { ...remote, isSelected: local.isSelected };
        finalTeamsMap.set(id, applied);
        nextBaselines[id] = {
          id,
          sig: remoteSig,
          name: applied.name,
          combatMode: mode,
          updatedAt: remote.updatedAt || 0
        };
        newOrUpdatedCount++;
        mutatedLocally = true;
        continue;
      }

      if (base) {
        const localChanged = localSig !== base.sig;
        const remoteChanged = remoteSig !== base.sig;
        if (!localChanged && remoteChanged) {
          const applied: TeamPreset = { ...remote, isSelected: local.isSelected };
          finalTeamsMap.set(id, applied);
          nextBaselines[id] = {
            id,
            sig: remoteSig,
            name: applied.name,
            combatMode: mode,
            updatedAt: remote.updatedAt || 0
          };
          newOrUpdatedCount++;
          mutatedLocally = true;
        } else if (localChanged && !remoteChanged) {
          finalTeamsMap.set(id, local);
          autoPushTeams.push(local);
        } else {
          finalTeamsMap.set(id, local);
          const { choices, preferCloud } = buildConcurrentEditChoices(local, remote);
          conflicts.push({
            conflictKey: `concurrent|${id}`,
            kind: 'CONCURRENT_EDIT',
            combatMode: mode,
            localTeam: local,
            remoteTeam: remote,
            deletedMeta: null,
            diffLines: describeTeamFieldDiffs(local, remote),
            availableChoices: choices,
            recommendedChoice: preferCloud ? 'USE_CLOUD' : 'USE_LOCAL'
          });
        }
      } else {
        if ((remote.updatedAt || 0) > (local.updatedAt || 0) + 5000) {
          const applied: TeamPreset = { ...remote, isSelected: local.isSelected };
          finalTeamsMap.set(id, applied);
          nextBaselines[id] = {
            id,
            sig: remoteSig,
            name: applied.name,
            combatMode: mode,
            updatedAt: remote.updatedAt || 0
          };
          newOrUpdatedCount++;
          mutatedLocally = true;
        } else {
          finalTeamsMap.set(id, local);
          const { choices, preferCloud } = buildConcurrentEditChoices(local, remote);
          conflicts.push({
            conflictKey: `ambiguous|${id}`,
            kind: 'AMBIGUOUS_DIFF',
            combatMode: mode,
            localTeam: local,
            remoteTeam: remote,
            deletedMeta: null,
            diffLines: describeTeamFieldDiffs(local, remote),
            availableChoices: choices,
            recommendedChoice: preferCloud ? 'USE_CLOUD' : 'USE_LOCAL'
          });
        }
      }
      continue;
    }

    if (isFullRemoteSnapshot) {
      handledLocalIds.add(id);
      if (isUntouchedFactoryPreset(local) && remoteRealCountByMode[mode] > 0) {
        localDelSet.add(id);
        delete nextBaselines[id];
        mutatedLocally = true;
        continue;
      }
      const lKey = computeLineupMergeKey(local);
      const cands = lKey ? (remoteOnlyByLineupKey.get(lKey) || []).filter((r) => !pairedRemoteDupIds.has(r.id)) : [];
      const dupRemote = cands[0];
      if (dupRemote) {
        pairedRemoteDupIds.add(dupRemote.id);
        finalTeamsMap.set(id, local);
        const preferCloudName = (dupRemote.updatedAt || 0) > (local.updatedAt || 0);
        conflicts.push({
          conflictKey: `duplineup|${local.id}|${dupRemote.id}`,
          kind: 'DUPLICATE_LINEUP_DIFF_ID',
          combatMode: mode,
          localTeam: local,
          remoteTeam: dupRemote,
          deletedMeta: null,
          diffLines: [
            'Identical 3-Pokémon lineup exists under two separate Team IDs:',
            `Local: "${local.name}" vs Cloud: "${dupRemote.name}"`
          ],
          availableChoices: ['MERGE_INTO_CLOUD_KEEP_CLOUD_NAME', 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME', 'KEEP_BOTH'],
          recommendedChoice: preferCloudName ? 'MERGE_INTO_CLOUD_KEEP_CLOUD_NAME' : 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME'
        });
      } else {
        finalTeamsMap.set(id, local);
        if (!hasExistingBaseline || !baselines[id]) {
          autoPushTeams.push(local);
        }
      }
    } else {
      handledLocalIds.add(id);
      finalTeamsMap.set(id, local);
    }
  }

  for (const rid of remoteOrderIds) {
    if (handledLocalIds.has(rid)) continue;
    const remote = normRemoteAll.get(rid);
    if (!remote || remoteDelSet.has(rid)) continue;
    const mode = remote.combatMode === 'show6' ? 'show6' : 'gbl';

    if (localDelSet.has(rid)) {
      const localDelMeta = nextDeletedMeta[rid];
      const localDelAt = localDelMeta?.updatedAt || 0;
      const base = baselines[rid];
      const isCleanUnpushedDelete =
        Boolean(base) &&
        localDelAt > 0 &&
        localDelAt > (remote.updatedAt || 0) &&
        (remote.updatedAt || 0) <= (base?.updatedAt || 0);
      if (!isCleanUnpushedDelete) {
        conflicts.push({
          conflictKey: `local_del|${rid}`,
          kind: 'LOCAL_DELETED_REMOTE_ACTIVE',
          combatMode: mode,
          localTeam: null,
          remoteTeam: remote,
          deletedMeta: {
            id: rid,
            name: localDelMeta?.name || remote.name,
            league: localDelMeta?.league || String(remote.league),
            combatMode: mode,
            updatedAt: localDelAt
          },
          diffLines: [
            `This device deleted "${remote.name}", while Cloud still has it active (${(remote.pokemon || []).slice(0, 3).map((m) => m.name).join(' / ')}).`
          ],
          availableChoices: ['RESTORE_KEEP', 'CONFIRM_DELETE'],
          recommendedChoice: (remote.updatedAt || 0) > localDelAt ? 'RESTORE_KEEP' : 'CONFIRM_DELETE'
        });
      }
      continue;
    }

    if (pairedRemoteDupIds.has(rid)) continue;

    const cleanRemote: TeamPreset = { ...remote, isSelected: false };
    finalTeamsMap.set(rid, cleanRemote);
    nextBaselines[rid] = {
      id: rid,
      sig: computeCanonicalTeamContentSig(cleanRemote),
      name: cleanRemote.name,
      combatMode: mode,
      updatedAt: cleanRemote.updatedAt || 0
    };
    newOrUpdatedCount++;
    mutatedLocally = true;
  }

  for (const delId of remoteDelSet) {
    if (!finalTeamsMap.has(delId)) {
      if (!localDelSet.has(delId)) {
        localDelSet.add(delId);
        mutatedLocally = true;
      }
      delete nextBaselines[delId];
    }
  }

  if (isFullRemoteSnapshot) {
    const conflictTeamIds = new Set<string>();
    for (const c of conflicts) {
      if (c.localTeam?.id) conflictTeamIds.add(c.localTeam.id);
      if (c.remoteTeam?.id) conflictTeamIds.add(c.remoteTeam.id);
    }
    for (const bid of Object.keys(nextBaselines)) {
      if (!finalTeamsMap.has(bid) && !conflictTeamIds.has(bid)) {
        delete nextBaselines[bid];
      }
    }
  }

  const allFinal = Array.from(finalTeamsMap.values());
  return {
    gblTeams: allFinal.filter((t) => t.combatMode !== 'show6'),
    show6Teams: allFinal.filter((t) => t.combatMode === 'show6'),
    deletedTeamIds: Array.from(localDelSet),
    updatedBaselines: nextBaselines,
    updatedDeletedMeta: nextDeletedMeta,
    newOrUpdatedCount,
    mutatedLocally,
    autoPushLocalTeams: Array.from(new Map(autoPushTeams.map((t) => [t.id, t])).values()),
    conflicts
  };
}

export function applyTeamSyncConflictResolutions<TLog extends { presetId?: string; updatedAt?: number }>({
  localGblTeams,
  localShow6Teams,
  localDeletedTeamIds,
  localBaselines,
  localDeletedMeta,
  gblLogs,
  show6Logs,
  conflicts,
  chosenMap
}: {
  localGblTeams: TeamPreset[];
  localShow6Teams: TeamPreset[];
  localDeletedTeamIds: string[];
  localBaselines: Record<string, TeamSyncBaselineRecord>;
  localDeletedMeta: Record<string, DeletedTeamMetaRecord>;
  gblLogs: TLog[];
  show6Logs: TLog[];
  conflicts: TeamSyncDeltaConflict[];
  chosenMap: Record<string, TeamDeltaResolutionChoice>;
}): {
  nextGblTeams: TeamPreset[];
  nextShow6Teams: TeamPreset[];
  nextDeletedIds: string[];
  nextBaselines: Record<string, TeamSyncBaselineRecord>;
  nextDeletedMeta: Record<string, DeletedTeamMetaRecord>;
  nextGblLogs: TLog[];
  nextShow6Logs: TLog[];
  logsChanged: boolean;
  teamsToPush: TeamPreset[];
  deletedTeamIds: string[];
  deletedTeamTimestamps: Record<string, number>;
  trashedLocalTeams: TeamPreset[];
} {
  const nowMs = Date.now();
  let gbl = localGblTeams.map((t) => normalizePresetRecord(t, 'gbl'));
  let show6 = localShow6Teams.map((t) => normalizePresetRecord(t, 'show6'));
  const delSet = new Set<string>(localDeletedTeamIds);
  const baselines: Record<string, TeamSyncBaselineRecord> = { ...localBaselines };
  const delMeta: Record<string, DeletedTeamMetaRecord> = { ...localDeletedMeta };

  const teamsToPush: TeamPreset[] = [];
  const delIdsToPush = new Set<string>();
  const delTimestampsToPush: Record<string, number> = {};
  const redirectByMode: Record<'gbl' | 'show6', Record<string, string>> = { gbl: {}, show6: {} };
  const trashedLocalTeams: TeamPreset[] = [];

  const upsert = (mode: 'gbl' | 'show6', rec: TeamPreset) => {
    const arr = mode === 'show6' ? show6 : gbl;
    const idx = arr.findIndex((p) => p.id === rec.id);
    if (idx >= 0) {
      arr[idx] = { ...rec, isSelected: arr[idx].isSelected };
    } else {
      arr.unshift(rec);
    }
  };

  for (const c of conflicts) {
    const choice = chosenMap[c.conflictKey] || c.recommendedChoice;
    const mode = c.combatMode;
    const local = c.localTeam;
    const remote = c.remoteTeam;

    if (choice === 'USE_CLOUD' && remote) {
      const norm = normalizePresetRecord(remote, mode);
      upsert(mode, norm);
      delSet.delete(norm.id);
      delete delMeta[norm.id];
      baselines[norm.id] = {
        id: norm.id,
        sig: computeCanonicalTeamContentSig(norm),
        name: norm.name,
        combatMode: mode,
        updatedAt: norm.updatedAt || 0
      };
    } else if (choice === 'USE_LOCAL' && local) {
      const bumpTs = Math.max(nowMs, (remote?.updatedAt || 0) + 1);
      const bumped = normalizePresetRecord({ ...local, updatedAt: bumpTs }, mode);
      upsert(mode, bumped);
      delSet.delete(bumped.id);
      delete delMeta[bumped.id];
      teamsToPush.push(bumped);
      baselines[bumped.id] = {
        id: bumped.id,
        sig: computeCanonicalTeamContentSig(bumped),
        name: bumped.name,
        combatMode: mode,
        updatedAt: bumpTs
      };
    } else if (choice === 'MERGE_CLOUD_NAME_LOCAL_BODY' && local && remote) {
      const bumpTs = Math.max(nowMs, Math.max(local.updatedAt || 0, remote.updatedAt || 0) + 1);
      const merged = normalizePresetRecord({ ...local, name: remote.name, updatedAt: bumpTs }, mode);
      upsert(mode, merged);
      delSet.delete(merged.id);
      delete delMeta[merged.id];
      teamsToPush.push(merged);
      baselines[merged.id] = {
        id: merged.id,
        sig: computeCanonicalTeamContentSig(merged),
        name: merged.name,
        combatMode: mode,
        updatedAt: bumpTs
      };
    } else if (choice === 'MERGE_LOCAL_NAME_CLOUD_BODY' && local && remote) {
      const bumpTs = Math.max(nowMs, Math.max(local.updatedAt || 0, remote.updatedAt || 0) + 1);
      const merged = normalizePresetRecord(
        { ...remote, name: local.name, updatedAt: bumpTs, isSelected: local.isSelected },
        mode
      );
      upsert(mode, merged);
      delSet.delete(merged.id);
      delete delMeta[merged.id];
      teamsToPush.push(merged);
      baselines[merged.id] = {
        id: merged.id,
        sig: computeCanonicalTeamContentSig(merged),
        name: merged.name,
        combatMode: mode,
        updatedAt: bumpTs
      };
    } else if (choice === 'KEEP_BOTH') {
      if (remote) {
        const norm = normalizePresetRecord(remote, mode);
        upsert(mode, norm);
        delSet.delete(norm.id);
        baselines[norm.id] = {
          id: norm.id,
          sig: computeCanonicalTeamContentSig(norm),
          name: norm.name,
          combatMode: mode,
          updatedAt: norm.updatedAt || 0
        };
      }
      if (local) {
        const sameId = Boolean(remote && local.id === remote.id);
        const newId = sameId ? `team-copy-${nowMs}-${Math.random().toString(36).slice(2, 7)}` : local.id;
        const baseName = String(local.name || '').trim() || 'Team';
        const cloneName =
          remote && baseName.toLowerCase() === String(remote.name || '').trim().toLowerCase()
            ? `${baseName} (Device Copy)`
            : baseName;
        const cloned = normalizePresetRecord(
          { ...local, id: newId, name: cloneName, isSelected: false, updatedAt: nowMs },
          mode
        );
        if (mode === 'show6') show6.unshift(cloned);
        else gbl.unshift(cloned);
        delSet.delete(cloned.id);
        teamsToPush.push(cloned);
        baselines[cloned.id] = {
          id: cloned.id,
          sig: computeCanonicalTeamContentSig(cloned),
          name: cloned.name,
          combatMode: mode,
          updatedAt: nowMs
        };
      }
    } else if (choice === 'CONFIRM_DELETE') {
      const targetId = local?.id || remote?.id || c.deletedMeta?.id || '';
      if (targetId) {
        if (local) trashedLocalTeams.push(local);
        if (mode === 'show6') show6 = show6.filter((p) => p.id !== targetId);
        else gbl = gbl.filter((p) => p.id !== targetId);
        delSet.add(targetId);
        delete baselines[targetId];
        const delTs = Math.max(nowMs, Math.max(remote?.updatedAt || 0, local?.updatedAt || 0) + 1);
        delMeta[targetId] = {
          id: targetId,
          name: local?.name || remote?.name || c.deletedMeta?.name || '',
          league: String(local?.league || remote?.league || c.deletedMeta?.league || 'GREAT LEAGUE'),
          combatMode: mode,
          updatedAt: delTs
        };
        delIdsToPush.add(targetId);
        delTimestampsToPush[targetId] = delTs;
      }
    } else if (choice === 'RESTORE_KEEP') {
      const cand = local || remote;
      if (cand) {
        const bumpTs = Math.max(nowMs, Math.max(c.deletedMeta?.updatedAt || 0, cand.updatedAt || 0) + 1);
        const restored = normalizePresetRecord({ ...cand, updatedAt: bumpTs }, mode);
        upsert(mode, restored);
        delSet.delete(restored.id);
        delete delMeta[restored.id];
        teamsToPush.push(restored);
        baselines[restored.id] = {
          id: restored.id,
          sig: computeCanonicalTeamContentSig(restored),
          name: restored.name,
          combatMode: mode,
          updatedAt: bumpTs
        };
      }
    } else if (
      (choice === 'MERGE_INTO_CLOUD_KEEP_CLOUD_NAME' || choice === 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME') &&
      local &&
      remote
    ) {
      const keepLocalName = choice === 'MERGE_INTO_CLOUD_KEEP_LOCAL_NAME';
      const bumpTs = Math.max(nowMs, Math.max(local.updatedAt || 0, remote.updatedAt || 0) + 1);
      const merged = normalizePresetRecord(
        keepLocalName ? { ...remote, name: local.name, updatedAt: bumpTs, isSelected: local.isSelected } : { ...remote, isSelected: local.isSelected },
        mode
      );
      if (mode === 'show6') show6 = show6.filter((p) => p.id !== local.id);
      else gbl = gbl.filter((p) => p.id !== local.id);
      upsert(mode, merged);
      delSet.delete(merged.id);
      if (local.id !== merged.id) {
        delSet.add(local.id);
        delete baselines[local.id];
        delMeta[local.id] = {
          id: local.id,
          name: local.name,
          league: String(local.league || 'GREAT LEAGUE'),
          combatMode: mode,
          updatedAt: nowMs
        };
        delIdsToPush.add(local.id);
        delTimestampsToPush[local.id] = nowMs;
        redirectByMode[mode][local.id] = merged.id;
      }
      if (keepLocalName) teamsToPush.push(merged);
      baselines[merged.id] = {
        id: merged.id,
        sig: computeCanonicalTeamContentSig(merged),
        name: merged.name,
        combatMode: mode,
        updatedAt: merged.updatedAt || 0
      };
    }
  }

  let logsChanged = false;
  const remapLogs = (arr: TLog[], map: Record<string, string>): TLog[] => {
    if (Object.keys(map).length === 0) return arr;
    return arr.map((l) => {
      const pid = l.presetId || '';
      const nextPid = map[pid];
      if (!nextPid) return l;
      logsChanged = true;
      return { ...l, presetId: nextPid, updatedAt: Math.max(Number(l.updatedAt) || 0, nowMs) };
    });
  };

  return {
    nextGblTeams: gbl,
    nextShow6Teams: show6,
    nextDeletedIds: Array.from(delSet),
    nextBaselines: baselines,
    nextDeletedMeta: delMeta,
    nextGblLogs: remapLogs(gblLogs, redirectByMode.gbl),
    nextShow6Logs: remapLogs(show6Logs, redirectByMode.show6),
    logsChanged,
    teamsToPush: Array.from(new Map(teamsToPush.map((t) => [t.id, t])).values()),
    deletedTeamIds: Array.from(delIdsToPush),
    deletedTeamTimestamps: delTimestampsToPush,
    trashedLocalTeams
  };
}

export function loadTeamBaselinesWeb(): {
  hasBaseline: boolean;
  baselines: Record<string, TeamSyncBaselineRecord>;
} {
  try {
    const raw = localStorage.getItem(TEAM_SYNC_BASELINES_STORAGE_KEY);
    if (raw === null) return { hasBaseline: false, baselines: {} };
    const parsed = JSON.parse(raw);
    return {
      hasBaseline: true,
      baselines: parsed && typeof parsed === 'object' ? parsed : {}
    };
  } catch {
    return { hasBaseline: false, baselines: {} };
  }
}

export function saveTeamBaselinesWeb(baselines: Record<string, TeamSyncBaselineRecord>): void {
  try {
    localStorage.setItem(TEAM_SYNC_BASELINES_STORAGE_KEY, JSON.stringify(baselines));
  } catch {}
}

export function clearTeamBaselinesWeb(): void {
  try {
    localStorage.removeItem(TEAM_SYNC_BASELINES_STORAGE_KEY);
  } catch {}
}

export function loadDeletedTeamMetaWeb(): Record<string, DeletedTeamMetaRecord> {
  try {
    const raw = localStorage.getItem(DELETED_TEAM_META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDeletedTeamMetaWeb(meta: Record<string, DeletedTeamMetaRecord>): void {
  try {
    const entries = Object.values(meta || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 400);
    const compacted: Record<string, DeletedTeamMetaRecord> = {};
    for (const e of entries) {
      if (e?.id) compacted[e.id] = e;
    }
    localStorage.setItem(DELETED_TEAM_META_STORAGE_KEY, JSON.stringify(compacted));
  } catch {}
}

export function recordLocalTeamDeletionMetaWeb(team: TeamPreset, deletedAtMs: number = Date.now()): void {
  if (!team?.id) return;
  const map = loadDeletedTeamMetaWeb();
  map[team.id] = {
    id: team.id,
    name: String(team.name || '').trim(),
    league: String(team.league || 'GREAT LEAGUE').trim() || 'GREAT LEAGUE',
    combatMode: normTeamCombatMode(team.combatMode, team.id, team.league),
    updatedAt: deletedAtMs
  };
  saveDeletedTeamMetaWeb(map);
}

export function removeLocalTeamDeletionMetaWeb(id: string): void {
  if (!id) return;
  const map = loadDeletedTeamMetaWeb();
  if (Object.prototype.hasOwnProperty.call(map, id)) {
    delete map[id];
    saveDeletedTeamMetaWeb(map);
  }
}
