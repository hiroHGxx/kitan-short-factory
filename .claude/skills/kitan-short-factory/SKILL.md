---
name: kitan-short-factory
description: 『月蝕綺譚 -Luna Occulta-』の二次創作ショート動画(1080x1920・音声付き)を作るパイプラインの運用手順。公式素材の取得(MCP)→台本→起点画像(codex)→ComfyUI(Ref2VA+AddGuide、正典シート+公式ボイス参照)生成→チェック→Remotion編集→投稿前確認。動画を作りたい・エピソードを追加したい・カットを再生成したいときに使う。
---

# kitan-short-factory 運用手順

キャラ・テーマ → 公式素材取得 → 台本 → 起点画像 → H3生成(D案)→ チェック → 編集出力 → 投稿前確認。
生成経路を D案(Ref2VA+AddGuide)に決めた経緯は `docs/pipeline-design.md` §6。

## 二次創作ガイドライン(全工程で守る)

- **公式を名乗らない・公式と誤認させない**(タイトル・テロップ・投稿文・サムネすべて)
- キャラの品位を損なう・過度に性的/猟奇的/中傷的な表現はしない。口調・一人称・呼び方は `get_spirit` の正典に従う
- **AIに読み込ませてよいのは公式の正典シート・ボイス見本だけ**。他人の二次創作物は添付・参照しない
- 公式素材そのものを再配布しない → `refs/` と `episodes/*/inputs/` は git 管理外(`.gitignore` 済み)。公開リポジトリにしない
- 投稿時はハッシュタグ **#月蝕綺譚**。ガイドラインは予告なく更新されるので投稿前に `get_guidelines` で再確認(手順6)

## モード選択(最初に必ず決める)

制作開始時にユーザーへ **どちらのモードで進めるか確認する**(依頼文で明示されていればそれに従う。
「おまかせ」「全自動」「一気に」→ フルオート、「じっくり」「確認しながら」→ チェックあり):

| | **チェックありモード(既定)** | **フルオートモード** |
|---|---|---|
| 台本 | ドラフト提示→**承認を待つ** | 提示のみで続行 |
| 起点画像 | 生成後ユーザー確認→**承認を待つ** | Claudeが目視チェックのみで続行 |
| クリップ | ユーザーが視聴→**全カットOKを待つ** | フレーム抽出の自動チェックのみ |
| 完成品 | 最終確認 | 完成後にまとめて報告・視聴依頼 |

- どちらのモードでも、**破綻を見つけたら seed 変更で再生成**(手順4)は同じ
- **音声(声・発音・イントネーション・リップシンク)は自動チェックできない**。本作は公式ボイスへの寄せ方が
  見どころなので、フルオートでも完成後に必ずユーザーの視聴確認を依頼する
- チェックありモードでは各ステップで必ず承認を待ち、勝手に次へ進まない

**フルオート中のYES/NO自動判定ルール:** ユーザーにYES/NOで聞きたくなった確認は質問せずYESとみなして続行し、
選んだ内容と理由を完成報告にまとめる(事後報告方式)。例外(フルオートでも必ず質問する):
- 既存ファイル・完成済みエピソードの削除や上書き
- SNS投稿など外部公開に関わる操作
- 大きなダウンロードや、全カット作り直しの繰り返しなど追加コストが想定外に大きい操作

## 0. 事前確認(毎回最初にやる)

1. ComfyUI が起動しているか: `GET http://127.0.0.1:8188/system_stats`。応答がなければ起動を依頼して待つ
2. MCP `kitan-lore` が使えるか(ツール一覧に `mcp__kitan-lore__*` があるか)。無ければ登録をユーザーに依頼する
   (`claude mcp add --transport http kitan-lore https://kitan-lore-mcp.nubonba.workers.dev/mcp`。
   **自分では実行しない**。登録後は Claude Code の再起動が必要)

## 1. 公式素材の取得

登場キャラごとに:

1. `get_spirit`(名前): 一人称・呼び方・口調・セリフ例・正典シートURL・**voice_sample**
   - `voice_sample.kind` が **irodori** なら WAV あり(`audio_url`)→ <Audio> 参照できる
   - **elevenlabs**(例: 於兎)なら WAV なし → `refs.audios` を空にし、声は言葉(voice_design_caption 相当)で指定する
