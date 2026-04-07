import { useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#111111",
  card: "#1e1e1e",
  cardBorder: "#333333",
  accent: "#ffffff",
  muted: "#888888",
  gold: "#f0c040",
};

export default function Auth() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("確認メールを送信しました。メールを確認してください。");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "sans-serif", background: C.bg, minHeight: "100vh", color: C.accent, display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#000", padding: "16px", textAlign: "center", borderBottom: "3px solid #fff" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: C.muted, marginBottom: 4 }}>CHIBA LOTTE MARINES</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>⚾ 千葉ロッテマリーンズ貯金</div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", background: C.card, borderRadius: 16, padding: 24, border: `1px solid ${C.cardBorder}` }}>
          <h2 style={{ textAlign: "center", marginBottom: 24, fontSize: 18, color: C.accent }}>
            {mode === "login" ? "ログイン" : "新規登録"}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={labelStyle}>メールアドレス</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                placeholder="example@email.com"
              />
            </div>
            <div>
              <div style={labelStyle}>パスワード</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="6文字以上"
                minLength={6}
              />
            </div>

            {error && (
              <div style={{ color: "#ff6b6b", fontSize: 13, textAlign: "center", padding: "8px", background: "#2a1010", borderRadius: 8 }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ color: C.gold, fontSize: 13, textAlign: "center", padding: "8px", background: "#1a1500", borderRadius: 8 }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: "#fff", color: "#000", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "処理中..." : mode === "login" ? "ログイン" : "登録する"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            {mode === "login" ? (
              <span style={{ color: C.muted, fontSize: 14 }}>
                アカウントをお持ちでない方は{" "}
                <button onClick={() => { setMode("register"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 14, textDecoration: "underline" }}>
                  新規登録
                </button>
              </span>
            ) : (
              <span style={{ color: C.muted, fontSize: 14 }}>
                既にアカウントをお持ちの方は{" "}
                <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 14, textDecoration: "underline" }}>
                  ログイン
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 13, color: "#aaa", marginBottom: 6, fontWeight: "bold" };
const inputStyle = {
  background: "#111",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#fff",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};
