/**
 * テスト用の HTML 断片。
 *
 * npb.jp のページをそのまま複製すると取得データの再配布になるため、
 * 2026-09-14 に実取得して確認した「構造」だけを最小限で再現している。
 * 空白やインデントの入り方も実物に合わせてある（実物はタグ間の改行と
 * タブが多く、素朴な正規表現が壊れやすいため）。
 */

/** 日程・結果ページ。1日目は2試合、2日目は未実施、3日目は中止 */
export const SCHEDULE_HTML = `
<table>
  <thead>
    <tr><th class="date">月日</th><th class="match">対戦カード</th></tr>
  </thead>
  <tbody>
    <tr id="date0901" class="">
      <th class="" rowspan="2">9/1（火）</th>

        <td>
          <div class="team1">ロッテ</div>                <a href="/scores/2026/0901/m-l-20/">

                    <div class="score1">1</div>
            <div class="state">-</div>
            <div class="score2">0</div>

                  </a>
                  <div class="team2">西武</div>      </td>
        <td>
          <div class="place">ZOZOマリン</div>
          <div class="time">18:00</div>
          <div class="weather">
                        &nbsp;
                    </div>
        </td>
        <td>
          <div class="comment"></div>
        </td>
        <td>
          <div class="pit">
                      勝：高野脩                  </div>
          <div class="pit">
                      敗：平良                  </div>
        </td>
    </tr>
    <tr id="date0901" class="">
        <td>
          <div class="team1">ソフトバンク</div>                <a href="/scores/2026/0901/h-b-21/">
                    <div class="score1">3</div>
            <div class="state">-</div>
            <div class="score2">3</div>
                  </a>
                  <div class="team2">オリックス</div>      </td>
        <td>
          <div class="place">みずほPayPay</div>
          <div class="time">18:00</div>
          <div class="weather">&nbsp;</div>
        </td>
        <td><div class="comment"></div></td>
        <td>
          <div class="pit">分：森脇</div>
          <div class="pit">分：柴田</div>
        </td>
    </tr>
    <tr id="date0916" class="">
      <th class="" rowspan="1">9/16（火）</th>
        <td>
          <div class="team1">ロッテ</div>
                    <div class="score1">&nbsp;</div>
            <div class="state">-</div>
            <div class="score2">&nbsp;</div>
                  <div class="team2">楽天</div>      </td>
        <td>
          <div class="place">ZOZOマリン</div>
          <div class="time">18:00</div>
          <div class="weather">
                        <img src="/img/common/weather/17.gif" alt="雨時々止む" width="48" height="26">
                    </div>
        </td>
        <td><div class="comment"></div></td>
        <td>
          <div class="pit">先発：種市</div>
        </td>
    </tr>
    <tr id="date0917" class="">
        <td>
          <div class="team1">ロッテ</div>
                    <div class="score1">&nbsp;</div>
            <div class="state">-</div>
            <div class="score2">&nbsp;</div>
                  <div class="team2">楽天</div>      </td>
        <td>
          <div class="place">ZOZOマリン</div>
          <div class="time">18:00</div>
          <div class="weather">
                        <img src="/img/common/weather/99.gif" alt="雨天中止" width="48" height="26">
                    </div>
        </td>
        <td><div class="comment"></div></td>
        <td></td>
    </tr>
  </tbody>
</table>
`

/** ボックススコア。セーブ無し・本塁打が両チームに1本ずつ */
export const BOX_SCORE_HTML = `
<div id="game_stats">
  <div class="game_tit">
    <time>2026年9月10日（木）</time>
    <span class="place">ZOZOマリン</span>
    <h3>【パーソル パ・リーグ公式戦】 千葉ロッテマリーンズ vs 東北楽天ゴールデンイーグルス
    20回戦    </h3>
  </div>
  <div class="line-score">
    <p class="game_info">
            【試合終了】
            ◇開始 18:00        ◇終了 20:37            ◇試合時間 2時間37分      ◇入場者 22,785人
          </p>
  </div>
  <div class="wrap">
    <section class="game_result_info">
      <table>
        <tbody>
          <tr>
            <th>【勝投手】</th>
            <td><a href="/bis/players/31035157.html">高野脩</a>（3勝3敗）</td>
          </tr>
          <tr>
            <th>【敗投手】</th>
            <td><a href="/bis/players/91795114.html">岸</a>（4勝5敗）</td>
          </tr>
        </tbody>
      </table>
      <h4>バッテリー</h4>
      <table>
        <tbody>
          <tr>
            <th>【楽天】</th>
            <td><a href="/bis/players/91795114.html">岸</a>、<a href="/bis/players/81985155.html">柴田</a> ‐ <a href="/bis/players/71375138.html">太田</a></td>
          </tr>
        </tbody>
      </table>
      <h4>本塁打</h4>
      <table>
        <tbody>
          <tr>
            <th>【楽天】</th>
            <td><a href="/bis/players/43345155.html">YG安田</a> 6号（4回ソロ <a href="/bis/players/31035157.html">高野脩</a>）</td>
          </tr>
          <tr>
            <th>【ロッテ】</th>
            <td><a href="/bis/players/71075151.html">佐藤</a> 17号（7回2ラン <a href="/bis/players/91795114.html">岸</a>）</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</div>
`

