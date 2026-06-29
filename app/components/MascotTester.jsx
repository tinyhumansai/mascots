"use client";

import {
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceEnum
} from "@rive-app/react-webgl2";
import { useEffect, useMemo, useRef, useState } from "react";

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

// Drives one optional enum channel (e.g. "eyes") onto the view model. Each channel
// gets its own component so the hook count stays stable per the rules of hooks.
function ChannelDriver({ channelKey, value, viewModelInstance }) {
  const { setValue } = useViewModelInstanceEnum(channelKey, viewModelInstance);
  useEffect(() => {
    if (value != null) setValue(value);
  }, [value, setValue]);
  return null;
}

function RivePreview({ mascot, pose, viseme, channelValues }) {
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

  const channels = mascot?.stateEngine?.channels ?? [];

  return (
    <div className="previewSurface">
      {src ? <RiveComponent /> : <div className="emptyState">No runtime file</div>}
      {channels.map(channel => (
        <ChannelDriver
          key={channel.key}
          channelKey={channel.key}
          value={channelValues?.[channel.key]}
          viewModelInstance={viewModelInstance}
        />
      ))}
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
  const [channelValues, setChannelValues] = useState({});
  const [channelCycling, setChannelCycling] = useState({});
  const [lipSyncing, setLipSyncing] = useState(false);
  const lipSyncRef = useRef(null);

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
    const engine = selectedMascot.stateEngine;
    setPose(engine?.states?.idle ?? "idle");
    setViseme(engine?.visemeCodes?.[0] ?? "sil");
    setCycling(false);
    const running = lipSyncRef.current;
    if (running) {
      running.cancelled = true;
      running.timeouts.forEach(timer => window.clearTimeout(timer));
      try {
        running.audioCtx.close();
      } catch {
        /* already closed */
      }
      lipSyncRef.current = null;
    }
    setLipSyncing(false);
    const initialValues = {};
    for (const channel of engine?.channels ?? []) {
      initialValues[channel.key] = channel.default ?? channel.values[0];
    }
    setChannelValues(initialValues);
    setChannelCycling({});
  }, [selectedMascot?.id]);

  // Auto-cycle any channel whose toggle is on (e.g. idle eye darting).
  useEffect(() => {
    const channels = stateEngine?.channels ?? [];
    const timers = channels
      .filter(channel => channelCycling[channel.key] && channel.cycle?.enabled)
      .map(channel => {
        const interval = channel.cycle.intervalMs ?? 2500;
        const sequential = channel.cycle.order === "sequential";
        let index = 0;
        return window.setInterval(() => {
          setChannelValues(prev => {
            let next;
            if (sequential) {
              index = (index + 1) % channel.values.length;
              next = channel.values[index];
            } else {
              next = channel.values[Math.floor(Math.random() * channel.values.length)];
            }
            return { ...prev, [channel.key]: next };
          });
        }, interval);
      });
    return () => timers.forEach(timer => window.clearInterval(timer));
  }, [channelCycling, stateEngine]);

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

  // Dummy lip-sync: play a syllabic "babble" tone and drive the viseme codes in
  // time with it so the mouth shapes animate. Not phonetically accurate — it's a
  // visual check that the visemeCodes channel drives the mouth.
  const stopLipSync = () => {
    const session = lipSyncRef.current;
    if (session) {
      session.cancelled = true;
      session.timeouts.forEach(timer => window.clearTimeout(timer));
      try {
        session.audioCtx.close();
      } catch {
        /* already closed */
      }
      lipSyncRef.current = null;
    }
    setLipSyncing(false);
    setViseme("sil");
  };

  const playLipSync = () => {
    stopLipSync();
    const codes = (stateEngine?.visemeCodes ?? []).filter(code => code !== "sil");
    if (codes.length === 0) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const session = { audioCtx, timeouts: [], cancelled: false };
    lipSyncRef.current = session;
    setLipSyncing(true);

    let offset = 0;
    const syllables = 26;
    for (let i = 0; i < syllables; i += 1) {
      const viseme = codes[Math.floor(Math.random() * codes.length)];
      const openMs = 90 + Math.random() * 90;
      const gapMs = 40 + Math.random() * 70;
      const at = offset;
      session.timeouts.push(
        window.setTimeout(() => {
          if (session.cancelled) return;
          setViseme(viseme);
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sawtooth";
          osc.frequency.value = 95 + Math.random() * 70;
          osc.connect(gain).connect(audioCtx.destination);
          const now = audioCtx.currentTime;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + openMs / 1000);
          osc.start(now);
          osc.stop(now + openMs / 1000 + 0.03);
        }, at)
      );
      session.timeouts.push(
        window.setTimeout(() => {
          if (!session.cancelled) setViseme("sil");
        }, at + openMs)
      );
      offset += openMs + gapMs;
    }
    session.timeouts.push(window.setTimeout(stopLipSync, offset + 250));
  };

  useEffect(() => {
    return () => {
      const session = lipSyncRef.current;
      if (!session) return;
      session.cancelled = true;
      session.timeouts.forEach(timer => window.clearTimeout(timer));
      try {
        session.audioCtx.close();
      } catch {
        /* already closed */
      }
    };
  }, []);

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

              <RivePreview
                key={selectedMascot.id}
                mascot={selectedMascot}
                pose={pose}
                viseme={viseme}
                channelValues={channelValues}
              />

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
            <button type="button" onClick={() => (lipSyncing ? stopLipSync() : playLipSync())}>
              {lipSyncing ? "Stop talking" : "Play lip-sync"}
            </button>
          </div>

          <div className="poseList">
            {(stateEngine?.idlePoseCycle ?? []).map(item => (
              <button key={item} type="button" onClick={() => setPose(item)}>
                {item}
              </button>
            ))}
          </div>

          {(stateEngine?.channels ?? []).map(channel => (
            <div className="channelControl" key={channel.key}>
              <label className="field">
                <span>{channel.label ?? channel.key}</span>
                <select
                  value={channelValues[channel.key] ?? ""}
                  onChange={event =>
                    setChannelValues(prev => ({ ...prev, [channel.key]: event.target.value }))
                  }>
                  {channel.values.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              {channel.cycle?.enabled ? (
                <button
                  type="button"
                  onClick={() =>
                    setChannelCycling(prev => ({ ...prev, [channel.key]: !prev[channel.key] }))
                  }>
                  {channelCycling[channel.key]
                    ? `Stop ${channel.label ?? channel.key} cycle`
                    : `Cycle ${channel.label ?? channel.key}`}
                </button>
              ) : null}
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