2. 正典立ち絵(`{id}_canon.webp`)・三面図シート(`{id}_sheet.webp`)・ボイス見本を `refs/{id}/` にキャッシュ
   (既にあれば再取得不要)。URL は `https://vibe.co.jp/luna-occulta/media/img/canon/{id}_{kind}.webp`、
   `https://vibe.co.jp/luna-occulta/media/voice/{id}_sample.wav`
3. 正典立ち絵を Read で目視し、髪型・髪色・瞳・服装・持ち物・特徴パーツ(耳・尾・羽・ほくろ等)を把握する
   (Scene の記述と起点画像チェックに使う)
4. 必要に応じて `get_worldview` / `get_game_terms` / `search_lore`(設定・用語)、`get_design_tone`(トンマナ)

エピソードフォルダを作り、使う素材を `inputs/` にコピーする:

```
node scripts/new-episode.mjs epNNN_{slug}
cp refs/{id}/{id}_canon.webp refs/{id}/{id}_sheet.webp refs/{id}/{id}_sample.wav episodes/epNNN_{slug}/inputs/
```

(`episodes/ep000_*` は経路検証用。本番は ep001 から)

## 2. 台本ドラフト

`templates/script.schema.json` に従って `episodes/epNNN_{slug}/script.json` を書く。

- **h3_prompt は `templates/h3_prompt_template.md` の7ブロック構造**(画風維持文 → References → Scene →
  Motion storyboard → Camera → Audio → ネガティブ指示)。完全な実例は `episodes/ep000_sakuya-engawa/script.json`
- **各カットに `refs` を書く**: `{"images": ["inputs/{id}_canon.webp", "inputs/{id}_sheet.webp"], "audios": ["inputs/{id}_sample.wav"]}`。
  References ブロックの <Picture N> / <Audio N> はこの並び順に対応する
- **尺感**: 10秒カットと5秒カットの混合を基本にする(全カット同尺は単調)。H3の最低尺は5秒。
  セリフは10秒カットに乗せる。1区間1アクション、動きは小さくゆっくり(公式トンマナも「お淑やかに」)
- **セリフ**:
  - 口調・一人称・呼び方は `get_spirit` の正典どおり。セリフ例をそのまま使わず、口調に沿って創作する
  - 1カット1〜2文。**5.5秒開始なら3〜4秒で言い切れる長さ**(10秒に収まらないと切れる)
  - **冒頭に「あ、」等の一拍を付けない**(Ref2VAでは二重に響き、誤発音を誘発した)
  - 誤読しそうな語は `(来た来た is pronounced "kita kita")` のように読みを添える
  - タイミングと声質を Motion storyboard と Audio の両方に書く
- **テロップ**: 短い体言止め(例:「月蝕の夜。」)。語彙は世界観に寄せる(`get_design_tone` の words: 式札・御霊・第◯夜 等)
- **世界のトーン**: 宵闇藍の夜・金は線と粒・暗紫の夜桜・赤は5%以下。昼・白背景・祭りの提灯/屋台はNG
- **小物**: 正典に描かれた持ち物(ナルカの羽扇等)は可。正典に無い小物は浮く・破綻するので極力書かない
- 起点画像は `input_image` に `inputs/cut{N}_{slug}.png`。seed はカットごとに別の値にする
- `concept` に作品の意図・見どころを日本語数文で(作品ノート→SNS投稿文の材料)

**チェックありモード: ドラフトを提示してユーザーの承認を得てから次へ進む。**

## 3. 起点画像(codex CLI)

D案では起点画像が1フレーム目に固定され、**トーンと構図を担う**(起点画像なしだと桜が淡ピンク・空が青くなる)。

1. `templates/base_image_prompt_template.md` の依頼文に各カットの場面を差し込み、`inputs/prompt_images.txt` に書く
2. codex を実行(バックグラウンド推奨、1枚約2分)。**全カットを1セッションにまとめる**。
   プロンプトは必ずファイル+stdin渡し(末尾の `-`):
   ```
   cd episodes/epNNN_{slug}
   codex exec --skip-git-repo-check -s workspace-write \
     -i <絶対パス>/inputs/{id}_canon.webp -i <絶対パス>/inputs/{id}_sheet.webp \
     - < inputs/prompt_images.txt
   ```
   複数キャラなら全員の canon+sheet を添付し、依頼文に添付順を明記する
3. 全枚を Read で目視: 正典との一致(顔・髪・特徴パーツ・服装)、宵闇のトーン、
   **姿勢・構図が Motion storyboard の開始状態と一致するか**。ズレたら h3_prompt 側を画像に合わせる
