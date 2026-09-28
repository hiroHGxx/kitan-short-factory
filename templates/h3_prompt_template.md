# h3_prompt 定型構造(月蝕綺譚・Ref2VA+AddGuide 標準)

本作の標準経路は `generate.mjs --ref2v`(D案: 起点画像を1フレーム目に固定+正典シート/公式ボイスを参照)。
h3_prompt は必ずこの7ブロック構成・この順で書く。英語で書き、日本語セリフだけ「」内に日本語で書く。
(i2v の `--turbo` で使う場合は 2. References を省き、1. の `as <Picture 1>` を `of the input image` に戻す)

```
<1. 画風維持文>

<2. References(参照の役割割り当て)>

Scene: <3. 場面説明>

Motion storyboard:
[0s-Ns] <動き>
[Ns-Ms] <動き>
...

Camera: <4. カメラ>

Audio: <5. 音声設計>

<6. ネガティブ指示>
```

## 各ブロックのルール

### 1. 画風維持文(冒頭・固定文)
公式の画像生成アンカー(`get_design_tone` の image_prompt)由来。キャラの塗りは正典のまま、世界の側を「宵闇に金」にする:

> Clean anime cel illustration, with the exact same clean line art, light soft cel shading and
> character coloring as <Picture 1>. Elegant Japanese dark fantasy: deep indigo-black night
> (#16162a), gold accents only as thin lines and tiny drifting particles (maki-e lacquerware
> feeling), dark-purple night sakura, silver mist. Do not change the character design or art style.

### 2. References(固定文。cut.refs の並び順と対応させる)
refs.images = [正典立ち絵, 三面図シート]、refs.audios = [ボイス見本] のとき:

> References: <Picture 1> (full-body front view) and <Picture 2> (turnaround sheet and facial
> expressions) are the character reference for the girl: use them for her face, hairstyle, eye
> color and outfit only, ignore their plain background. <Audio 1> is the reference for her voice:
> she speaks with the same voice timbre as <Audio 1>.

- 正典シートの背景(白・緑)は「ignore their plain background」で無視させる
- ボイス見本は `get_spirit` の voice_sample。**kind=irodori(WAV配布)のキャラのみ参照できる**。
  kind=elevenlabs(於兎など)は WAV が無いので refs.audios を空にし、声は言葉で指定する

### 3. Scene
起点画像に写っているものを具体的に再記述する(キャラの特徴・服装・場所)。
画像任せにせず言葉でも固定するのが画風・キャラ維持のコツ。起点画像と食い違う記述はしない
(ep000: 起点画像の月が「黒く欠けた月蝕」だったので Scene 側を合わせた)。

### 4. Motion storyboard(秒数区切り)
- 10秒尺なら 3〜4 区間に分ける(例: [0s-3s] / [3s-5s] / [5s-9s] / [9s-10s])
- 1区間1アクション。動きは小さく・ゆっくり(公式トンマナも「お淑やかに」: 呼吸・瞬き・なびきのみ)
- セリフはこのブロック内でタイミング・声質を指定する:
  `and at 5.5s says in Japanese in a bright, clear, confident young woman's voice with natural falling intonation: 「…」`
- **セリフは5.5秒開始なら3〜4秒で言い切れる長さに**(10秒に収まらないと途中で切れる)
- **セリフ冒頭に「あ、」等の一拍を付けない**。Ref2VA では「あ、」が二重に響き、後続語の誤発音
  (「来た来た」→「来たが来た」)を誘発した(ep000)。付けなくても口は自然に動く
- 誤読しやすい語は読みを添える: `(来た来た is pronounced "kita kita")`

### 5. Camera
static / very slight slow push-in など控えめに1文。激しいカメラワークは破綻しやすい。

### 6. Audio
環境音 + BGMの雰囲気 + セリフの再掲(タイミング付き)を1段落で。公式トンマナの音は「静寂が地。
低い鈴・柝・水滴系。祭囃子NG」:

> Audio: quiet night ambience, soft rustle of sakura branches in the wind, a faint low bell far
> away, a calm koto-like melody underneath. Her line 「…」 at 5.5s, close and clear.

### 7. ネガティブ指示(末尾・固定文)

> No text, subtitles, logos or watermarks. Keep the clean anime cel look from the first frame to
> the last frame, no bright festival red, no pale pink or white sakura, no blue sky, no daytime,
> no white background, do not become photorealistic, do not change the character design.

## Ref2VA 固有の注意(ep000 検証で判明)

- **起点画像なし(B案)だとトーンが言葉で制御できない**: 桜が淡いピンク〜白、空が青くなり、カメラが引いて全身になる。
  色指定(#5C4470 等)やネガティブ指示を強めても変わらなかった → 起点画像を AddGuide で固定する(D案)
- **発音は完璧ではない**: 助詞の混入(餡音「お団子が食べようよ」)、片言・不自然なイントネーション(ナルカのお嬢様口調)が出ることがある。
  チェックで判定し、seed 変更やセリフ言い換えでリテイクする。文字起こし(whisper)は冒頭語を落とすので判定は耳で行う

## 既知の破綻パターンと対策(姉妹プロジェクト ep003〜 i2vで実証。Ref2VAでも参考)

- **起点画像に写っていない小道具は浮く・出現が破綻する**(例: 傘)。
  props は極力書かない。書くなら起点画像に写っているものだけにする
- **水・雨系のシーン + セリフの口の動き → 口から水しぶきが出る**。
  ネガティブ指示(no spray from mouth 等)やseed変更では消えないことがある。
  効く対策は構図変更: セリフの瞬間は顔を遠くへ向けさせ、口元を画面上で
  小さくする(three-quarter view / face turned away)
- **セリフのイントネーションが不自然** → seed変更で直ることもあるが、
  セリフ冒頭に「あ、」等の一拍を入れる+voice指示に
  "natural falling intonation" を足す方が確実だった
- **起点画像が「目を閉じた顔」のカットは、開眼時に瞳の色が変わる**(ep015で実証。
  緑髪に引っ張られて琥珀色→緑目になった)。seed変更では直らない。
  開眼するstoryboard区間に "opens her warm orange-amber eyes (the same amber
  eye color as always)" のように瞳の色を明記する
- **発話を連想させるジェスチャー(合掌のごちそうさま等)は、セリフなしカットでも
  不明瞭な発話を誘発する**(ep015 cut5で実証)。"No spoken words" だけでは不十分。
  対策: storyboard側で "silent thank-you gesture ... giving thanks in her heart
  without speaking" のように「心の中で」を明示し、Audioブロックも
  "Completely no voice: no spoken words, no whisper, no humming, no murmur" まで強化する

## 完全な実例

`episodes/ep000_sakuya-engawa/script.json` の cut1(咲耶・縁側)が上記7ブロック構造+`refs` 指定の実例そのもの
(検証で採用した D案の最終形)。迷ったらそれを開いて参照する。
