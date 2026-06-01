import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const PHASES = [
  { id: "regular", label: "レギュラー", multiplier: 1.0 },
  { id: "interleague", label: "交流戦", multiplier: 1.0 },
  { id: "cs", label: "CS", multiplier: 1.2 },
  { id: "japan", label: "日本シリーズ", multiplier: 1.5 },
];

const RESULTS = [
  { id: "win", label: "勝利", base: 500, emoji: "⚾" },
  { id: "sayonara", label: "サヨナラ勝利", base: 1000, emoji: "🎉" },
  { id: "draw", label: "引き分け", base: 200, emoji: "🤝" },
  { id: "lose", label: "敗北", base: 0, emoji: "😢" },
];

const PITCHER_BONUSES = [
  { id: "perfect", label: "完全試合", amount: 5000 },
  { id: "nohit", label: "NN", amount: 3000 },
  { id: "shutout", label: "完封", amount: 200 },
  { id: "complete", label: "完投", amount: 100 },
  { id: "save", label: "セーブ", amount: 100 },
  { id: "none", label: "なし", amount: 0 },
];

const OPPONENTS = [
  { id: "fighters", label: "日本ハム" },
  { id: "eagles", label: "楽天" },
  { id: "lions", label: "西武" },
  { id: "hawks", label: "ソフトバンク" },
  { id: "buffaloes", label: "オリックス" },
  { id: "giants", label: "巨人" },
  { id: "tigers", label: "阪神" },
  { id: "dragons", label: "中日" },
  { id: "baystars", label: "DeNA" },
  { id: "carp", label: "広島" },
  { id: "swallows", label: "ヤクルト" },
];

const OTHER_BONUS_AMOUNTS = [0, 100, 500, 1000];

const initialForm = {
  date: new Date().toISOString().split("T")[0],
  phase: "regular",
  opponent: "fighters",
  result: "win",
  homeRuns: 0,
  grandSlams: 0,
  pitcherBonus: "none",
  otherBonusAmount: 0,
  otherBonusNote: "",
};

function calcAmount(form) {
  const phase = PHASES.find(p => p.id === form.phase);
  const result = RESULTS.find(r => r.id === form.result);
  const pitcher = PITCHER_BONUSES.find(p => p.id === form.pitcherBonus);
  const base = result.base + form.homeRuns * 200 + form.grandSlams * 500 + pitcher.amount + (form.otherBonusAmount || 0);
  return Math.round(base * phase.multiplier);
}

const STORAGE_KEY = "baseball_savings_v1";

const C = {
  bg: "#111111",
  card: "#1e1e1e",
  cardBorder: "#333333",
  accent: "#ffffff",
  accentSub: "#cccccc",
  muted: "#888888",
  selected: "#ffffff",
  selectedBg: "#333333",
  selectedBorder: "#ffffff",
  gold: "#f0c040",
};