4. リテイクしたい画像だけ個別に再依頼する

**チェックありモード: 画像をユーザーに見せて承認を待つ。**

## 4. 生成投入とクリップチェック

```
node scripts/generate.mjs episodes/epNNN_{slug} --ref2v
```

- 全カットを一括キュー投入し、完了順に `assets/cut{N}_{slug}.mp4` へ回収する
- **10秒カットで約5分/本**(Ref2V Turbo LoRA 8step)。VRAMピーク約11.7GB/12GBなので、生成中は他のGPU処理を止めてもらう。
  バックグラウンド実行にして「放置でよい」ことを伝える
- 動画はユーザーに `SendUserFile` で送る(スマホのリモコン画面から見ていることがある。上限30MB)

**チェック:**
- 映像: `node scripts/extract-frames.mjs episodes/epNNN_{slug}` → `check/` のフレームを Read で目視
  (正典との一致・トーン・破綻)
- 音声: 参考として whisper.cpp(CPU版)で文字起こしできる。16kHzモノラルWAVに変換してから:
  ```
  FF=renderer/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe
  $FF -y -i assets/cut1_x.mp4 -ar 16000 -ac 1 check/cut1_x.16k.wav
  D:/AI/tools/whisper.cpp/Release/whisper-cli.exe -m D:/AI/tools/whisper.cpp/models/ggml-large-v3-turbo-q5_0.bin -l ja -np -f check/cut1_x.16k.wav
  ```
  **冒頭の短い語を落とすので「言っていない」判定には使わない。最終判定はユーザーの耳**
- 検証で出た発音の粗: 助詞の混入(「お団子**が**食べようよ」)、お嬢様口調の片言・不自然なイントネーション。
  軽微ならユーザー判断で許容、気になるなら seed 変更 → それでもダメならセリフ言い換え

**破綻カットは seed だけ変えて再生成する**(プロンプト起因と判断できるときだけユーザーと相談して修正):

```
node scripts/generate.mjs episodes/epNNN_{slug} --ref2v --only {cutのslug}
```

**チェックありモード: ユーザーの全カットOKが出るまで次へ進まない。**

## 5. 編集出力(render.mjs)

```
node scripts/render.mjs episodes/epNNN_{slug}
```

- `out/{episode_slug}.mp4`(1080x1920, 30fps)と作品ノート `out/{episode_slug}_notes.md` が出る
- script.json の `render.layout` は `"fullbleed"`(9:16 を画面いっぱい)を使う
- **未調整(ep001 で対応する)**: renderer は姉妹プロジェクトの見た目のまま
  (背景=生成りのクリーム `#F7F2E8`・文字=焦げ茶・丸ゴシック系)。本作のトンマナ(宵闇藍・金泥 `#D9A94C`・
  Shippori Mincho B1)に合わせるか、初回レンダリング時にユーザーと決める。BGM(素材蔵の公式楽曲は使用OK)を
  入れる機能もまだ無い

## 6. 投稿前確認(公開はユーザーが行う)

- `get_guidelines` で最新ガイドラインを確認し、変更があればユーザーに伝える
- タイトル・テロップ・投稿文に「公式」を名乗る/誤認させる表現がないか
- 投稿文にハッシュタグ **#月蝕綺譚**(公式 @luna_occulta へのメンションは任意)
- SNS投稿そのものはユーザーが行う(Claudeは投稿文の案まで)

## トラブルシューティング

- ComfyUI側エラー: generate.mjs が history のエラー内容を表示する。VRAM不足なら他の生成を止めてもらう
- **generate.mjs の監視プロセスが途中で落ちた場合**、ComfyUI側のキューは走り続けている。
  **再投入はせず**(二重投入になる)回収だけ行う: `node scripts/generate.mjs episodes/epNNN_{slug} --collect`
- 生成が40分超でタイムアウトしたら ComfyUI のキュー詰まりを疑う(http://127.0.0.1:8188 をブラウザで確認)
- ComfyUI のバージョンが変わると同一seedでも別の絵になる
- Remotion 同梱の ffmpeg(`renderer/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`)には
  hstack 等のフィルタが無い。フレームの比較は1枚ずつ Read する
- レンダリング確認を Studio でしたいとき: `cd renderer && npx remotion studio --public-dir=../episodes/epNNN_{slug}`
