#!/usr/bin/env node
/**
 * generate.mjs — ComfyUI (MiniMax H3 i2v) へエピソードの全カットを投入し、mp4を回収する
 *
 * 使い方:
 *   node scripts/generate.mjs episodes/ep001_chiisana-ichinichi
 *   node scripts/generate.mjs episodes/ep001_chiisana-ichinichi --only cut2   # slug指定で再生成
 *   node scripts/generate.mjs episodes/ep001_chiisana-ichinichi --turbo       # Turbo LoRA雛形(v1.2・4steps)で高速生成
 *   node scripts/generate.mjs episodes/ep001_chiisana-ichinichi --turbo-v4    # 旧Turbo LoRA(v4_step600・8steps)。比較・切り戻し用
 *   node scripts/generate.mjs episodes/ep001_chiisana-ichinichi --collect     # 投入済みジョブの回収のみ(再投入しない)
 *
 * --collect: 投入時に assets/.jobs.json へ記録した prompt_id を読み、完了を待って回収する。
 *   監視プロセスが途中で落ちても ComfyUI 側のキューは走り続けるので、これで拾い直せる。
 *
 * 前提:
 *   - ComfyUI が http://127.0.0.1:8188 で起動中
 *   - エピソードフォルダに script.json があり、起点画像は inputs/ に置く
 *   - 出力は assets/cut{N}_{slug}.mp4 に保存(既存ファイルは上書き)
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const COMFY = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_TEMPLATE = path.join(ROOT, "comfyui", "video_minimax_h3_i2v.json");
const WORKFLOW_TEMPLATE_TURBO = path.join(ROOT, "comfyui", "video_minimax_h3_i2v_turbo.json");
const WORKFLOW_TEMPLATE_TURBO_V4 = path.join(ROOT, "comfyui", "video_minimax_h3_i2v_turbo_v4.json");

// ワークフロー内の差し替え対象ノードID
const NODE = {
  prompt: "105:104",   // MiniMaxH3ImageToVideo .inputs.prompt
  image: "114",        // LoadImage .inputs.image
  seed: "105:15",      // RandomNoise .inputs.noise_seed
  duration: "105:111", // PrimitiveFloat .inputs.value (秒)
  resolution: "115",   // ResolutionSelector .inputs.aspect_ratio / .megapixels
  save: "92",          // SaveVideo .inputs.filename_prefix
};

const POLL_INTERVAL_MS = 10_000;          // 10秒ごとにポーリング
const CUT_TIMEOUT_MS = 40 * 60 * 1000;    // 1カット40分でタイムアウト(通常10分程度)

function log(msg) {
  const t = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  console.log(`[${t}] ${msg}`);
}

function elapsed(startMs) {
  const s = Math.round((Date.now() - startMs) / 1000);
  return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${options?.method ?? "GET"} ${url} -> HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

async function checkComfy() {
  try {
    await fetchJson(`${COMFY}/system_stats`);
  } catch (e) {
    throw new Error(`ComfyUI (${COMFY}) に接続できません。起動しているか確認してください。\n  ${e.message}`);
  }
}

/** 画像を ComfyUI にアップロードし、LoadImage で参照する名前を返す */
async function uploadImage(filePath) {
  const buf = await fs.readFile(filePath);
  const form = new FormData();
  form.append("image", new Blob([buf]), path.basename(filePath));
  form.append("overwrite", "true");
  const json = await fetchJson(`${COMFY}/upload/image`, { method: "POST", body: form });
  return json.subfolder ? `${json.subfolder}/${json.name}` : json.name;
}

/** history エントリから出力動画ファイル(.mp4等)の一覧を抽出 */
function collectOutputVideos(historyEntry) {
  const found = [];
  for (const nodeOutput of Object.values(historyEntry.outputs ?? {})) {
    for (const files of Object.values(nodeOutput)) {
      if (!Array.isArray(files)) continue;
      for (const f of files) {
        if (f && typeof f === "object" && typeof f.filename === "string" &&
            /\.(mp4|webm|mov|mkv)$/i.test(f.filename)) {
          found.push(f);
        }
      }
    }
  }
  return found;
}

/** 完了までポーリングし、history エントリを返す */
async function waitForCompletion(promptId, label) {
  const start = Date.now();
  while (Date.now() - start < CUT_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const history = await fetchJson(`${COMFY}/history/${promptId}`);
    const entry = history[promptId];
    if (!entry) {
      log(`${label}: 生成中... (経過 ${elapsed(start)})`);
      continue;
    }
    const status = entry.status ?? {};
    if (status.status_str === "error") {
      const messages = JSON.stringify(status.messages ?? [], null, 2);
      throw new Error(`${label}: ComfyUI 側でエラーが発生しました:\n${messages}`);
    }
    if (status.completed) {
      log(`${label}: 完了 (所要 ${elapsed(start)})`);
      return entry;
    }
    log(`${label}: 生成中... (経過 ${elapsed(start)})`);
  }
  throw new Error(`${label}: タイムアウト(${CUT_TIMEOUT_MS / 60000}分)。ComfyUIのキューを確認してください。`);
}

