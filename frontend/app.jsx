
const { useState, useEffect } = React;

const TOKEN_KEY = "foodverse_access_token";
const EMAIL_KEY = "foodverse_email";

async function request(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = body && typeof body === "object"
      ? (body.detail || body.message || `Request failed (${response.status})`)
      : (body || `Request failed (${response.status})`);
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
    }
    throw new Error(message);
  }

  return body;
}

function postJson(url, data) {
  return request(url, { method: "POST", body: JSON.stringify(data) });
}

function postForm(url, form) {
  return request(url, { method: "POST", body: form });
}

function Output({ loading, error, children }) {
  if (loading) {
    return (
      <div className="output loading" role="status">
        <span className="dots"><i></i><i></i><i></i></span>
        Analysing, this may take a few seconds...
      </div>
    );
  }
  if (error) return <div className="output error" role="alert">{error}</div>;
  if (children === null || children === undefined || children === false) return null;
  return <div className="output">{children}</div>;
}

function ResultObject({ data }) {
  if (data === null || data === undefined) return null;
  return (
    <div className="result-object">
      {Object.entries(data).map(([key, value]) => (
        <section className="result-section" key={key}>
          <h3>{key.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</h3>
          {Array.isArray(value) ? (
            value.length ? (
              <ul>{value.map((item, index) => (
                <li key={index}>
                  {typeof item === "object" && item !== null
                    ? <ResultObject data={item} />
                    : String(item)}
                </li>
              ))}</ul>
            ) : <p>None reported.</p>
          ) : value !== null && typeof value === "object" ? (
            <ResultObject data={value} />
          ) : (
            <p>{String(value ?? "Not provided")}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function ImagePicker({ file, onChange, label }) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

   return (
    <div className="image-picker">
      <label className="field">
        {label}
        <input
          type="file"
          accept="image/*"
          onChange={event => onChange(event.target.files?.[0] || null)}
        />
      </label>
      {preview && (
        <div className="image-preview">
          <img src={preview} alt="Selected upload preview" />
          <button type="button" className="secondary" onClick={() => onChange(null)}>
            Remove photo
          </button>
        </div>
      )}
      <p className="note">Use a clear JPG or PNG image under 8 MB.</p>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const result = await postJson(endpoint, { email: email.trim(), password });
      localStorage.setItem(TOKEN_KEY, result.access_token);
      localStorage.setItem(EMAIL_KEY, result.email || email.trim());
      onAuth(result.email || email.trim());
    } catch (e) {
      setError(e.message || "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true"></span>
          <div><strong>FoodVerse AI</strong><small>Multimodal food intelligence</small></div>
        </div>
        <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">
          {mode === "signup"
            ? "Sign up to analyse food and save your results."
            : "Log in to continue to your FoodVerse AI workspace."}
        </p>

        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>
            Log in
          </button>
          <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); }}>
            Sign up
          </button>
        </div>

         <form className="auth-form" onSubmit={submit}>
          <label className="field">
            Email address
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </label>
          <label className="field">
            Password
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} maxLength={128} required />
          </label>
          <button className="primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>
        {error && <div className="output error" role="alert">{error}</div>}
        {notice && <p>{notice}</p>}
        <p className="auth-footnote">Your saved analyses are linked to your account.</p>
      </div>
    </div>
  );
}

function useRunner() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(fn) {
    setLoading(true);
    setError("");
    setData(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return { data, loading, error, setError, run };
}

function ImageTool({ endpoint, label, buttonText }) {
  const [file, setFile] = useState(null);
  const { data, loading, error, setError, run } = useRunner();

  function submit() {
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    run(() => {
      const form = new FormData();
      form.append("image", file);
      return postForm(endpoint, form);
    });
  }

  return (
    <div className="panel">
      <ImagePicker file={file} onChange={setFile} label={label} />
      <button className="primary" onClick={submit} disabled={loading}>
        {loading ? "Working..." : buttonText}
      </button>
      <Output loading={loading} error={error}>
        {data && <ResultObject data={data} />}
      </Output>
    </div>
  );
}

function CookingTool() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const { data, loading, error, setError, run } = useRunner();

  function submit() {
    if (!question.trim()) {
      setError("Type a cooking question first.");
      return;
    }
    run(() => {
      const form = new FormData();
      form.append("question", question.trim());
      if (file) form.append("image", file);
      return postForm("/api/cooking-assistant", form);
    });
  }

  return (
    <div className="panel">
      <label className="field">
        Your question
        <textarea rows="3" value={question} onChange={e => setQuestion(e.target.value)} placeholder="What can I make with these vegetables?" />
      </label>
      <ImagePicker file={file} onChange={setFile} label="Add a photo (optional)" />
      <button className="primary" onClick={submit} disabled={loading}>
        {loading ? "Thinking..." : "Ask the cooking assistant"}
      </button>
      <Output loading={loading} error={error}>{data && <ResultObject data={data} />}</Output>
    </div>
  );
}

function MealPlanTool() {
  const [goal, setGoal] = useState("Balanced eating");
  const [diet, setDiet] = useState("Vegetarian");
  const [calories, setCalories] = useState("2000");
  const [allergies, setAllergies] = useState("");
  const [days, setDays] = useState("3");
  const { data, loading, error, setError, run } = useRunner();

  function submit() {
    const kcal = Number(calories);
    if (!kcal || kcal < 800 || kcal > 5000) {
      setError("Enter daily calories between 800 and 5000.");
      return;
    }

    run(() => postJson("/api/meal-plan", {
      goal,
      diet,
      daily_calories: kcal,
      allergies: allergies.split(",").map(a => a.trim()).filter(Boolean),
      days: Number(days)
    }));
  }

  return (
    <div className="panel">
      <div className="form-grid">
        <label className="field">Goal
          <select value={goal} onChange={e => setGoal(e.target.value)}>
            <option>Balanced eating</option><option>Weight loss</option><option>Muscle gain</option><option>More energy</option>
          </select>
        </label>
        <label className="field">Diet
          <select value={diet} onChange={e => setDiet(e.target.value)}>
            <option>Vegetarian</option><option>Vegan</option><option>Non-vegetarian</option><option>Eggetarian</option>
          </select>
        </label>
        <label className="field">Calories per day
          <input type="number" min="800" max="5000" value={calories} onChange={e => setCalories(e.target.value)} />
        </label>
        <label className="field">Days
          <select value={days} onChange={e => setDays(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <label className="field">Allergies (separate with commas)
        <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="peanuts, milk" />
      </label>
      <button className="primary" onClick={submit} disabled={loading}>
        {loading ? "Creating plan..." : "Create my meal plan"}
      </button>
      <Output loading={loading} error={error}>{data && <ResultObject data={data} />}</Output>
    </div>
  );
}

const TOOLS = [
  { id: "food", name: "Food and nutrition", title: "What is on this plate?", desc: "Upload a meal photo. The AI names each item and estimates calories, protein, carbs and fat.", render: () => <ImageTool endpoint="/api/analyze-food" label="Meal photo" buttonText="Analyse nutrition" /> },
  { id: "fresh", name: "Freshness check", title: "Is it still good to eat?", desc: "Upload a photo of fruit, vegetables, meat or leftovers to check for visible signs of spoilage.", render: () => <ImageTool endpoint="/api/freshness" label="Food photo" buttonText="Check freshness" /> },
  { id: "hygiene", name: "Kitchen hygiene", title: "How clean is this kitchen?", desc: "Upload a kitchen or preparation-area photo. The AI scores visible hygiene and suggests improvements.", render: () => <ImageTool endpoint="/api/hygiene" label="Kitchen photo" buttonText="Audit hygiene" /> },
  { id: "cook", name: "Cooking assistant", title: "Ask while you cook", desc: "Ask a cooking question, with or without a photo of your ingredients.", render: () => <CookingTool /> },
  { id: "plan", name: "Meal planner", title: "Plan your meals", desc: "Choose your goal, diet, allergies and duration to generate a meal plan.", render: () => <MealPlanTool /> }
];

function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRecords(await request("/api/history"));
    } catch (e) {
      setError(e.message || "Unable to load history.");
    } finally {
      setLoading(false);
    }
  }

  async function removeRecord(id) {
    try {
      await request(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      setRecords(current => current.filter(record => record.id !== id));
    } catch (e) {
      setError(e.message || "Unable to delete history item.");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="panel history-panel">
      <div className="history-head">
        <div><h2>Your analysis history</h2><p>Recent results saved to your account.</p></div>
        <button className="secondary" onClick={load} disabled={loading}>Refresh</button>
      </div>
      {loading && <p>Loading your history...</p>}
      {error && <div className="output error" role="alert">{error}</div>}
      {!loading && !error && records.length === 0 && <p className="note">No saved analyses yet. Run one of the tools and your results will appear here.</p>}
      {records.map(record => (
        <article className="history-item" key={record.id}>
          <div className="history-item-head">
            <strong>{record.tool}</strong>
            <small>{new Date(record.created_at).toLocaleString()}</small>
          </div>
          <ResultObject data={record.result} />
          <button className="secondary" onClick={() => removeRecord(record.id)}>Delete result</button>
        </article>
      ))}
    </div>
  );
}

function App() {
  const [email, setEmail] = useState(localStorage.getItem(EMAIL_KEY) || "");
  const [active, setActive] = useState("food");
  const [authChecking, setAuthChecking] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthChecking(false);
      return;
    }

    request("/api/auth/me")
      .then(data => {
        setEmail(data.email);
        localStorage.setItem(EMAIL_KEY, data.email);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EMAIL_KEY);
        setEmail("");
      })
      .finally(() => setAuthChecking(false));
  }, [authVersion]);

  function handleAuth(authenticatedEmail) {
    setEmail(authenticatedEmail);
    setActive("food");
    setAuthVersion(v => v + 1);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setEmail("");
    setActive("food");
    setAuthVersion(v => v + 1);
    setAuthChecking(false);
  }

  if (authChecking) {
    return <div className="auth-shell"><p>Checking your session...</p></div>;
  }

  if (!localStorage.getItem(TOKEN_KEY)) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  const tool = TOOLS.find(item => item.id === active);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"></span>
          <div><strong>FoodVerse AI</strong><small>Multimodal food intelligence</small></div>
        </div>
        <nav aria-label="Tools">
          {TOOLS.map(item => (
            <button key={item.id} className={"nav-item" + (item.id === active ? " active" : "")} onClick={() => setActive(item.id)}>
              {item.name}
            </button>
          ))}
          <button className={"nav-item" + (active === "history" ? " active" : "")} onClick={() => setActive("history")}>
            Analysis history
          </button>
        </nav>
        <div className="sidebar-account">
          <span>{email}</span>
          <button className="nav-item logout" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        {active === "history" ? (
          <>
            <header className="page-head"><h1>Analysis history</h1><p>Your previous FoodVerse AI results, saved privately.</p></header>
            <HistoryPage key={email} />
          </>
        ) : (
          <>
            <header className="page-head"><h1>{tool.title}</h1><p>{tool.desc}</p></header>
            <div key={tool.id}>{tool.render()}</div>
          </>
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