/** セーブが付いた試合のボックススコア（責任投手の部分だけ） */
export const BOX_SCORE_WITH_SAVE_HTML = `
<div id="game_stats">
  <div class="game_tit">
    <time>2026年9月1日（火）</time>
    <span class="place">ZOZOマリン</span>
    <h3>【パーソル パ・リーグ公式戦】 千葉ロッテマリーンズ vs 埼玉西武ライオンズ 20回戦 </h3>
  </div>
  <p class="game_info">【試合終了】 ◇開始 18:00 ◇終了 20:30</p>
  <section class="game_result_info">
    <table>
      <tbody>
        <tr><th>【勝投手】</th><td><a href="/bis/players/31035157.html">高野脩</a>（2勝3敗）</td></tr>
        <tr><th>【敗投手】</th><td><a href="/bis/players/31035136.html">平良</a>（10勝4敗）</td></tr>
        <tr><th>【セーブ】</th><td><a href="/bis/players/23125151.html">横山</a>（31セ）</td></tr>
      </tbody>
    </table>
  </section>
</div>
`

/** 交流戦のボックススコア（フェーズ判定用に h3 だけ差し替えたもの） */
export const BOX_SCORE_INTERLEAGUE_HTML = BOX_SCORE_HTML.replace(
  '【パーソル パ・リーグ公式戦】',
  '【日本生命セ・パ交流戦】'
)

/** 個人打撃成績。実物と同じ23列 */
export const BATTING_HTML = `
<p>2026年9月13日 現在</p>
<table class="tablefix2">
  <thead class="vertical">
    <tr>
      <th class="name">選手</th>
      <th><span>試合</span></th><th><span>打席</span></th><th><span>打数</span></th>
      <th><span>得点</span></th><th><span>安打</span></th><th><span>二塁打</span></th>
      <th><span>三塁打</span></th><th><span>本塁打</span></th><th><span>塁打</span></th>
      <th><span>打点</span></th><th><span>盗塁</span></th><th><span>盗塁刺</span></th>
      <th><span>犠打</span></th><th><span>犠飛</span></th><th><span>四球</span></th>
      <th><span>故意四</span></th><th><span>死球</span></th><th><span>三振</span></th>
      <th><span>併殺打</span></th><th><span>打率</span></th><th><span>長打率</span></th>
      <th><span>出塁率</span></th>
    </tr>
  </thead>
  <tbody>

        <tr>

          <td>愛斗</td>

          <td>40</td><td>89</td><td>85</td><td>9</td><td>18</td><td>2</td><td>1</td>
          <td>1</td><td>25</td><td>9</td><td>3</td><td>0</td><td>2</td><td>0</td>
          <td>1</td><td>0</td><td>1</td><td>20</td><td>3</td>
          <td>.212</td><td>.294</td><td>.230</td>
        </tr>
        <tr>
          <td class="left-hand"><sup>*</sup>佐藤　都志也</td>
          <td>120</td><td>480</td><td>420</td><td>55</td><td>118</td><td>20</td><td>2</td>
          <td>17</td><td>193</td><td>66</td><td>4</td><td>2</td><td>1</td><td>3</td>
          <td>50</td><td>1</td><td>6</td><td>70</td><td>10</td>
          <td>.281</td><td>.460</td><td>.360</td>
        </tr>
  </tbody>
</table>
`

/** 個人投手成績。実物と同じ24列。投球回は integer/decimal の2つの span */
export const PITCHING_HTML = `
<p>2026年9月13日 現在</p>
<table class="tablefix2">
  <thead class="vertical">
    <tr>
      <th class="name">選手</th>
      <th><span>登板</span></th><th><span>勝利</span></th><th><span>敗北</span></th>
      <th><span>セーブ</span></th>
      <th><span>ホールド</span></th><th><span>ＨＰ</span></th>
      <th><span>完投</span></th><th><span>完封勝</span></th><th><span>無四球</span></th>
      <th><span>勝率</span></th><th><span>打者</span></th><th><span>投球回</span></th>
      <th><span>安打</span></th><th><span>本塁打</span></th><th><span>四球</span></th>
      <th><span>故意四</span></th><th><span>死球</span></th><th><span>三振</span></th>
      <th><span>暴投</span></th><th><span>ボーク</span></th><th><span>失点</span></th>
      <th><span>自責点</span></th><th><span>防御率</span></th>
    </tr>
  </thead>
  <tbody>
        <tr>
          <td>石川　柊太</td>
          <td>6</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td><td>0</td>
          <td>0</td><td>0</td><td>.000</td><td>74</td>
          <td>
            <span class="integer">15</span><span class="decimal">.1</span>
          </td>
          <td>21</td><td>4</td><td>7</td><td>1</td><td>1</td><td>10</td><td>0</td>
          <td>0</td><td>15</td><td>13</td><td>7.63</td>
        </tr>
        <tr>
          <td class="left-hand"><sup>*</sup>小島　和哉</td>
          <td>18</td><td>5</td><td>9</td><td>0</td><td>0</td><td>0</td><td>1</td>
          <td>0</td><td>0</td><td>.357</td><td>447</td>
          <td>
            <span class="integer">100</span><span class="decimal">.2</span>
          </td>
          <td>112</td><td>12</td><td>35</td><td>0</td><td>8</td><td>82</td><td>3</td>
          <td>0</td><td>51</td><td>44</td><td>3.83</td>
        </tr>
  </tbody>
</table>
`
