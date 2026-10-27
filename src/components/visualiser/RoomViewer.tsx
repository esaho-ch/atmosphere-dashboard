"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CameraView, SceneApi } from "./RoomScene";
import type { RealisticRender } from "./pathtrace";
import {
  LAYOUT_LABEL, ROOM_PRESETS, SURFACE_LABEL, WALL_KEYS,
  type Layout, type RoomConfig, type RoomStyle, type RoomType, type SurfaceConfig, type SurfaceKey, type TileOption, type WallKey,
} from "./types";

const RoomScene = dynamic(() => import("./RoomScene"), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">Chargement de la 3D…</div>,
});

interface Props {
  tiles: TileOption[];
  initialFloor: string | null;
  initialWall: string | null;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const QUALITY = [
  { label: "Rapide", samples: 128 },
  { label: "Standard", samples: 384 },
  { label: "Haute", samples: 1024 },
];

const JOINT_COLORS = [
  { label: "Blanc", value: "#f2f2f0" },
  { label: "Gris clair", value: "#bdbdb9" },
  { label: "Gris", value: "#8c8c88" },
  { label: "Anthracite", value: "#4a4a4a" },
  { label: "Beige", value: "#cdbfa6" },
];

function presetRoom(type: RoomType, style: RoomStyle = "light"): RoomConfig {
  const p = ROOM_PRESETS[type];
  return { type, widthM: p.widthM, depthM: p.depthM, heightM: p.heightM, wallTiledM: p.wallTiledM, furniture: true, style };
}

const newSurface = (tileId: string | null): SurfaceConfig => ({
  tileId, layout: "straight", jointMm: 3, jointColor: JOINT_COLORS[1].value,
});

export default function RoomViewer({ tiles, initialFloor, initialWall }: Props) {
  const [room, setRoom] = useState<RoomConfig>(() => presetRoom("bathroom"));
  const [floor, setFloor] = useState<SurfaceConfig>(() => newSurface(initialFloor ?? tiles[0]?.id ?? null));
  const [walls, setWalls] = useState<Record<WallKey, SurfaceConfig>>(() => ({
    back: newSurface(initialWall ?? null),
    left: newSurface(initialWall ?? null),
    right: newSurface(initialWall ?? null),
    front: newSurface(initialWall ?? null),
  }));
  const [tab, setTab] = useState<SurfaceKey>("floor");
  const [q, setQ] = useState("");
  const [supplier, setSupplier] = useState("");
  const suppliers = useMemo(() => [...new Set(tiles.map((t) => t.detail.split(" · ")[0]).filter(Boolean))].sort(), [tiles]);

  const apiRef = useRef<SceneApi | null>(null);
  const handleReady = useCallback((api: SceneApi | null) => { apiRef.current = api; }, []);
  const renderRef = useRef<RealisticRender | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState("");
  const [rt, setRt] = useState<{ open: boolean; samples: number; target: number; done: boolean; starting: boolean }>(
    { open: false, samples: 0, target: 256, done: false, starting: false }
  );

  const closeRender = () => {
    renderRef.current?.dispose();
    renderRef.current = null;
    setRt((r) => ({ ...r, open: false }));
  };
  useEffect(() => () => { renderRef.current?.dispose(); }, []);

  const exportSnapshot = async () => {
    setExportError("");
    try {
      const blob = await apiRef.current!.snapshot(3200);
      download(blob, `visualisation-${room.type}.png`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export impossible");
    }
  };

  const startRealistic = async (target: number) => {
    const api = apiRef.current;
    if (!api) return;
    setExportError("");
    renderRef.current?.dispose();
    setRt({ open: true, samples: 0, target, done: false, starting: true });
    try {
      const { startRealisticRender } = await import("./pathtrace");
      const r = await startRealisticRender({
        scene: api.scene,
        camera: api.camera,
        width: 1600,
        height: 1000,
        samples: target,
        onProgress: (samples, done) => setRt((cur) => ({ ...cur, samples, done, starting: false })),
      });
      renderRef.current = r;
      r.canvas.style.width = "100%";
      r.canvas.style.height = "auto";
      r.canvas.style.display = "block";
      holderRef.current?.replaceChildren(r.canvas);
    } catch (e) {
      setRt((cur) => ({ ...cur, open: false }));
      setExportError(e instanceof Error ? e.message : "Rendu impossible sur cet appareil");
    }
  };

  const saveRender = async () => {
    const blob = await renderRef.current?.toBlob();
    if (blob) download(blob, `rendu-realiste-${room.type}.png`);
  };

  const tileMap = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);
  const surface = tab === "floor" ? floor : walls[tab];
  const patch = (p: Partial<SurfaceConfig>) => {
    if (tab === "floor") setFloor((s) => ({ ...s, ...p }));
    else setWalls((w) => ({ ...w, [tab]: { ...w[tab], ...p } }));
  };
  const applyToAllWalls = () => {
    if (tab === "floor") return;
    setWalls((w) => ({ back: { ...w[tab] }, left: { ...w[tab] }, right: { ...w[tab] }, front: { ...w[tab] } }));
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = supplier ? tiles.filter((t) => t.detail.split(" · ")[0] === supplier) : tiles;
    if (needle) list = list.filter((t) => `${t.name} ${t.detail}`.toLowerCase().includes(needle));
    return list.slice(0, 80);
  }, [tiles, q, supplier]);

