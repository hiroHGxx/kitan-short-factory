# kitan-short-factory

『月蝕綺譚 -Luna Occulta-』(CryptoNinja外伝)の**二次創作ショート動画**を作るプロジェクト。
公式ファンワークス素材(正典シート・素材蔵・設定資料MCP)を参照して台本を作り、
ComfyUI(MiniMax H3 Turbo)で音声付きクリップを生成、Remotionで 1080x1920 mp4 に編集する。

姉妹プロジェクト `D:\AI\projects\short-video-factory`(おえんちゃんショート、ep001〜017)の
パイプラインを流用して 2026-09-28 に立ち上げた。**あちらは参照元。変更しないこと。**

- 公式ページ: https://vibe.co.jp/luna-occulta/fanworks
- **制作の運用手順: `.claude/skills/kitan-short-factory/SKILL.md`**(動画を作るときはこれに従う)
- 次の検証候補(未着手): `docs/next-music-pose.md`(公式楽曲で動かす × 骨格で演出)
- 生成経路の検討・検証結果: **`docs/pipeline-design.md`**。
  **標準経路 = D案**: codex CLI で起点画像 → Ref2VA+AddGuide(1フレーム目固定)で正典シート+公式ボイス見本を参照(`generate.mjs --ref2v`)。2026-09-28 検証で決定

## 二次創作ガイドライン(必ず守る)

原作「CryptoNinja利用ガイドライン」(https://www.ninja-dao.com/guidelines)に原則従う。要点:

- **公式を名乗らない・公式と誤認させない**(タイトル・サムネ・投稿文すべて)
- キャラクターの尊厳を損なう表現、過度な性的・暴力的・誹謗中傷表現はしない
- **他の人の二次創作物をAIに読み込ませない・トレースしない**(公式の正典シートはAI利用OK)
- 公式素材そのものの再配布・自作と偽ることはしない → 取得した公式素材は `refs/` にキャッシュし、git には入れない
- 投稿時はハッシュタグ **#月蝕綺譚**(公式 @luna_occulta へのメンションは任意)
- 年間売上2,000万円を超える場合は事前相談(本プロジェクトでは想定外)
- ガイドラインは予告なく更新される。投稿前に `get_guidelines`(MCP)または公式ページで最新を確認する

## 公式素材の取り口

| 入口 | 中身 |
|---|---|
| MCP `kitan-lore`(https://kitan-lore-mcp.nubonba.workers.dev/mcp) | キャラ(御霊)プロフィール・口調・セリフ例・正典シート画像・ボイスサンプル、世界観、用語集、デザイントーン(配色・画像生成アンカー)、素材一覧、楽曲+歌詞 |
| MCP `cn-lore`(https://cn-lore-mcp.nubonba.workers.dev/mcp) | 原作CryptoNinjaのキャラ・設定・公式画像(CC0) |
| MCP `yoiyami`(https://vibe.co.jp/yoiyami/mcp) | 宵闇素材庫(CC0素材の検索・ライセンス) |
| 正典シート https://vibe.co.jp/luna-occulta/fanworks/canon | 37キャラ×189枚。立ち絵・三面図+表情・ちびシート・衣装違い(WebP、AI読み込みOK) |
| 素材蔵 https://vibe.co.jp/luna-occulta/fanworks/assets | ロゴ、ボイスサンプル(WAV)、楽曲14曲(動画BGM・主題歌として使用OK)、札絵・紹介動画・カットイン等 |

MCPは認証不要のHTTPサーバー。接続: `claude mcp add --transport http kitan-lore https://kitan-lore-mcp.nubonba.workers.dev/mcp`(cn-lore / yoiyami も同様)

## フォルダ構成

| パス | 役割 |
|---|---|
| `comfyui/video_minimax_h3_ref2v_guide_turbo.json` | **標準**。Ref2VA+AddGuide(D案)。Ref2V Turbo LoRA v1.0 768p rank64 / 8steps。10秒で約5分・VRAMピーク11.7GB |
| `comfyui/video_minimax_h3_ref2v_turbo.json` | Ref2VA 参照のみ(B案・比較用) |
| `comfyui/video_minimax_h3_i2v.json` / `_turbo.json` | H3 i2v(FL2VA)雛形(A案)。Turboは FL2V turbo v1.2 4steps |
| `scripts/generate.mjs` | script.json の全カットをComfyUIへ投入し `assets/cut{N}_{slug}.mp4` を回収。`--ref2v`(標準) / `--turbo` / `--only` / `--collect` |
| `scripts/render.mjs` | Remotionで `out/{episode_slug}.mp4` と作品ノートを書き出す |
| `scripts/extract-frames.mjs` | 各カットの中間・終盤フレームを `check/` に抽出 |
| `scripts/new-episode.mjs` | `episodes/epNNN_{slug}/{inputs,assets,out}` を作成 |
| `templates/` | script.json スキーマ(`refs`=参照シート・ボイス)、h3_prompt 7ブロック構造(本作の画風維持文・References)、codex 起点画像依頼文雛形 |
| `renderer/` | Remotionプロジェクト(`npm install` が必要) |
| `refs/` | 公式素材のローカルキャッシュ(git管理外) |
| `docs/` | 設計・検証メモ |
| `episodes/` | 作品フォルダ |

## 前提・注意(姉妹プロジェクトから継承)

- ComfyUI(`D:\AI\ComfyUI_windows_portable\ComfyUI`、v0.37.0)が http://127.0.0.1:8188 で起動している必要がある
- GPUは RTX 4070 SUPER 12GB。ComfyUIは `--reserve-vram 2.0` で起動
- ワークフロー雛形の差し替えノードID(i2v): プロンプト=`105:104`, 画像=`114`, seed=`105:15`, 尺(秒)=`105:111`, 解像度=`115`, 保存プレフィックス=`92`
- 同(ref2v_guide): プロンプト=`136`, 起点画像=`157`(AddGuide `147` で frame 0), seed=`129`, 尺(秒)=`132`, 解像度=`115`, 保存=`92`。参照画像・音声ノードは `cut.refs` から generate.mjs が作り直す
- セリフの文字起こし確認: `D:/AI/tools/whisper.cpp`(冒頭の短い語を落とすことがあるので最終判定は耳で)
- カット尺: H3は `max(5, round(秒*24))` を17系に丸めたフレーム数(24fps)。10秒指定は実尺10.125秒
- 監視プロセスが落ちても ComfyUI のキューは継続する → 再投入せず `generate.mjs --collect` で回収
- ComfyUIのバージョンが変わると同一seedでも別の絵になる

## コマンド早見

```bash
node scripts/new-episode.mjs ep001_{slug}
node scripts/generate.mjs episodes/ep001_{slug} --ref2v
node scripts/generate.mjs episodes/ep001_{slug} --collect
node scripts/extract-frames.mjs episodes/ep001_{slug}
node scripts/render.mjs episodes/ep001_{slug}
```
