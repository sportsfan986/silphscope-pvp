import JSZip from 'jszip';
import manifestContent from '../../AndroidManifest.xml?raw';
import rootGradleContent from '../../build.gradle.kts?raw';
import appGradleContent from '../../app/build.gradle.kts?raw';
import mainActivityContent from '../../app/src/main/java/com/gbl/overlay/MainActivity.kt?raw';
import overlayServiceContent from '../../app/src/main/java/com/gbl/overlay/OverlayService.kt?raw';
import overlayHtmlContent from '../../app/src/main/assets/overlay.html?raw';
import activityMainXmlContent from '../../app/src/main/res/layout/activity_main.xml?raw';
import itemTeamPresetXmlContent from '../../app/src/main/res/layout/item_team_preset.xml?raw';
import dialogCreatePresetXmlContent from '../../app/src/main/res/layout/dialog_create_preset.xml?raw';
import bgEmblemInstinctXmlContent from '../../app/src/main/res/drawable/bg_emblem_instinct.xml?raw';
import bgEmblemMysticXmlContent from '../../app/src/main/res/drawable/bg_emblem_mystic.xml?raw';
import bgEmblemValorXmlContent from '../../app/src/main/res/drawable/bg_emblem_valor.xml?raw';
import bgEmblemSylveonXmlContent from '../../app/src/main/res/drawable/bg_emblem_sylveon.xml?raw';
import icBattleFrontierLogoXmlContent from '../../app/src/main/res/drawable/ic_battle_frontier_logo.xml?raw';
import icGblLogoXmlContent from '../../app/src/main/res/drawable/ic_gbl_logo.xml?raw';

export interface AndroidProjectFile {
  path: string;
  name: string;
  category: 'manifest' | 'gradle' | 'kotlin' | 'html' | 'layout';
  description: string;
  content: string;
}

export const ANDROID_FILES: AndroidProjectFile[] = [
  {
    path: "AndroidManifest.xml",
    name: "AndroidManifest.xml",
    category: "manifest",
    description: "Declares SYSTEM_ALERT_WINDOW, MediaProjection foreground service, and network permissions.",
    content: manifestContent
  },
  {
    path: "build.gradle.kts",
    name: "build.gradle.kts (Root)",
    category: "gradle",
    description: "Root Gradle configuration with Kotlin 2.0.0 and Android Gradle Plugin 8.5.2.",
    content: rootGradleContent
  },
  {
    path: "app/build.gradle.kts",
    name: "app/build.gradle.kts",
    category: "gradle",
    description: "App module Gradle dependencies (v5.00) including ML Kit Text Recognition, OkHttp, and Gson.",
    content: appGradleContent
  },
  {
    path: "app/src/main/java/com/gbl/overlay/MainActivity.kt",
    name: "MainActivity.kt",
    category: "kotlin",
    description: "Manages permissions, Standard GBL vs. Show 6 Mode toggle, Teams of 6 & Teams of 3, Dual Show 6 Team Builders, per-league persisted Whitelist/Banlist, and overlay launch.",
    content: mainActivityContent
  },
  {
    path: "app/src/main/java/com/gbl/overlay/OverlayService.kt",
    name: "OverlayService.kt",
    category: "kotlin",
    description: "Foreground service with Show 6 Pick-3 & Blind Show 6 engines, known Opponent 6 backline AI constraint, independent Show 6 battle logs, and 3v3 shield/damage matrix.",
    content: overlayServiceContent
  },
  {
    path: "app/src/main/assets/overlay.html",
    name: "overlay.html (Assets)",
    category: "html",
    description: "Ultra-transparent glass HUD with theme accent tinting, Reset Opp, Shadow/Form toggles, 3-letter damage rows, and static throw turn reminders.",
    content: overlayHtmlContent
  },
  {
    path: "app/src/main/res/layout/activity_main.xml",
    name: "activity_main.xml",
    category: "layout",
    description: "Main activity UI layout with GBL/Battle Frontier mode logos, Show 6 Mode Hub (6v6 Pick-3 & Blind Show 6 Builders), Settings Combat Mode toggle, and team presets list.",
    content: activityMainXmlContent
  },
  {
    path: "app/src/main/res/layout/item_team_preset.xml",
    name: "item_team_preset.xml",
    category: "layout",
    description: "Team preset card layout with Edit Moves and Delete actions.",
    content: itemTeamPresetXmlContent
  },
  {
    path: "app/src/main/res/layout/dialog_create_preset.xml",
    name: "dialog_create_preset.xml",
    category: "layout",
    description: "Preset & moveset editor dialog for customizing all 3 Pokémon slots and their Fast/Charged moves.",
    content: dialogCreatePresetXmlContent
  }
];

export async function downloadAndroidProjectZip(): Promise<Blob> {
  const zip = new JSZip();

  zip.file("AndroidManifest.xml", manifestContent);
  zip.file("build.gradle.kts", rootGradleContent);
  zip.file("settings.gradle.kts", `rootProject.name = "SilphScopePvP"\ninclude(":app")\n`);

  const app = zip.folder("app");
  if (app) {
    app.file("build.gradle.kts", appGradleContent);

    const main = app.folder("src")?.folder("main");
    if (main) {
      main.file("AndroidManifest.xml", manifestContent);

      const javaGbl = main.folder("java")?.folder("com")?.folder("gbl")?.folder("overlay");
      if (javaGbl) {
        javaGbl.file("MainActivity.kt", mainActivityContent);
        javaGbl.file("OverlayService.kt", overlayServiceContent);
      }

      const assets = main.folder("assets");
      if (assets) {
        assets.file("overlay.html", overlayHtmlContent);
      }

      const res = main.folder("res");
      if (res) {
        const layout = res.folder("layout");
        if (layout) {
          layout.file("activity_main.xml", activityMainXmlContent);
          layout.file("item_team_preset.xml", itemTeamPresetXmlContent);
          layout.file("dialog_create_preset.xml", dialogCreatePresetXmlContent);
        }
        const drawable = res.folder("drawable");
        if (drawable) {
          drawable.file("bg_emblem_instinct.xml", bgEmblemInstinctXmlContent);
          drawable.file("bg_emblem_mystic.xml", bgEmblemMysticXmlContent);
          drawable.file("bg_emblem_valor.xml", bgEmblemValorXmlContent);
          drawable.file("bg_emblem_sylveon.xml", bgEmblemSylveonXmlContent);
          drawable.file("ic_battle_frontier_logo.xml", icBattleFrontierLogoXmlContent);
          drawable.file("ic_gbl_logo.xml", icGblLogoXmlContent);
        }
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}