  const numInput = (label: string, value: number, onChange: (v: number) => void, step = 0.1, min = 0.5, max = 12) => (
    <label className="text-xs text-slate-400 flex flex-col gap-1">
      {label}
      <input type="number" step={step} min={min} max={max} value={value}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 w-full bg-white" />
    </label>
  );

  const selected = surface.tileId != null ? tileMap.get(surface.tileId) : undefined;

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-80 shrink-0 bg-white border-r border-slate-200 overflow-y-auto p-5 space-y-6">
        {/* Room */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pièce</h2>
          <div className="flex gap-1">
            {(Object.keys(ROOM_PRESETS) as RoomType[]).map((t) => (
              <button key={t} onClick={() => setRoom((r) => presetRoom(t, r.style))}
                className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  room.type === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {ROOM_PRESETS[t].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {numInput("Largeur (m)", room.widthM, (v) => setRoom((r) => ({ ...r, widthM: v })))}
            {numInput("Profondeur (m)", room.depthM, (v) => setRoom((r) => ({ ...r, depthM: v })))}
            {numInput("Hauteur (m)", room.heightM, (v) => setRoom((r) => ({ ...r, heightM: v, wallTiledM: Math.min(r.wallTiledM, v) })), 0.1, 2, 4)}
          </div>
          {numInput("Hauteur carrelée des murs (m)", room.wallTiledM, (v) => setRoom((r) => ({ ...r, wallTiledM: Math.min(v, r.heightM) })), 0.1, 0, 4)}
          <div className="flex gap-1">
            {([["light", "Bois & blanc"], ["dark", "Noir & laiton"]] as [RoomStyle, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setRoom((r) => ({ ...r, style: k }))}
                className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  room.style === k ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={room.furniture} onChange={(e) => setRoom((r) => ({ ...r, furniture: e.target.checked }))} />
            Afficher les meubles
          </label>
        </section>

        {/* Surface */}
        <section className="space-y-3">
          <div className="grid grid-cols-5 gap-1">
            {(["floor", ...WALL_KEYS] as SurfaceKey[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {SURFACE_LABEL[t]}
              </button>
            ))}
          </div>
          {tab !== "floor" && (
            <button onClick={applyToAllWalls} className="text-xs text-slate-500 underline hover:text-slate-900">
              Appliquer ce réglage aux 4 murs
            </button>
          )}

          <p className="text-sm text-slate-700">
            {selected ? <><span className="font-medium">{selected.name}</span> <span className="text-slate-400">· {selected.widthCm}×{selected.heightCm} cm</span></> : <span className="text-slate-400">Peinture (aucun carrelage)</span>}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Pose
              <select value={surface.layout} onChange={(e) => patch({ layout: e.target.value as Layout })}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 bg-white">
                {(Object.keys(LAYOUT_LABEL) as Layout[]).map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>)}
              </select>
            </label>
            {numInput("Joint (mm)", surface.jointMm, (v) => patch({ jointMm: v }), 0.5, 0, 15)}
          </div>
          <div className="flex items-center gap-1.5">
            {JOINT_COLORS.map((c) => (
              <button key={c.value} title={`Joint ${c.label}`} onClick={() => patch({ jointColor: c.value })}
                style={{ background: c.value }}
                className={`size-6 rounded-full border ${surface.jointColor === c.value ? "ring-2 ring-slate-900 ring-offset-1" : "border-slate-300"}`} />
            ))}
          </div>

          <div className="flex gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un carrelage…"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0 bg-white" />
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white max-w-32">
              <option value="">Tous</option>
              {suppliers.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <button onClick={() => patch({ tileId: null })}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-sm ${surface.tileId == null ? "bg-slate-100 font-medium" : "hover:bg-slate-50 text-slate-500"}`}>
              Aucun (peinture)
            </button>
            {filtered.map((t) => (
              <button key={t.id} onClick={() => patch({ tileId: t.id })}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left ${surface.tileId === t.id ? "bg-slate-100" : "hover:bg-slate-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.thumb} alt="" loading="lazy" className="size-9 rounded object-cover border border-slate-200 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-900 truncate">{t.name}</span>
                  <span className="block text-xs text-slate-400 truncate">{t.detail} · {t.widthCm}×{t.heightCm}</span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-slate-400 px-2 py-2">Aucun résultat</p>}
          </div>
        </section>
      </aside>

      <div className="flex-1 min-w-0 relative">
        <RoomScene room={room} floor={floor} walls={walls} tiles={tileMap} onReady={handleReady} onWallClick={setTab} />
        <div className="absolute top-3 left-4 flex items-center gap-1 bg-white/90 border border-slate-200 rounded-lg p-1">
          {([["threeQuarter", "Vue 3/4"], ["front", "Face"], ["top", "Dessus"]] as [CameraView, string][]).map(([v, label]) => (
            <button key={v} onClick={() => apiRef.current?.setView(v)}
              className="px-2.5 py-1 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              {label}
            </button>
          ))}
        </div>
        <div className="absolute top-3 right-4 flex items-center gap-2">
          <button onClick={exportSnapshot}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/90 text-slate-700 border border-slate-200 hover:bg-white transition-colors">
            Image HD
          </button>
          <button onClick={() => startRealistic(QUALITY[1].samples)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors">
            Rendu réaliste
          </button>
        </div>
        {exportError && (
          <p className="absolute top-14 right-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{exportError}</p>
        )}
        <p className="absolute bottom-3 left-4 text-xs text-slate-500 bg-white/80 rounded px-2 py-1 pointer-events-none">
          Clic sur un mur : le sélectionner · glisser : tourner · molette : zoom
        </p>
      </div>

      {rt.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-full overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Rendu réaliste</h2>
                <p className="text-xs text-slate-400">
                  {rt.starting ? "Préparation de la scène…" : rt.done ? "Rendu terminé" : `Calcul de la lumière… ${rt.samples} / ${rt.target} passes`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {QUALITY.map((qq) => (
                  <button key={qq.label} onClick={() => startRealistic(qq.samples)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${rt.target === qq.samples ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}>
                    {qq.label}
                  </button>
                ))}
                <button onClick={saveRender} disabled={rt.starting || rt.samples < 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
                  Télécharger
                </button>
                <button onClick={closeRender} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">
                  Fermer
                </button>
              </div>
            </div>
            <div className="h-1 bg-slate-100">
              <div className="h-1 bg-slate-900 transition-all" style={{ width: `${Math.min(100, (rt.samples / rt.target) * 100)}%` }} />
            </div>
            <div ref={holderRef} className="bg-slate-100 min-h-64" />
          </div>
        </div>
      )}
    </div>
  );
}