/** /view から出力ファイルをダウンロードして保存 */
async function downloadOutput(fileInfo, destPath) {
  const params = new URLSearchParams({
    filename: fileInfo.filename,
    subfolder: fileInfo.subfolder ?? "",
    type: fileInfo.type ?? "output",
  });
  const res = await fetch(`${COMFY}/view?${params}`);
  if (!res.ok) throw new Error(`出力ダウンロード失敗: ${fileInfo.filename} (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buf);
  return buf.length;
}

/** 投入順に完了を待って assets/ へ回収(ComfyUI側は直列実行) */
async function collectJobs(jobs, episodeDir) {
  const startAll = Date.now();
  const results = [];
  for (const job of jobs) {
    const entry = await waitForCompletion(job.promptId, job.label);
    const videos = collectOutputVideos(entry);
    if (videos.length === 0) {
      throw new Error(`${job.label}: 完了しましたが出力動画が見つかりません。history を確認してください。`);
    }
    const dest = path.join(episodeDir, "assets", `cut${job.cut.index}_${job.cut.slug}.mp4`);
    const bytes = await downloadOutput(videos[0], dest);
    log(`${job.label}: 回収 -> ${path.relative(ROOT, dest)} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    results.push(dest);
  }

  log(`全${jobs.length}カット完了 (合計 ${elapsed(startAll)})`);
  for (const r of results) console.log(`  ${r}`);
}

async function main() {
  const args = process.argv.slice(2);
  const turboV4 = args.includes("--turbo-v4");
  if (turboV4) args.splice(args.indexOf("--turbo-v4"), 1);
  const turbo = args.includes("--turbo");
  if (turbo) args.splice(args.indexOf("--turbo"), 1);
  const collectOnly = args.includes("--collect");
  if (collectOnly) args.splice(args.indexOf("--collect"), 1);
  const onlyIdx = args.indexOf("--only");
  const onlySlug = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
  const positional = onlyIdx >= 0 ? args.filter((a, i) => i !== onlyIdx && i !== onlyIdx + 1) : args;
  const episodeDir = path.resolve(positional[0] ?? "");
  if (!args[0]) {
    console.error("使い方: node scripts/generate.mjs <episodesフォルダ> [--only <cut slug>] [--turbo | --turbo-v4] [--collect]");
    process.exit(1);
  }

  const scriptPath = path.join(episodeDir, "script.json");
  const script = JSON.parse(await fs.readFile(scriptPath, "utf8"));
  const jobsPath = path.join(episodeDir, "assets", ".jobs.json");

  if (collectOnly) {
    await checkComfy();
    const saved = JSON.parse(await fs.readFile(jobsPath, "utf8").catch(() => {
      throw new Error(`${path.relative(ROOT, jobsPath)} がありません。先に通常の投入を行ってください。`);
    }));
    log(`回収モード: ${saved.length}カット分の投入済みジョブを回収します`);
    await collectJobs(saved, episodeDir);
    return;
  }

  const templatePath = turboV4 ? WORKFLOW_TEMPLATE_TURBO_V4 : turbo ? WORKFLOW_TEMPLATE_TURBO : WORKFLOW_TEMPLATE;
  const template = JSON.parse(await fs.readFile(templatePath, "utf8"));
  if (turbo) log("Turbo LoRA モード (v1.2 / 4 steps / euler / beta)");
  if (turboV4) log("旧Turbo LoRA モード (v4_step600 / 8 steps / euler / beta)");
  await checkComfy();

  let cuts = script.cuts.map((cut, i) => ({ ...cut, index: i + 1 }));
  if (onlySlug) {
    const slugs = onlySlug.split(",");
    cuts = cuts.filter((c) => slugs.includes(c.slug));
    if (cuts.length !== slugs.length) throw new Error(`--only ${onlySlug}: script.json に該当しないカットがあります`);
  }

  log(`エピソード: ${script.title} (${script.episode_slug}) — ${cuts.length}カットを投入します`);

  // 1) 起点画像をアップロードし、全カットをキュー投入
  const jobs = [];
  for (const cut of cuts) {
    const label = `カット${cut.index}/${script.cuts.length} [${cut.slug}]`;
    const imagePath = path.resolve(episodeDir, cut.input_image);
    const uploadedName = await uploadImage(imagePath);
    log(`${label}: 画像アップロード完了 (${uploadedName})`);

    const wf = structuredClone(template);
    wf[NODE.prompt].inputs.prompt = cut.h3_prompt;
    wf[NODE.image].inputs.image = uploadedName;
    wf[NODE.seed].inputs.noise_seed = cut.seed;
    wf[NODE.duration].inputs.value = cut.duration_sec;
    wf[NODE.save].inputs.filename_prefix = `video/${script.episode_slug}/cut${cut.index}_${cut.slug}`;
    // 解像度はエピソード共通設定(script.json の resolution)があれば上書き
    if (script.resolution?.aspect_ratio) wf[NODE.resolution].inputs.aspect_ratio = script.resolution.aspect_ratio;
    if (script.resolution?.megapixels) wf[NODE.resolution].inputs.megapixels = script.resolution.megapixels;

    const queued = await fetchJson(`${COMFY}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: wf }),
    });
    log(`${label}: キュー投入 (prompt_id=${queued.prompt_id})`);
    jobs.push({ cut, label, promptId: queued.prompt_id });
  }

  // 監視が途中で落ちても --collect で拾い直せるよう prompt_id を記録
  await fs.mkdir(path.dirname(jobsPath), { recursive: true });
  await fs.writeFile(jobsPath, JSON.stringify(jobs.map((j) => ({
    label: j.label, promptId: j.promptId, cut: { index: j.cut.index, slug: j.cut.slug },
  })), null, 2));

  // 2) 投入順に完了を待って回収
  await collectJobs(jobs, episodeDir);
}

main().catch((e) => {
  console.error(`\nエラー: ${e.message}`);
  process.exit(1);
});
