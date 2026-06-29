"use client";

import {
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceEnum
} from "@rive-app/react-canvas";
import { useEffect, useMemo, useState } from "react";

const riveLayout = new Layout({ fit: Fit.Contain });
const RIVE_STATE_MACHINE = "MascotSM";
const POSE_INPUT = "pose";
const VISEME_INPUT = "mouthVisemeCode";

// Idle-cycle tuning: rest calmly on idle, then play ONE random flourish for its
// length, then return to idle. Per-pose durations (ms); fallback for unlisted poses.
const REST_MIN_MS = 4000;
const REST_MAX_MS = 9000;
const FLOURISH_FALLBACK_MS = 3000;
const FLOURISH_MS = {
  bookreading: 4000,
  coffeedrink: 4000,
  writing: 4000,
  bobbateadrink: 4000,
  hand_wave: 2000,
  dancing: 2000
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function localAssetUrl(filePath) {
  const prefix = "mascots/";
  const localPath = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
  return `/api/assets/${localPath.split("/").map(encodeURIComponent).join("/")}`;
}

function runtimeFile(mascot) {
  return mascot?.files?.find(file => file.role === "runtime");
}

function sourceFile(mascot) {
  return mascot?.files?.find(file => file.role === "source");
}

function RivePreview({ mascot, pose, viseme }) {
  const runtime = runtimeFile(mascot);
  const src = runtime ? localAssetUrl(runtime.path) : null;
  const { rive, RiveComponent } = useRive(
    src
      ? {
          src,
          stateMachines: RIVE_STATE_MACHINE,
          autoplay: true,
          layout: riveLayout
        }
      : undefined
  );

  const viewModel = useViewModel(rive, { useDefault: true });
  const viewModelInstance = useViewModelInstance(viewModel, { useDefault: true, rive });
  const { setValue: setPose } = useViewModelInstanceEnum(POSE_INPUT, viewModelInstance);
  const { setValue: setViseme } = useViewModelInstanceEnum(VISEME_INPUT, viewModelInstance);

  useEffect(() => {
    setPose(pose);
  }, [pose, setPose]);

  useEffect(() => {
    setViseme(viseme);
  }, [viseme, setViseme]);

  return (
    <div className="previewSurface">
      {src ? <RiveComponent /> : <div className="emptyState">No runtime file</div>}
    </div>
  );
}

export default function MascotTester() {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pose, setPose] = useState("idle");
  const [viseme, setViseme] = useState("sil");
  const [cycling, setCycling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/manifest")
      .then(response => {
        if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        setManifest(data);
        const firstReady = data.mascots?.find(mascot => mascot.status === "ready") ?? data.mascots?.[0];
        if (firstReady) {
          setSelectedId(firstReady.id);
          setPose(firstReady.stateEngine?.states?.idle ?? "idle");
          setViseme(firstReady.stateEngine?.visemeCodes?.[0] ?? "sil");
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mascots = manifest?.mascots ?? [];
  const selectedMascot = useMemo(
    () => mascots.find(mascot => mascot.id === selectedId) ?? mascots[0],
    [mascots, selectedId]
  );
  const stateEngine = selectedMascot?.stateEngine;
  const availablePoses = useMemo(() => {
    if (!stateEngine) return ["idle", "thinking"];
    return Array.from(new Set([stateEngine.states.idle, stateEngine.states.thinking, ...stateEngine.idlePoseCycle]));
  }, [stateEngine]);

  useEffect(() => {
    if (!selectedMascot) return;
    setPose(selectedMascot.stateEngine?.states?.idle ?? "idle");
    setViseme(selectedMascot.stateEngine?.visemeCodes?.[0] ?? "sil");
    setCycling(false);
  }, [selectedMascot?.id]);

  useEffect(() => {
    if (!cycling || !stateEngine) return;
    const idlePose = stateEngine.states?.idle ?? "idle";
    const flourishes = (stateEngine.idlePoseCycle ?? []).filter(pose => pose !== idlePose);
    if (flourishes.length === 0) return;

    let cancelled = false;
    let timer;

    const restThenFlourish = () => {
      setPose(idlePose);
      timer = window.setTimeout(playFlourish, randomBetween(REST_MIN_MS, REST_MAX_MS));
    };

    const playFlourish = () => {
      if (cancelled) return;
      const choice = flourishes[Math.floor(Math.random() * flourishes.length)];
      setPose(choice);
      timer = window.setTimeout(restThenFlourish, FLOURISH_MS[choice] ?? FLOURISH_FALLBACK_MS);
    };

    restThenFlourish();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setPose(idlePose);
    };
  }, [cycling, stateEngine]);

  const runtime = runtimeFile(selectedMascot);
  const source = sourceFile(selectedMascot);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>OpenHuman Mascot Tester</h1>
          <p>Local manifest, Rive runtime files, and state-engine controls.</p>
        </div>
        <div className="buildMeta">
          <span>schema v{manifest?.schemaVersion ?? "-"}</span>
          <span>{manifest?.mascots?.length ?? 0} mascots</span>
        </div>
      </header>

      {error ? <div className="errorBanner">{error}</div> : null}

      <section className="workspace">
        <aside className="sidebar" aria-label="Mascots">
          <div className="panelTitle">Mascots</div>
          <div className="mascotList">
            {mascots.map(mascot => (
              <button
                className={mascot.id === selectedMascot?.id ? "mascotRow active" : "mascotRow"}
                key={mascot.id}
                type="button"
                onClick={() => setSelectedId(mascot.id)}>
                <span>{mascot.name}</span>
                <small>{mascot.status}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="stage">
          {selectedMascot ? (
            <>
              <div className="stageHeader">
                <div>
                  <h2>{selectedMascot.name}</h2>
                  <p>{selectedMascot.description}</p>
                </div>
                <span className={selectedMascot.status === "ready" ? "status ready" : "status draft"}>
                  {selectedMascot.status}
                </span>
              </div>

              <RivePreview mascot={selectedMascot} pose={pose} viseme={viseme} />

              <div className="assetLinks">
                {runtime ? <a href={localAssetUrl(runtime.path)}>runtime .riv</a> : null}
                {source ? <a href={localAssetUrl(source.path)}>source .rev</a> : null}
              </div>
            </>
          ) : (
            <div className="emptyState">No mascots found</div>
          )}
        </section>

        <aside className="controls" aria-label="State engine controls">
          <div className="panelTitle">State Engine</div>

          <label className="field">
            <span>Pose</span>
            <select value={pose} onChange={event => setPose(event.target.value)}>
              {availablePoses.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Viseme</span>
            <select value={viseme} onChange={event => setViseme(event.target.value)}>
              {(stateEngine?.visemeCodes ?? ["sil"]).map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="buttonGrid">
            <button type="button" onClick={() => setPose(stateEngine?.states?.idle ?? "idle")}>
              Idle
            </button>
            <button type="button" onClick={() => setPose(stateEngine?.states?.thinking ?? "thinking")}>
              Thinking
            </button>
            <button type="button" onClick={() => setCycling(value => !value)}>
              {cycling ? "Stop cycle" : "Cycle idle"}
            </button>
            <button type="button" onClick={() => setViseme("sil")}>
              Rest mouth
            </button>
          </div>

          <div className="poseList">
            {(stateEngine?.idlePoseCycle ?? []).map(item => (
              <button key={item} type="button" onClick={() => setPose(item)}>
                {item}
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