export default function App() {
  const [games, setGames] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState(initialForm);
  const [tab, setTab] = useState("add");
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  }, [games]);

  const total = useMemo(() => games.reduce((s, g) => s + g.amount, 0), [games]);

  const chartData = useMemo(() => {
    const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    return sorted.map(g => { cum += g.amount; return { date: g.date.slice(5), amount: cum }; });
  }, [games]);

  const preview = calcAmount(form);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (editId) {
      setGames(gs => gs.map(g => g.id === editId ? { ...g, ...form, amount: calcAmount(form) } : g));
      setEditId(null);
    } else {
      setGames(gs => [...gs, { id: Date.now(), ...form, amount: calcAmount(form) }]);
    }
    setForm(initialForm);
    setTab("list");
  };

  const handleEdit = (g) => {
    setForm({
      date: g.date,
      phase: g.phase,
      opponent: g.opponent || "fighters",
      result: g.result,
      homeRuns: g.homeRuns,
      grandSlams: g.grandSlams,
      pitcherBonus: g.pitcherBonus,
      otherBonusAmount: g.otherBonusAmount || 0,
      otherBonusNote: g.otherBonusNote || "",
    });
    setEditId(g.id);
    setTab("add");
  };

  const handleDelete = (id) => {
    if (confirm("削除しますか？")) setGames(gs => gs.filter(g => g.id !== id));
  };

  const resultInfo = (g) => {
    const r = RESULTS.find(r => r.id === g.result);
    const ph = PHASES.find(p => p.id === g.phase);
    const op = OPPONENTS.find(o => o.id === g.opponent);
    return `${r.emoji} ${r.label}　vs ${op ? op.label : ""}${ph.id !== "regular" ? ` [${ph.label}]` : ""}`;
  };

  const chip = (selected) => ({
    padding: "9px 6px", borderRadius: 8, border: `1px solid ${selected ? C.selectedBorder : C.cardBorder}`,
    cursor: "pointer", fontSize: 13, fontWeight: selected ? "bold" : "normal",
    background: selected ? C.selectedBg : C.card,
    color: selected ? C.selected : C.muted,
  });

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "sans-serif", background: C.bg, minHeight: "100vh", color: C.accent }}>
      {/* Header */}
      <div style={{ background: "#000", padding: "16px", textAlign: "center", borderBottom: "3px solid #fff" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: C.muted, marginBottom: 4 }}>CHIBA LOTTE MARINES</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>⚾ 千葉ロッテマリーンズ貯金</div>
        <div style={{ fontSize: 30, fontWeight: "bold", color: C.gold, marginTop: 6 }}>¥{total.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: C.muted }}>累計貯金額（{games.length}試合）</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.cardBorder}`, background: "#000" }}>
        {[["add", editId ? "✏️ 編集" : "➕ 記録"], ["list", "📋 一覧"], ["chart", "📈 グラフ"], ["summary", "📊 集計"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "12px 0", background: "transparent",
            color: tab === id ? "#fff" : C.muted,
            border: "none", borderBottom: tab === id ? "2px solid #fff" : "2px solid transparent",
            cursor: "pointer", fontWeight: tab === id ? "bold" : "normal", fontSize: 11
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* ADD TAB */}
        {tab === "add" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Date */}
            <div>
              <div style={labelStyle}>📅 試合日</div>
              <input type="date" value={form.date} onChange={e => upd("date", e.target.value)}
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 15, width: "100%", boxSizing: "border-box" }} />
            </div>

            {/* Opponent */}
            <div>
              <div style={labelStyle}>🆚 対戦相手</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {OPPONENTS.map(o => (
                  <button key={o.id} onClick={() => upd("opponent", o.id)} style={chip(form.opponent === o.id)}>{o.label}</button>
                ))}
              </div>
            </div>

            {/* Phase */}
            <div>
              <div style={labelStyle}>🏆 フェーズ</div>
              <div style={{ display: "flex", gap: 8 }}>
                {PHASES.map(p => (
                  <button key={p.id} onClick={() => upd("phase", p.id)} style={{ ...chip(form.phase === p.id), flex: 1, textAlign: "center" }}>
                    {p.label}<br /><span style={{ fontSize: 10, color: form.phase === p.id ? C.gold : C.muted }}>×{p.multiplier}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div>
              <div style={labelStyle}>⚾ 試合結果</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {RESULTS.map(r => (
                  <button key={r.id} onClick={() => upd("result", r.id)} style={{ ...chip(form.result === r.id), textAlign: "center" }}>
                    {r.emoji} {r.label}<br /><span style={{ fontSize: 11, color: form.result === r.id ? C.gold : C.muted }}>+¥{r.base}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Home runs */}
            <div>
              <div style={labelStyle}>💥 打撃ボーナス</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[["homeRuns", "HR", 200], ["grandSlams", "満塁HR", 500]].map(([key, lbl, amt]) => (
                  <div key={key} style={{ flex: 1, background: C.card, borderRadius: 10, padding: 10, border: `1px solid ${C.cardBorder}` }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{lbl}（+¥{amt}/本）</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => upd(key, Math.max(0, form[key] - 1))} style={countBtn}>−</button>
                      <span style={{ fontSize: 20, fontWeight: "bold", flex: 1, textAlign: "center" }}>{form[key]}</span>
                      <button onClick={() => upd(key, form[key] + 1)} style={countBtn}>＋</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pitcher */}
            <div>
              <div style={labelStyle}>⚡ 投手ボーナス（最上位のみ）</div>
              <select value={form.pitcherBonus} onChange={e => upd("pitcherBonus", e.target.value)}
                style={{ width: "100%", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "12px", color: "#fff", fontSize: 14, appearance: "auto", boxSizing: "border-box" }}>
                {PITCHER_BONUSES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}{p.amount > 0 ? `　+¥${p.amount.toLocaleString()}` : ""}</option>
                ))}
              </select>
            </div>

            {/* Other Bonus */}
            <div>
              <div style={labelStyle}>🎯 その他ボーナス（珍記録など）</div>
              <input
                type="text"
                placeholder="内容を記述（例：代打逆転満塁HR）"
                value={form.otherBonusNote}
                onChange={e => upd("otherBonusNote", e.target.value)}
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                {OTHER_BONUS_AMOUNTS.map(amt => (
                  <button key={amt} onClick={() => upd("otherBonusAmount", amt)} style={{ ...chip(form.otherBonusAmount === amt), flex: 1, textAlign: "center" }}>
                    {amt === 0 ? "なし" : `¥${amt}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{ background: "#000", borderRadius: 12, padding: 14, textAlign: "center", border: "1px solid #fff" }}>
              <div style={{ color: C.muted, fontSize: 13 }}>今回の積立額</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: C.gold }}>¥{preview.toLocaleString()}</div>
            </div>

            <button onClick={handleSubmit} style={{
              background: "#fff", color: "#000", border: "none",
              borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: "bold", cursor: "pointer"
            }}>{editId ? "✏️ 更新する" : "💾 記録する"}</button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(initialForm); }} style={{
                background: "transparent", color: C.muted, border: `1px solid ${C.cardBorder}`,
                borderRadius: 12, padding: "10px", fontSize: 14, cursor: "pointer"
              }}>キャンセル</button>
            )}
          </div>
        )}

        {/* LIST TAB */}
        {tab === "list" && (
          <div>
            {games.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, marginTop: 40 }}>まだ記録がありません</div>
            ) : (
              [...games].sort((a, b) => b.date.localeCompare(a.date)).map(g => {
                const pb = PITCHER_BONUSES.find(p => p.id === g.pitcherBonus);
                return (
                  <div key={g.id} style={{ background: C.card, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${C.cardBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.muted }}>{g.date}</div>
                        <div style={{ fontSize: 14, marginTop: 2 }}>{resultInfo(g)}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                          {g.homeRuns > 0 && `HR×${g.homeRuns} `}
                          {g.grandSlams > 0 && `満塁HR×${g.grandSlams} `}
                          {pb && pb.amount > 0 && pb.label + " "}
                          {g.otherBonusNote && `🎯${g.otherBonusNote}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: "bold", color: C.gold }}>+¥{g.amount.toLocaleString()}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => handleEdit(g)} style={{ ...smallBtn, color: C.accentSub }}>✏️</button>
                          <button onClick={() => handleDelete(g.id)} style={{ ...smallBtn, color: "#ff6b6b" }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CHART TAB */}
        {tab === "chart" && (
          <div>
            {chartData.length < 2 ? (
              <div style={{ textAlign: "center", color: C.muted, marginTop: 40 }}>2試合以上記録するとグラフが表示されます</div>
            ) : (
              <>
                <div style={{ background: "#000", borderRadius: 10, padding: 12, marginBottom: 16, textAlign: "center", border: "1px solid #fff" }}>
                  <div style={{ fontSize: 12, color: C.muted }}>累計貯金額</div>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: C.gold }}>¥{total.toLocaleString()}</div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8 }}
                      labelStyle={{ color: C.muted }}
                      formatter={v => [`¥${v.toLocaleString()}`, "累計"]}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#fff" strokeWidth={2} dot={{ fill: "#fff", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}

        {/* SUMMARY TAB */}
        {tab === "summary" && (
          <div>
            {games.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, marginTop: 40 }}>まだ記録がありません</div>
            ) : (() => {
              const monthly = {};
              games.forEach(g => {
                const key = g.date.slice(0, 7);
                if (!monthly[key]) monthly[key] = { total: 0, count: 0, wins: 0 };
                monthly[key].total += g.amount;
                monthly[key].count += 1;
                if (g.result === "win" || g.result === "sayonara") monthly[key].wins += 1;
              });
              const sorted = Object.keys(monthly).sort((a, b) => b.localeCompare(a));
              return (
                <div>
                  <div style={{ background: "#000", borderRadius: 10, padding: 12, marginBottom: 16, textAlign: "center", border: "1px solid #fff" }}>
                    <div style={{ fontSize: 12, color: C.muted }}>累計貯金額</div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: C.gold }}>¥{total.toLocaleString()}</div>
                  </div>
                  {sorted.map(key => {
                    const m = monthly[key];
                    const [y, mo] = key.split("-");
                    return (
                      <div key={key} style={{ background: C.card, borderRadius: 10, padding: 14, marginBottom: 10, border: `1px solid ${C.cardBorder}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: "bold" }}>{y}年{mo}月</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                              {m.count}試合　{m.wins}勝　勝率{m.count > 0 ? Math.round(m.wins / m.count * 100) : 0}%
                            </div>
                          </div>
                          <div style={{ fontSize: 22, fontWeight: "bold", color: C.gold }}>¥{m.total.toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}

const labelStyle = { fontSize: 13, color: "#aaa", marginBottom: 8, fontWeight: "bold" };
const countBtn = { background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 6, width: 32, height: 32, fontSize: 18, cursor: "pointer", fontWeight: "bold" };
const smallBtn = { background: "#111", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 };
