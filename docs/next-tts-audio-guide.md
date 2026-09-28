# 次の検証: セリフ音声を先に TTS で作り、AddGuide で動画に当てる(2026-09-28 記録・未着手)

きっかけ: ユーザーが X で見かけた「Opus 5.5 × GPT Image 2.5 × Gemini 3.8 Flash TTS でショート動画量産」の投稿。
TTS の選び方(Gemini は有料か/ElevenLabs でよいか/音声を後から当てられるか)を検討し、
**次のセッションで試す**(2026-09-28 ユーザー合意)。`docs/next-music-pose.md`(楽曲で動かす)と同じ仕組みなので一緒に進める。

## 検討結果(2026-09-28 時点。料金・規約は変わるので着手時に再確認)

### TTS の比較
| 候補 | 費用 | 公式ボイスへの近さ | 手元で完結 |
|---|---|---|---|
| **Irodori-TTS(推奨)** | 無料(MIT・商用可) | ◎ 公式ボイス見本と同じ作り方 | ○ |
| ElevenLabs | 声のコピー(IVC)と商用利用は Starter $6/月〜。Free は両方不可 | ○ Voice ID 配布キャラは公式の声そのもの | × |
| Gemini 3.8 Flash TTS | 無料枠あり(内容は製品改善に使われる)。有料は text $0.50・audio $9.00 /1Mトークン(2027-01から倍) | △ 声のコピーに同意音声が必要 → 公式の声は再現できない | × |

- **Irodori-TTS**: 公式ボイス見本(`get_spirit` の voice_sample.kind=irodori)は Irodori-TTS に voice_design_caption と seed を
  渡して作られている。`Aratako/Irodori-TTS-600M-v3-VoiceDesign` は **参照音声で声をコピーしつつ、説明文で感情・話し方を指示**できる
  日本語TTS。コード・重みとも MIT。600M なので 4070 SUPER で十分動く見込み
  - https://huggingface.co/Aratako/Irodori-TTS-600M-v3-VoiceDesign / https://github.com/Aratako/Irodori-TTS
- **ElevenLabs**: kind=elevenlabs のキャラ(於兎・サスラ等)は公式が Voice ID を配布 →「自分のアカウントで Voice ID を指定して使う」正規ルート。
  WAV 配布キャラを IVC で複製するのも公式ライセンス上は可(「AIに読み込ませてOK・キャラボイス制作可」)。ElevenLabs 規約にも従う
- **Gemini TTS**: Voice Replication は「reference and consent audio」が必要。公式ボイスは合成音声で同意音声を用意できない。
  Voice Design(説明文から声を作る)は使えるが別の声になる。プリセット30声(Kore 等)は日本語対応
  - get_spirit の仕様上「Gemini TTS の声の名前」が指定されるキャラもあり得る(未特定。使うキャラで要確認)

### 音声を後から当てる方法
- **AddGuide の audio 入力に TTS 音声を渡す**(frame 0 起点)→ H3 がその音声に口を合わせて動画を作る見込み(未検証)
- 生成後に音声を差し替えるだけだと口が合わない。後付けリップシンク系ツールはアニメ顔に不向きなものが多く非推奨
- 利点: 発音の粗(ep000 の「お団子**が**」、ナルカの片言)を **TTS 段階で聞き比べて選んでから** 1本5分の動画生成に回せる。
  カットをまたいで声が揃う

### 投稿のほかの部分
- ⑧「投稿まで自動化」は採らない(ガイドライン遵守の最終確認は人。SKILL.md 手順6)
- 「動画生成AI不要(静止画+音声)」は本作の見どころ(公式キャラが動いて公式の声で話す)と合わない

## 検証計画
- [ ] **Irodori-TTS の導入**(着手前にユーザー確認: Python 環境の用意とモデルDL。システム Python は無いので
      uv 等で専用 venv を作る想定。ComfyUI 同梱 Python は汚さない)。置き場所は `D:\AI\tools\` 配下
- [ ] 咲耶のボイス見本(`refs/sakuya/sakuya_sample.wav`)を参照音声、voice_design_caption を説明文にして
      「来た来た。あんたの顔見ると、調子出るんだよね」を生成。公式ボイスとの近さ・発音をユーザーが耳で判定
- [ ] 生成したセリフ音声を AddGuide(147)の `audio` に接続(frame 0 から。セリフ開始までの無音を前に足して 5.5s 開始に揃える)。
      ep000_sakuya-engawa と同じ起点画像・seed で生成し、D案(音声も H3 生成)と比較: リップシンク・声・発音・環境音/BGM の扱い
- [ ] 発音が崩れていたナルカ「ごきげんよう。わたくしを探していらしたのでしょう？」でも試し、片言が直るか
- [ ] 結果をこの文書と `docs/pipeline-design.md` に追記。採用なら SKILL.md の手順(台本→**セリフ音声**→起点画像→生成)を更新
