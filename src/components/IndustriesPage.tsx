import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  industries as seedIndustries,
  allCertsById,
  type Industry,
  type SubIndustry,
  type CareerStage,
  type IndustryCert,
} from "../data/industries";
import {
  SearchIcon,
  DragHandleIcon,
  CheckIcon,
  TreeAddIcon,
  RowKebabIcon,
  RowEditIcon,
  RowEyeIcon,
  RowEyeOffIcon,
  RowDeleteIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SortIcon,
} from "./icons";
import { IndustriesSearch } from "./IndustriesSearch";
import { Dropdown } from "./Dropdown";
import { PillTrigger } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import { PrmModal } from "./PrmModal";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

/* Industries — Claude Design "Industries · Launcher + Hub" (2a / 4a).
   The page opens as a LAUNCHER: a full-width, keyboard-driven search over the
   industries ("Where to?"), one row per industry naming its first
   sub-industries. Picking a row lands on the industry's HUB: its
   sub-industries, then the core certifications tagged at the industry level
   — every list on the page is the same Large Table row (`LargeRow`). A sub-industry opens the same hub shape one level down.
   Left rail + tree retired here (the shared `.rail`/`.tree` chrome stays for
   the Question Bank). */

type Scope =
  | { kind: "industry"; industryKey: string }
  | { kind: "sub"; industryKey: string; subKey: string };

type ModalState =
  | { kind: "none" }
  | { kind: "new-industry" }
  | { kind: "new-sub"; industryKey: string }
  | { kind: "edit-industry"; industryKey: string }
  | { kind: "edit-sub"; industryKey: string; subKey: string }
  | { kind: "delete-confirm"; scope: Scope }
  | { kind: "remove-cert"; scope: Scope; certId: string }
  | { kind: "add-certs"; scope: Scope };

// Which row's 3-dot menu is open, plus where to anchor the popover.
type MenuState = { scope: Scope; x: number; y: number } | null;

/* One row of the launcher list. Without a query it is an industry; with one,
   sub-industries ("HVAC › Residential") and certifications join the results,
   each opening the scope it lives in. An industry carries its 1-based browse
   position, which it prints even when a query has thinned the list. */
type LaunchItem =
  | { kind: "industry"; key: string; industry: Industry; position: number }
  | { kind: "sub"; key: string; industry: Industry; sub: SubIndustry }
  | { kind: "cert"; key: string; cert: IndustryCert; scope: Scope; where: string };

/* Cert-row remove ✕ — Figma "Icon Library" (I318:1351;7:1802): a 6.6px cross
   centred in a 16px slot, 1.333 square-cap stroke. */
const RowCloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <path d="M4.7 4.7l6.6 6.6M11.3 4.7l-6.6 6.6" />
  </svg>
);

const CAREER_STAGES: CareerStage[] = ["Apprentice", "Journeyman", "Master"];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const subIndustryCount = (n: number) => `${n} sub-industr${n === 1 ? "y" : "ies"}`;

const industryCertTotal = (ind: Industry) =>
  ind.certIds.length + ind.subIndustries.reduce((n, s) => n + s.certIds.length, 0);

/* A row's second line names what sits one level down — Figma 1306:1208: the
   first three in browse order, then "... +N" for the rest ("Residential ·
   Commercial · Service & Repair... +1"). An industry lists its
   sub-industries, a sub-industry its certifications. */
const LINE_SHOWN = 3;
function childrenLine(names: string[], empty: string) {
  if (names.length === 0) return empty;
  const shown = names.slice(0, LINE_SHOWN).join(" · ");
  const rest = names.length - LINE_SHOWN;
  return rest > 0 ? `${shown}... +${rest}` : shown;
}
const subIndustriesLine = (ind: Industry) =>
  childrenLine(
    [...ind.subIndustries].sort((a, b) => a.displayPosition - b.displayPosition).map((s) => s.name),
    "No sub-industries",
  );
const certificationsLine = (sub: SubIndustry) =>
  childrenLine(
    sub.certIds.map((id) => allCertsById[id]?.name).filter((n): n is string => !!n),
    "No certifications",
  );

type HandleProps = React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };

/* ─── Large Table row ─────────────────────────────────────────────────────────
   Figma "Atomic - Complete Row - Large Table" (section 1306:1208) — the ONE
   row all three of this page's lists are cut from: a 16px drag handle, the
   1-based browse position, a name over a muted second line and a 16px
   trailing action, the handle and action drawn only on the hovered / driven
   row. The hub's sub-industries (1306:1393) and certifications (1306:1232)
   are the 60px cut; `size="lg"` is the launcher's 75px one (1306:1545).
   Callers own the drag-and-drop wiring (row props + `handle`) and the action
   button; the action's slot is kept when a row has none. */
function LargeRow({
  size,
  className = "",
  index,
  name,
  hiddenPill,
  meta,
  action,
  handle,
  ...rowProps
}: React.HTMLAttributes<HTMLDivElement> & {
  draggable?: boolean;
  size?: "lg";
  index?: number;
  name: React.ReactNode;
  /** Draws the "Hidden" tag beside the name. */
  hiddenPill?: boolean;
  meta: React.ReactNode;
  action?: React.ReactNode;
  /** Props for the drag handle, or null/undefined for a row that can't move. */
  handle?: HandleProps | null;
}) {
  return (
    <div className={`ind-row ${size === "lg" ? "ind-row--lg" : ""} ${className}`} {...rowProps}>
      <span
        className={`ind-row-drag ${handle ? "" : "is-disabled"}`}
        title={handle ? "Drag to reorder" : undefined}
        aria-hidden
        {...handle}
      >
        {handle && <DragHandleIcon />}
      </span>
      <span className="ind-row-index">{index}</span>
      <span className="ind-row-cell">
        <span className="ind-row-name">
          <span className="ind-row-name-text">{name}</span>
          {hiddenPill && <span className="ind-hidden-pill">Hidden</span>}
        </span>
        <span className="ind-row-meta">{meta}</span>
      </span>
      {action ?? <span className="ind-row-action" aria-hidden />}
    </div>
  );
}

export function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>(seedIndustries);
  // `null` is the launcher; a scope is the hub for that industry / sub-industry.
  const [scope, setScope] = useState<Scope | null>(null);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(0);
  /* The highlight is only DRAWN while a row is actually being driven — hovered
     ("pointer") or walked with the arrows ("keyboard") — or while a query is
     up, where the top hit is the ↵ target. At rest the list carries no
     selection, so an idle launcher never looks like something is hovered. */
  const [navMode, setNavMode] = useState<"idle" | "pointer" | "keyboard">("idle");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [menu, setMenu] = useState<MenuState>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const quiet = modal.kind === "none" && !menu;

  // "C" opens Add Certification on the hub; "I" opens New Industry on the
  // launcher (both badges are printed on their header CTAs).
  useCreateShortcut(
    () => scope && setModal({ kind: "add-certs", scope }),
    quiet && scope !== null,
  );
  useCreateShortcut(
    () => setModal({ kind: "new-industry" }),
    quiet && scope === null,
    "i",
  );

  const orderedIndustries = useMemo(
    () => [...industries].sort((a, b) => a.displayPosition - b.displayPosition),
    [industries],
  );

  // ─── Launcher results ─────────────────────────────────────────────────────
  const launchItems = useMemo<LaunchItem[]>(() => {
    const q = search.trim().toLowerCase();
    const out: LaunchItem[] = [];
    if (!q) {
      orderedIndustries.forEach((industry, i) =>
        out.push({ kind: "industry", key: industry.key, industry, position: i + 1 }),
      );
      return out;
    }
    const hit = (s?: string) => !!s && s.toLowerCase().includes(q);
    orderedIndustries.forEach((industry, i) => {
      if (hit(industry.name) || hit(industry.nameEs)) {
        out.push({ kind: "industry", key: industry.key, industry, position: i + 1 });
      }
    });
    orderedIndustries.forEach((industry) =>
      [...industry.subIndustries]
        .sort((a, b) => a.displayPosition - b.displayPosition)
        .forEach((sub) => {
          if (hit(sub.name) || hit(sub.nameEs)) out.push({ kind: "sub", key: sub.key, industry, sub });
        }),
    );
    // A certification opens the first scope it is tagged in.
    const seen = new Set<string>();
    orderedIndustries.forEach((industry) => {
      const consider = (id: string, sc: Scope, where: string) => {
        const cert = allCertsById[id];
        if (!cert || seen.has(id) || !hit(cert.name)) return;
        seen.add(id);
        out.push({ kind: "cert", key: `cert-${id}`, cert, scope: sc, where });
      };
      industry.certIds.forEach((id) =>
        consider(id, { kind: "industry", industryKey: industry.key }, industry.name),
      );
      industry.subIndustries.forEach((sub) =>
        sub.certIds.forEach((id) =>
          consider(
            id,
            { kind: "sub", industryKey: industry.key, subKey: sub.key },
            `${industry.name} › ${sub.name}`,
          ),
        ),
      );
    });
    return out.slice(0, 40);
  }, [orderedIndustries, search]);

  // The highlight goes back to the top on every new query, which also drops
  // any pointer/keyboard mode — the top hit is the ↵ target from there.
  useEffect(() => {
    setCursor(0);
    setNavMode("idle");
  }, [search]);
  /* Clamped on READ, not through an effect: a shrinking result list and the
     query's own reset-to-0 would otherwise be two writes racing in the same
     commit, and the clamp (running on the pre-reset cursor) won — typing left
     the highlight on the last row instead of the top hit. */
  const activeIdx = Math.min(cursor, Math.max(0, launchItems.length - 1));
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(".ind-row.is-active")
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, scope]);

  /* Coming back to the launcher: no selection. The bar is NOT focused — like
     every other landing it rests unfocused until clicked or ⌘K, and ↑↓↵ walk
     the list from anywhere on the page. */
  useEffect(() => {
    if (scope === null) setNavMode("idle");
  }, [scope]);

  const showActive = navMode !== "idle" || !!search.trim();

  function openItem(item: LaunchItem) {
    const next: Scope =
      item.kind === "industry"
        ? { kind: "industry", industryKey: item.industry.key }
        : item.kind === "sub"
          ? { kind: "sub", industryKey: item.industry.key, subKey: item.sub.key }
          : item.scope;
    setSearch("");
    setScope(next);
  }

  // ↑↓ walk the launcher, ↵ opens the highlighted row, Esc clears the query.
  useEffect(() => {
    if (scope !== null || !quiet) return;
    function onKey(e: KeyboardEvent) {
      // Already consumed by the search bar (a pending edit owns ↑↓↵Esc).
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const inField =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inField && t !== searchRef.current) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        // The first ↓ from an unselected list lands on the top row, not the second.
        setCursor(showActive ? Math.min(launchItems.length - 1, activeIdx + 1) : 0);
        setNavMode("keyboard");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor(showActive ? Math.max(0, activeIdx - 1) : 0);
        setNavMode("keyboard");
      } else if (e.key === "Enter") {
        // Nothing is highlighted at rest, so ↵ has no target until the list is
        // being driven — it never opens a row the eye can't see.
        const item = showActive ? launchItems[activeIdx] : null;
        if (!item) return;
        e.preventDefault();
        openItem(item);
      } else if (e.key === "Escape" && search) {
        e.preventDefault();
        setSearch("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, quiet, launchItems, activeIdx, search, showActive]);

  const currentIndustry = scope
    ? industries.find((i) => i.key === scope.industryKey) ?? null
    : null;
  const currentSub =
    scope?.kind === "sub" && currentIndustry
      ? currentIndustry.subIndustries.find((s) => s.key === scope.subKey) ?? null
      : null;

  // A scope whose target was deleted from under it falls back to the launcher.
  useEffect(() => {
    if (scope && (!currentIndustry || (scope.kind === "sub" && !currentSub))) setScope(null);
  }, [scope, currentIndustry, currentSub]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  function addIndustry(name: string, nameEs: string, hidden: boolean) {
    const key = `i-${Date.now()}`;
    setIndustries((prev) => [
      ...prev,
      {
        key,
        name,
        nameEs: nameEs || undefined,
        hidden,
        displayPosition: prev.length + 1,
        certIds: [],
        subIndustries: [],
      },
    ]);
    // A new industry opens straight into its (empty) hub.
    setSearch("");
    setScope({ kind: "industry", industryKey: key });
  }

  function addSub(industryKey: string, name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const newSub: SubIndustry = {
          key: `s-${Date.now()}`,
          name,
          nameEs: nameEs || undefined,
          hidden,
          displayPosition: i.subIndustries.length + 1,
          certIds: [],
        };
        return { ...i, subIndustries: [...i.subIndustries, newSub] };
      }),
    );
  }

  function editIndustry(key: string, name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, name, nameEs: nameEs || undefined, hidden } : i,
      ),
    );
  }

  function editSub(industryKey: string, subKey: string, name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === subKey ? { ...s, name, nameEs: nameEs || undefined, hidden } : s,
          ),
        };
      }),
    );
  }

  function toggleIndustryHidden(key: string) {
    setIndustries((prev) =>
      prev.map((i) => (i.key === key ? { ...i, hidden: !i.hidden } : i)),
    );
  }

  function toggleSubHidden(industryKey: string, subKey: string) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === subKey ? { ...s, hidden: !s.hidden } : s,
          ),
        };
      }),
    );
  }

  function deleteIndustry(key: string) {
    setIndustries((prev) => {
      const target = prev.find((i) => i.key === key);
      if (!target) return prev;
      return prev
        .filter((i) => i.key !== key)
        .map((i) =>
          i.displayPosition > target.displayPosition
            ? { ...i, displayPosition: i.displayPosition - 1 }
            : i,
        );
    });
    setScope(null);
  }

  function deleteSub(industryKey: string, subKey: string) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const target = i.subIndustries.find((s) => s.key === subKey);
        if (!target) return i;
        const subs = i.subIndustries
          .filter((s) => s.key !== subKey)
          .map((s) =>
            s.displayPosition > target.displayPosition
              ? { ...s, displayPosition: s.displayPosition - 1 }
              : s,
          );
        return { ...i, subIndustries: subs };
      }),
    );
    setScope({ kind: "industry", industryKey });
  }

  // Reorder the full industry list from a dragged ordering of keys.
  function reorderIndustries(orderedKeys: string[]) {
    setIndustries((prev) => {
      const byKey = new Map(prev.map((i) => [i.key, i]));
      return orderedKeys
        .map((k) => byKey.get(k))
        .filter((i): i is Industry => !!i)
        .map((i, idx) => ({ ...i, displayPosition: idx + 1 }));
    });
  }

  // Reorder Sub-Industries within a single Industry.
  function reorderSubs(industryKey: string, orderedKeys: string[]) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const byKey = new Map(i.subIndustries.map((s) => [s.key, s]));
        const subs = orderedKeys
          .map((k) => byKey.get(k))
          .filter((s): s is SubIndustry => !!s)
          .map((s, idx) => ({ ...s, displayPosition: idx + 1 }));
        return { ...i, subIndustries: subs };
      }),
    );
  }

  function updateScopeCerts(sc: Scope, fn: (ids: string[]) => string[]) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== sc.industryKey) return i;
        if (sc.kind === "industry") return { ...i, certIds: fn(i.certIds) };
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === sc.subKey ? { ...s, certIds: fn(s.certIds) } : s,
          ),
        };
      }),
    );
  }

  // ─── Where is a cert currently tagged? ────────────────────────────────────
  function tagsForCert(certId: string): { industryName: string; subName?: string }[] {
    const out: { industryName: string; subName?: string }[] = [];
    for (const ind of industries) {
      if (ind.certIds.includes(certId)) out.push({ industryName: ind.name });
      for (const sub of ind.subIndustries) {
        if (sub.certIds.includes(certId)) out.push({ industryName: ind.name, subName: sub.name });
      }
    }
    return out;
  }

  // ─── Menu ────────────────────────────────────────────────────────────────
  function openMenu(e: React.MouseEvent, menuScope: Scope) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ scope: menuScope, x: r.right, y: r.bottom });
  }

  const menuIsHidden = (() => {
    if (!menu) return false;
    const sc = menu.scope;
    const ind = industries.find((i) => i.key === sc.industryKey);
    if (!ind) return false;
    if (sc.kind === "industry") return !!ind.hidden;
    return !!ind.subIndustries.find((s) => s.key === sc.subKey)?.hidden;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────
  const scopeCertIds = scope
    ? scope.kind === "industry"
      ? currentIndustry?.certIds ?? []
      : currentSub?.certIds ?? []
    : [];

  return (
    <div className="main">
      <div className="workspace">
        {scope === null || !currentIndustry ? (
          <Launcher
            search={search}
            onSearch={setSearch}
            searchRef={searchRef}
            listRef={listRef}
            items={launchItems}
            activeIndex={showActive ? activeIdx : -1}
            onHover={(idx) => {
              setCursor(idx);
              setNavMode("pointer");
            }}
            onLeaveList={() => setNavMode((m) => (m === "pointer" ? "idle" : m))}
            onOpen={openItem}
            onNewIndustry={() => setModal({ kind: "new-industry" })}
            onMenu={openMenu}
            onReorder={reorderIndustries}
          />
        ) : (
          <Hub
            industry={currentIndustry}
            sub={currentSub}
            certIds={scopeCertIds}
            onBackToLauncher={() => setScope(null)}
            onBackToIndustry={() =>
              setScope({ kind: "industry", industryKey: currentIndustry.key })
            }
            onAddCerts={() => setModal({ kind: "add-certs", scope })}
            onMenu={(e) => openMenu(e, scope)}
            onSubMenu={(e, subKey) =>
              openMenu(e, { kind: "sub", industryKey: currentIndustry.key, subKey })
            }
            onNewSub={() => setModal({ kind: "new-sub", industryKey: currentIndustry.key })}
            onOpenSub={(subKey) => setScope({ kind: "sub", industryKey: currentIndustry.key, subKey })}
            onReorderSubs={(keys) => reorderSubs(currentIndustry.key, keys)}
            onReorderCerts={(ids) => updateScopeCerts(scope, () => ids)}
            onRemoveCert={(id) => setModal({ kind: "remove-cert", scope, certId: id })}
          />
        )}
      </div>

      {/* ─── Row / header 3-dot menu ─── */}
      {menu && (
        <>
          <div className="ind-menu-backdrop" onClick={() => setMenu(null)} />
          <div
            className="u-menu ind-row-menu"
            style={{ top: menu.y + 6, left: menu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="u-menu-item"
              onClick={() => {
                setModal(
                  menu.scope.kind === "industry"
                    ? { kind: "edit-industry", industryKey: menu.scope.industryKey }
                    : { kind: "edit-sub", industryKey: menu.scope.industryKey, subKey: menu.scope.subKey },
                );
                setMenu(null);
              }}
            >
              <span className="u-menu-item-icon"><RowEditIcon /></span> Edit
            </button>
            <button
              className="u-menu-item"
              onClick={() => {
                if (menu.scope.kind === "industry") toggleIndustryHidden(menu.scope.industryKey);
                else toggleSubHidden(menu.scope.industryKey, menu.scope.subKey);
                setMenu(null);
              }}
            >
              <span className="u-menu-item-icon">
                {menuIsHidden ? <RowEyeIcon /> : <RowEyeOffIcon />}
              </span>{" "}
              {menuIsHidden ? "Show" : "Hide"}
            </button>
            <button
              className="u-menu-item u-menu-item--danger"
              onClick={() => {
                setModal({ kind: "delete-confirm", scope: menu.scope });
                setMenu(null);
              }}
            >
              <span className="u-menu-item-icon"><RowDeleteIcon /></span> Delete
            </button>
          </div>
        </>
      )}

      {/* ─── Modals ─── */}
      {modal.kind === "new-industry" && (
        <NameModal
          title="New Industry"
          nameLabel="Name"
          nameHelp="Must be unique across all Industries."
          defaultName=""
          defaultNameEs=""
          defaultHidden={false}
          existingNames={industries.map((i) => i.name.toLowerCase())}
          submitLabel="Create Industry"
          onSubmit={(name, nameEs, hidden) => {
            addIndustry(name, nameEs, hidden);
            setModal({ kind: "none" });
          }}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}

      {modal.kind === "new-sub" && (() => {
        const parent = industries.find((i) => i.key === modal.industryKey);
        if (!parent) return null;
        return (
          <NameModal
            title={`New Sub-Industry in ${parent.name}`}
            nameLabel="Name"
            nameHelp={`Must be unique within ${parent.name}. Can repeat across other Industries.`}
            defaultName=""
            defaultNameEs=""
            defaultHidden={false}
            existingNames={parent.subIndustries.map((s) => s.name.toLowerCase())}
            submitLabel="Create Sub-Industry"
            onSubmit={(name, nameEs, hidden) => {
              addSub(modal.industryKey, name, nameEs, hidden);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "edit-industry" && (() => {
        const ind = industries.find((i) => i.key === modal.industryKey);
        if (!ind) return null;
        return (
          <NameModal
            title="Edit Industry"
            nameLabel="Name"
            nameHelp="Must be unique across all Industries."
            defaultName={ind.name}
            defaultNameEs={ind.nameEs ?? ""}
            defaultHidden={!!ind.hidden}
            existingNames={industries
              .filter((i) => i.key !== modal.industryKey)
              .map((i) => i.name.toLowerCase())}
            submitLabel="Save"
            onSubmit={(name, nameEs, hidden) => {
              editIndustry(modal.industryKey, name, nameEs, hidden);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "edit-sub" && (() => {
        const parent = industries.find((i) => i.key === modal.industryKey);
        const sub = parent?.subIndustries.find((s) => s.key === modal.subKey);
        if (!parent || !sub) return null;
        return (
          <NameModal
            title={`Edit Sub-Industry in ${parent.name}`}
            nameLabel="Name"
            nameHelp={`Must be unique within ${parent.name}.`}
            defaultName={sub.name}
            defaultNameEs={sub.nameEs ?? ""}
            defaultHidden={!!sub.hidden}
            existingNames={parent.subIndustries
              .filter((s) => s.key !== modal.subKey)
              .map((s) => s.name.toLowerCase())}
            submitLabel="Save"
            onSubmit={(name, nameEs, hidden) => {
              editSub(modal.industryKey, modal.subKey, name, nameEs, hidden);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "delete-confirm" && (() => {
        const dScope = modal.scope;
        const ind = industries.find((i) => i.key === dScope.industryKey);
        if (!ind) return null;
        const isIndustry = dScope.kind === "industry";
        const sub = dScope.kind === "sub" ? ind.subIndustries.find((s) => s.key === dScope.subKey) : null;
        const label = isIndustry ? ind.name : `${ind.name} › ${sub?.name}`;
        const certCount = isIndustry ? industryCertTotal(ind) : sub?.certIds.length ?? 0;
        const subCount = isIndustry ? ind.subIndustries.length : 0;
        return (
          <DeleteConfirm
            title={`Delete ${isIndustry ? "Industry" : "Sub-Industry"}?`}
            label={label}
            certCount={certCount}
            subCount={subCount}
            isIndustry={isIndustry}
            onConfirm={() => {
              if (dScope.kind === "industry") deleteIndustry(dScope.industryKey);
              else deleteSub(dScope.industryKey, dScope.subKey);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "remove-cert" && (() => {
        const target = modal.scope;
        const certId = modal.certId;
        const ind = industries.find((i) => i.key === target.industryKey);
        const cert = allCertsById[certId];
        const sub = target.kind === "sub" ? ind?.subIndustries.find((s) => s.key === target.subKey) : null;
        if (!ind || !cert || (target.kind === "sub" && !sub)) return null;
        return (
          <RemoveCertConfirm
            certName={cert.name}
            scopeLabel={sub ? `${ind.name} › ${sub.name}` : ind.name}
            isIndustry={target.kind === "industry"}
            // Tagged here and nowhere else → removing it drops it from browse.
            lastTag={tagsForCert(certId).length <= 1}
            onConfirm={() => {
              updateScopeCerts(target, (ids) => ids.filter((c) => c !== certId));
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "add-certs" && (() => {
        const target = modal.scope;
        const ind = industries.find((i) => i.key === target.industryKey);
        if (!ind) return null;
        const sub = target.kind === "sub" ? ind.subIndustries.find((s) => s.key === target.subKey) : null;
        const already = target.kind === "industry" ? ind.certIds : sub?.certIds ?? [];
        return (
          <AddCertsModal
            industryName={ind.name}
            subName={sub?.name}
            alreadyAtScope={new Set(already)}
            tagsForCert={tagsForCert}
            onAdd={(ids) => {
              updateScopeCerts(target, (cur) => [...cur, ...ids]);
              setModal({ kind: "none" });
            }}
            onClose={() => setModal({ kind: "none" })}
          />
        );
      })()}
    </div>
  );
}

/* ─── Launcher (2a) ───────────────────────────────────────────────────────── */

function Launcher({
  search,
  onSearch,
  searchRef,
  listRef,
  items,
  activeIndex,
  onHover,
  onLeaveList,
  onOpen,
  onNewIndustry,
  onMenu,
  onReorder,
}: {
  search: string;
  onSearch: (q: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  listRef: React.RefObject<HTMLDivElement>;
  items: LaunchItem[];
  /** The row drawn as selected, or -1 while the list is idle. */
  activeIndex: number;
  onHover: (idx: number) => void;
  onLeaveList: () => void;
  onOpen: (item: LaunchItem) => void;
  onNewIndustry: () => void;
  onMenu: (e: React.MouseEvent, scope: Scope) => void;
  onReorder: (orderedKeys: string[]) => void;
}) {
  // Drag reordering is only safe against the full, unfiltered order.
  const canDrag = !search.trim();
  const [overKey, setOverKey] = useState<string | null>(null);
  const industryKeys = items
    .filter((i): i is Extract<LaunchItem, { kind: "industry" }> => i.kind === "industry")
    .map((i) => i.industry.key);

  function dropOn(e: React.DragEvent, toKey: string) {
    e.preventDefault();
    setOverKey(null);
    const fromKey = e.dataTransfer.getData("ind/industry");
    if (!fromKey || fromKey === toKey) return;
    const keys = [...industryKeys];
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, fromKey);
    onReorder(keys);
  }

  const q = search.trim();
  const noHits = q && items.length === 0;

  return (
    <div className="tasks ind-launch">
      {/* The page header the rest of the app runs: the title, no crumb trail
          (the landing IS the top of this page, and the sidebar's
          Certifications entry stays lit as the way back out), and the primary
          "Add Industry" CTA top-right with its "I" keycap (the user,
          2026-09-24) — it moved here when the list's head row, which had
          carried the "+", was removed. */}
      <header className="tasks-header">
        <div className="rvc-pagehead">
          <h1 className="tasks-title">Industries</h1>
        </div>
        <div className="tasks-header-actions">
          <button className="cta-primary" onClick={onNewIndustry}>
            Add Industry
            <span className="cta-kbd">I</span>
          </button>
        </div>
      </header>

      {/* The Tasks search as it sits once that page is scrolled to its table:
          the shared `.usearch` bar at its default size, right under the
          header (App.tsx's ⌘K handler focuses the first visible
          .usearch-input). */}
      <div className="ind-launch-search">
        <IndustriesSearch query={search} onCommit={onSearch} inputRef={searchRef} />
      </div>

      {/* Figma 1306:1545 — the Large Table row at its 75px launcher cut, one
          per industry: browse position, name, first sub-industries. Query
          hits (sub-industries, certifications) take the same row with the
          position left blank and what they hold / where they live below. */}
      <div className="ind-launch-list" ref={listRef} onMouseLeave={onLeaveList}>
          {noHits && <div className="ind-launch-empty">Nothing matches “{q}”</div>}
          {items.map((item, idx) => {
            const active = idx === activeIndex ? "is-active" : "";
            const driven = {
              role: "button",
              tabIndex: -1,
              onMouseEnter: () => onHover(idx),
              onClick: () => onOpen(item),
            };
            if (item.kind === "industry") {
              const { industry, position } = item;
              return (
                <LargeRow
                  key={item.key}
                  size="lg"
                  className={`${active} ${industry.hidden ? "is-hidden-item" : ""} ${overKey === industry.key ? "is-drop-over" : ""}`}
                  {...driven}
                  onDragOver={(e) => {
                    if (!canDrag || !e.dataTransfer.types.includes("ind/industry")) return;
                    e.preventDefault();
                    setOverKey(industry.key);
                  }}
                  onDragLeave={() => setOverKey(null)}
                  onDrop={(e) => dropOn(e, industry.key)}
                  // Only the handle drags here — the row itself is a click target.
                  handle={
                    canDrag
                      ? {
                          draggable: true,
                          onClick: (e) => e.stopPropagation(),
                          onDragStart: (e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("ind/industry", industry.key);
                          },
                        }
                      : null
                  }
                  index={position}
                  name={industry.name}
                  hiddenPill={industry.hidden}
                  meta={subIndustriesLine(industry)}
                  action={
                    <button
                      className="ind-row-action"
                      aria-label="Industry options"
                      onClick={(e) => onMenu(e, { kind: "industry", industryKey: industry.key })}
                    >
                      <RowKebabIcon />
                    </button>
                  }
                />
              );
            }
            if (item.kind === "sub") {
              const { industry, sub } = item;
              return (
                <LargeRow
                  key={item.key}
                  size="lg"
                  className={`${active} ${sub.hidden || industry.hidden ? "is-hidden-item" : ""}`}
                  {...driven}
                  name={
                    <>
                      <span className="ind-row-parent">{industry.name} › </span>
                      {sub.name}
                    </>
                  }
                  hiddenPill={sub.hidden}
                  meta={certificationsLine(sub)}
                  action={
                    <button
                      className="ind-row-action"
                      aria-label="Sub-Industry options"
                      onClick={(e) => onMenu(e, { kind: "sub", industryKey: industry.key, subKey: sub.key })}
                    >
                      <RowKebabIcon />
                    </button>
                  }
                />
              );
            }
            return (
              <LargeRow
                key={item.key}
                size="lg"
                className={active}
                {...driven}
                name={item.cert.name}
                meta={`in ${item.where}`}
              />
            );
          })}
      </div>
    </div>
  );
}

/* ─── Hub (4a) — an industry, or a sub-industry one level down ────────────── */

function Hub({
  industry,
  sub,
  certIds,
  onBackToLauncher,
  onBackToIndustry,
  onAddCerts,
  onMenu,
  onSubMenu,
  onNewSub,
  onOpenSub,
  onReorderSubs,
  onReorderCerts,
  onRemoveCert,
}: {
  industry: Industry;
  sub: SubIndustry | null;
  certIds: string[];
  /** Crumb targets: the launcher, and (from a sub) its parent industry. */
  onBackToLauncher: () => void;
  onBackToIndustry: () => void;
  onAddCerts: () => void;
  /** The header ⋯ — options for the hub's own industry / sub-industry. */
  onMenu: (e: React.MouseEvent) => void;
  /** A sub-industry row's ⋯. */
  onSubMenu: (e: React.MouseEvent, subKey: string) => void;
  onNewSub: () => void;
  onOpenSub: (subKey: string) => void;
  onReorderSubs: (orderedKeys: string[]) => void;
  onReorderCerts: (ids: string[]) => void;
  onRemoveCert: (id: string) => void;
}) {
  const name = sub ? sub.name : industry.name;
  const hidden = sub ? !!(sub.hidden || industry.hidden) : !!industry.hidden;
  const orderedSubs = [...industry.subIndustries].sort(
    (a, b) => a.displayPosition - b.displayPosition,
  );
  const [overKey, setOverKey] = useState<string | null>(null);

  function dropOn(e: React.DragEvent, toKey: string) {
    e.preventDefault();
    setOverKey(null);
    const fromKey = e.dataTransfer.getData("ind/sub");
    if (!fromKey || fromKey === toKey) return;
    const keys = orderedSubs.map((s) => s.key);
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, fromKey);
    onReorderSubs(keys);
  }

  // The page subtext's facts, split by the shared `.tasks-subtitle-dot`.
  const facts = sub
    ? [plural(sub.certIds.length, "certification"), `in ${industry.name}`]
    : [
        plural(industryCertTotal(industry), "certification"),
        subIndustryCount(industry.subIndustries.length),
      ];

  return (
    <div className="tasks ind-hub">
      <div className="ind-hub-col">
        {/* The shared page header, exactly as the other breadcrumbed pages run
            it (Feedback Forms, Who Paid, Offer Codes): crumbs, 28px title,
            the 16px subtext 2px under it with dot separators, and the header
            actions top-right. */}
        <header className="tasks-header">
          <div className="rvc-pagehead">
            {/* The app's breadcrumb atom (.rvc-crumbs / .rvc-crumb), the same
                trail Awards and the Question Bank run: every step above the
                current one navigates, the last is the page itself. */}
            <nav className="rvc-crumbs" aria-label="Breadcrumb">
              <button
                className="rvc-crumb"
                onClick={onBackToLauncher}
                title="Back to Industries"
              >
                Industries
              </button>
              <ChevronRightIcon />
              {sub ? (
                <>
                  <button
                    className="rvc-crumb"
                    onClick={onBackToIndustry}
                    title={`Back to ${industry.name}`}
                  >
                    {industry.name}
                  </button>
                  <ChevronRightIcon />
                  <span className="rvc-crumb rvc-crumb--current">{sub.name}</span>
                </>
              ) : (
                <span className="rvc-crumb rvc-crumb--current">{industry.name}</span>
              )}
            </nav>
            <div className="ind-hub-toprow">
              <h1 className="tasks-title">{name}</h1>
              {hidden && <span className="ind-hidden-pill">Hidden</span>}
            </div>
            <div className="tasks-subtitle">
              {facts.map((f, i) => (
                <Fragment key={f}>
                  {i > 0 && <span className="tasks-subtitle-dot" />}
                  <span>{f}</span>
                </Fragment>
              ))}
            </div>
          </div>
          <div className="tasks-header-actions">
            <button className="cta-primary" onClick={onAddCerts}>
              Add Certification
              <span className="cta-kbd">C</span>
            </button>
            <button
              className="cta-quiet cta-quiet--icon"
              aria-label={sub ? "Sub-Industry options" : "Industry options"}
              onClick={onMenu}
            >
              <RowKebabIcon />
            </button>
          </div>
        </header>

        {!sub && (
          <section className="ind-section">
            <SecHead
              title={`Sub-Industries in “${industry.name}”`}
              addLabel="New Sub-Industry"
              onAdd={onNewSub}
            />
            {orderedSubs.length === 0 ? (
              <div className="ind-sec-empty">
                No sub-industries yet — every certification here is shown to every {industry.name} learner.
              </div>
            ) : (
              /* Figma 1306:1393 — the Large Table row, the same one the
                 certifications below use: position, name, its first
                 certifications, and a ⋯ for Edit / Hide / Delete. The whole
                 row drags to reorder and opens the sub-industry. */
              <div className="ind-rowlist">
                {orderedSubs.map((s, i) => (
                  <LargeRow
                    key={s.key}
                    className={`${s.hidden ? "is-hidden-item" : ""} ${overKey === s.key ? "is-drop-over" : ""}`}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("ind/sub", s.key);
                    }}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes("ind/sub")) return;
                      e.preventDefault();
                      setOverKey(s.key);
                    }}
                    onDragLeave={() => setOverKey(null)}
                    onDragEnd={() => setOverKey(null)}
                    onDrop={(e) => dropOn(e, s.key)}
                    onClick={() => onOpenSub(s.key)}
                    onKeyDown={(e) => {
                      // Only the row itself — a keypress on its ⋯ bubbles here too.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenSub(s.key);
                      }
                    }}
                    handle={{}}
                    index={i + 1}
                    name={s.name}
                    hiddenPill={s.hidden}
                    meta={certificationsLine(s)}
                    action={
                      <button
                        className="ind-row-action"
                        aria-label="Sub-Industry options"
                        onClick={(e) => onSubMenu(e, s.key)}
                      >
                        <RowKebabIcon />
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="ind-section">
          <SecHead
            title={`Certifications in “${name}”`}
            addLabel="Add Certification"
            onAdd={onAddCerts}
          />
          <CertList certIds={certIds} onReorder={onReorderCerts} onRemove={onRemoveCert} />
        </section>
      </div>
    </div>
  );
}

/* Section head — Figma 1240:1186 (663:909 / 663:907): a 24px row with the
   scope-named title (20px Fira SemiBold white, curly quotes) and a bare 20px
   white "+" at the far right. It replaced the shared uppercase `SectionHeading`
   + its "New Sub-Industry" / "Add" text buttons on 2026-09-18; the glyph is the
   shared TreeAddIcon scaled from 16 to 20 (its 1.333 stroke rides up to the
   node's 1.667 with it). The label the button drops lives in its tooltip. */
function SecHead({
  title,
  addLabel,
  onAdd,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="ind-sechead">
      <h2 className="ind-sechead-title">{title}</h2>
      <button className="ind-sechead-add" onClick={onAdd} aria-label={addLabel} title={addLabel}>
        <TreeAddIcon />
      </button>
    </div>
  );
}

/* ─── Cert list (with drag-to-reorder) ────────────────────────────────────── */

function CertList({
  certIds,
  onReorder,
  onRemove,
}: {
  certIds: string[];
  onReorder: (next: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  if (certIds.length === 0) {
    return (
      <div className="u-empty ind-cert-empty">
        <div className="ind-cert-empty-title">No certifications tagged here yet</div>
        <div className="ind-cert-empty-sub">
          Use <strong>Add Certification</strong> to attach existing certifications.
        </div>
      </div>
    );
  }

  function onDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...certIds];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    onReorder(next);
    setDragIdx(null);
    setOverIdx(null);
  }

  /* Figma 1306:1232 — the Large Table row: position (the order the handle
     sets, and the order learners browse in), name, "Apprentice · 8 hours",
     and a ✕ that removes the tag from this scope only. */
  return (
    <div className="ind-rowlist ind-certtable">
      {certIds.map((id, idx) => {
        const cert = allCertsById[id];
        if (!cert) return null;
        const isDragging = dragIdx === idx;
        const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
        return (
          <LargeRow
            key={id}
            className={`${isDragging ? "is-dragging" : ""} ${isOver ? "is-drop-over" : ""}`}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(idx);
            }}
            onDrop={onDrop}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            handle={{}}
            index={idx + 1}
            name={cert.name}
            meta={`${cert.stage} · ${cert.hours} ${cert.hours === 1 ? "hour" : "hours"}`}
            action={
              <button
                className="ind-row-action"
                aria-label="Remove from here"
                title="Remove from here"
                onClick={() => onRemove(id)}
              >
                <RowCloseIcon />
              </button>
            }
          />
        );
      })}
    </div>
  );
}

/* ─── Name + translation + visibility modal ───────────────────────────────── */

/* The shared confirm shell (PrmModal, Figma 483:588) with the shared field
   atoms inside it — `.prm-field` label + the EN/ES `.lang-field` + a two-option
   `.seg-control` for Visibility. It ran on a hand-rolled `.pm-*` card with a
   `.tab-switch` until 2026-09-18, which made the page's pop-ups the only ones
   in the app that weren't the design system's.
   PrmModal has no key handling of its own, so the owner closes on Escape. */
function NameModal({
  title,
  nameLabel,
  nameHelp,
  defaultName,
  defaultNameEs,
  defaultHidden,
  existingNames,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  nameLabel: string;
  nameHelp: string;
  defaultName: string;
  defaultNameEs: string;
  defaultHidden: boolean;
  existingNames: string[];
  submitLabel: string;
  onSubmit: (name: string, nameEs: string, hidden: boolean) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [nameEs, setNameEs] = useState(defaultNameEs);
  const [hidden, setHidden] = useState(defaultHidden);

  const trimmed = name.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit() {
    if (!isValid) return;
    onSubmit(trimmed, nameEs.trim(), hidden);
  }

  return (
    <PrmModal
      title={title}
      description={nameHelp}
      confirmLabel={submitLabel}
      confirmDisabled={!isValid}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            {nameLabel}
            <span className="prm-req">*</span>
          </span>
          <div className="lang-field">
            <div className="lang-field-row">
              <span className="lang-tag">EN</span>
              <input
                autoFocus
                className="lang-field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Solar & Renewables"
              />
            </div>
            <div className="lang-field-divider" />
            <div className="lang-field-row">
              <span className="lang-tag">ES</span>
              <input
                className="lang-field-input"
                value={nameEs}
                onChange={(e) => setNameEs(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Solar y Energías Renovables"
              />
            </div>
          </div>
          {isDuplicate ? (
            <p className="form-help oc-error">
              A {nameLabel.toLowerCase()} with this name already exists.
            </p>
          ) : (
            <p className="form-help">
              Spanish is optional — it falls back to the English name.
            </p>
          )}
        </div>

        <div className="prm-field">
          <span className="prm-label">Visibility</span>
          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn accent ${hidden ? "" : "active"}`}
              onClick={() => setHidden(false)}
            >
              Visible
            </button>
            <button
              type="button"
              className={`seg-btn accent ${hidden ? "active" : ""}`}
              onClick={() => setHidden(true)}
            >
              Hidden
            </button>
          </div>
          <p className="form-help">
            {hidden
              ? "Won't appear to learners browsing the catalog."
              : "Appears to learners browsing the catalog."}
          </p>
        </div>
      </div>
    </PrmModal>
  );
}

/* ─── Delete confirm ──────────────────────────────────────────────────────── */

function DeleteConfirm({
  title,
  label,
  certCount,
  subCount,
  isIndustry,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  certCount: number;
  subCount: number;
  isIndustry: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title={title}
      description={
        <>
          Delete <strong>{label}</strong>? This can't be undone.
        </>
      }
      confirmLabel={`Delete ${isIndustry ? "Industry" : "Sub-Industry"}`}
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <ul className="ind-modal-list">
        {isIndustry && subCount > 0 && (
          <li>
            All <strong>{subCount}</strong> Sub-{subCount === 1 ? "Industry" : "Industries"} under it will also be deleted.
          </li>
        )}
        {certCount > 0 ? (
          <li>
            <strong>{certCount}</strong> tagged Certification{certCount === 1 ? "" : "s"}{" "}
            will lose this tag. The Certifications themselves stay published — they just won't appear under this {isIndustry ? "Industry" : "Sub-Industry"} anymore.
          </li>
        ) : (
          <li>No Certifications are currently tagged here.</li>
        )}
      </ul>
    </PrmModal>
  );
}

/* ─── Remove-certification confirm ────────────────────────────────────────── */

/* A certification row's ✕ — the shared confirm (PrmModal, danger) in the
   Delete confirm's voice. Removing only drops this one tag, so it says the
   certification stays published; when this is its last Industry tag it says
   so instead, since learners then can't reach it by Industry at all. */
function RemoveCertConfirm({
  certName,
  scopeLabel,
  isIndustry,
  lastTag,
  onConfirm,
  onCancel,
}: {
  certName: string;
  /** "HVAC" or "HVAC › Residential". */
  scopeLabel: string;
  isIndustry: boolean;
  lastTag: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title="Remove Certification?"
      description={
        <>
          Remove <strong>{certName}</strong> from <strong>{scopeLabel}</strong>?{" "}
          {lastTag
            ? "It stays published, but this is its only Industry tag — it won't appear under any Industry anymore."
            : `It stays published — it just won't appear under this ${isIndustry ? "Industry" : "Sub-Industry"} anymore.`}
        </>
      }
      confirmLabel="Remove Certification"
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

/* ─── Add certifications modal ────────────────────────────────────────────── */

/* The shared table picker (Figma 682:2321, `.stm-*`) that Select Tasks /
   Select Users / Select Questions / Select Certifications already run on, here
   over the Certification catalog with the Industries page's own columns.
   It ran on a bespoke `.ind-addcerts` card of scrolling large-table rows until
   2026-09-18 — same job, different chrome.
   Certifications already tagged at this scope stay visible as ticked + locked
   (the shared picker's rule) rather than disappearing, so the admin can see
   what's taken. Selection is staged: the modal owns `picked` and only hands it
   back on confirm, in the order it was picked. */

const ADD_CERTS_PAGE_SIZE = 50;

type CertSortKey = "name" | "stage" | "hours" | "tags";
type SortDir = "asc" | "desc";

function AddCertsModal({
  industryName,
  subName,
  alreadyAtScope,
  tagsForCert,
  onAdd,
  onClose,
}: {
  industryName: string;
  subName?: string;
  alreadyAtScope: Set<string>;
  tagsForCert: (id: string) => { industryName: string; subName?: string }[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<CareerStage | "All">("All");
  const [tagFilter, setTagFilter] = useState<"All" | "Untagged" | "Tagged">("All");
  const [timeFilter, setTimeFilter] = useState<"Any" | "Short" | "Medium" | "Long">("Any");
  /** Staged picks, in the order they were ticked — that's the order they land
   *  in at the scope. */
  const [picked, setPicked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: CertSortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scopeLabel = subName
    ? `${industryName} › ${subName}`
    : `${industryName} (Industry-level)`;

  // Build the cert universe — names from data/industries.ts certPool
  const universe = useMemo(() => {
    return Object.values(allCertsById)
      .filter((c) => !c.name.startsWith("Placeholder Cert"))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universe.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (stageFilter !== "All" && c.stage !== stageFilter) return false;
      const tags = tagsForCert(c.id);
      if (tagFilter === "Tagged" && tags.length === 0) return false;
      if (tagFilter === "Untagged" && tags.length > 0) return false;
      if (timeFilter === "Short" && c.hours > 4) return false;
      if (timeFilter === "Medium" && (c.hours <= 4 || c.hours > 10)) return false;
      if (timeFilter === "Long" && c.hours <= 10) return false;
      return true;
    });
  }, [universe, query, stageFilter, tagFilter, timeFilter, tagsForCert]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name);
        case "stage":
          return CAREER_STAGES.indexOf(a.stage) - CAREER_STAGES.indexOf(b.stage);
        case "hours":
          return a.hours - b.hours;
        case "tags":
          return tagsForCert(a.id).length - tagsForCert(b.id).length;
      }
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, tagsForCert]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ADD_CERTS_PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * ADD_CERTS_PAGE_SIZE;
  const rows = sorted.slice(start, start + ADD_CERTS_PAGE_SIZE);

  function toggleSelect(id: string) {
    if (alreadyAtScope.has(id)) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleSort(key: CertSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  /** Any filter change can shrink the list under the current page. */
  function resetPage<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  const selectedCount = picked.length;
  const hasFilters =
    stageFilter !== "All" || tagFilter !== "All" || timeFilter !== "Any";

  return (
    <PrmModal
      title="Add Certifications"
      description={
        <>
          Adding to <strong>{scopeLabel}</strong>
        </>
      }
      confirmLabel={`Add ${selectedCount > 0 ? selectedCount : ""} Certification${
        selectedCount === 1 ? "" : "s"
      }`}
      confirmDisabled={selectedCount === 0}
      pick
      onCancel={onClose}
      onConfirm={() => onAdd(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              autoFocus
              className="search-input stm-search-input"
              placeholder="Search Certifications..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            <SelectPill
              label="Career Stage"
              value={stageFilter}
              blank="All"
              options={["All", ...CAREER_STAGES]}
              onChange={resetPage((v: string) => setStageFilter(v as CareerStage | "All"))}
              tip={FILTER_TIPS.industries.careerStage}
            />
            <SelectPill
              label="Industry Tag"
              value={tagFilter}
              blank="All"
              options={["All", "Tagged", "Untagged"]}
              onChange={resetPage((v: string) =>
                setTagFilter(v as "All" | "Untagged" | "Tagged"),
              )}
              tip={FILTER_TIPS.industries.industryTag}
            />
            <SelectPill
              label="Time"
              value={timeFilter}
              blank="Any"
              options={["Any", "Short", "Medium", "Long"]}
              onChange={resetPage((v: string) =>
                setTimeFilter(v as "Any" | "Short" | "Medium" | "Long"),
              )}
              tip={FILTER_TIPS.industries.time}
            />
            {hasFilters && (
              <button
                className="filter-clear-link"
                onClick={() => {
                  setStageFilter("All");
                  setTagFilter("All");
                  setTimeFilter("Any");
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor, per the shared table convention — below it the
              table scrolls sideways instead of crushing the cells. 44 check +
              260 name + 150 stage + 90 hours + 260 tags. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "804px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table acm-table">
              <ColGroup />
              <thead>
                <tr>
                  {/* Spacer only — the node's header holds the column, it is
                      not a select-all control. */}
                  <th className="stm-col-check no-sort" />
                  <Th col="name" label="Certification" cls="acm-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="stage" label="Career Stage" cls="acm-col-stage" sort={sort} toggle={toggleSort} />
                  <Th col="hours" label="Hours" cls="acm-col-hours" sort={sort} toggle={toggleSort} />
                  <Th col="tags" label="Industry Tags" cls="acm-col-tags" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table acm-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={5}>
                        No Certifications match your search and filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((cert) => {
                      const isLocked = alreadyAtScope.has(cert.id);
                      const on = isLocked || picked.includes(cert.id);
                      const tags = tagsForCert(cert.id).map((t) =>
                        t.subName ? `${t.industryName} › ${t.subName}` : t.industryName,
                      );
                      return (
                        <tr
                          key={cert.id}
                          className={`${on ? "selected" : ""}${isLocked ? " is-locked" : ""}`}
                          title={isLocked ? "Already added here" : undefined}
                          onClick={() => toggleSelect(cert.id)}
                        >
                          <td className="stm-col-check">
                            {/* A <button>, not a <span> — the shared table reset
                                strips chrome from span/div in data cells, which
                                would leave a bare tick with no box. */}
                            <button
                              className={`checkbox ${on ? "checked" : ""}`}
                              aria-label={on ? "Deselect" : "Select"}
                              aria-pressed={on}
                              disabled={isLocked}
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(cert.id);
                              }}
                            >
                              {on && <CheckIcon />}
                            </button>
                          </td>
                          {/* `col-name` is the shared Name-column class — it
                              carries the #FFFFFF emphasis and is excluded from
                              the app-wide "mute every non-Name cell" rule. */}
                          <td className="acm-col-name col-name">{cert.name}</td>
                          <td className="acm-col-stage">{cert.stage}</td>
                          <td className="acm-col-hours">{cert.hours}</td>
                          <td className="acm-col-tags">
                            <MultiCell values={tags} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination stm-pagination">
            <span className="scm-picked">{selectedCount} selected</span>
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1} -{" "}
              {Math.min(start + ADD_CERTS_PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={visiblePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 44 }} />
      <col />
      <col style={{ width: 150 }} />
      <col style={{ width: 90 }} />
      <col style={{ width: 260 }} />
    </colgroup>
  );
}

function Th({
  col,
  label,
  cls,
  sort,
  toggle,
}: {
  col: CertSortKey;
  label: string;
  cls: string;
  sort: { key: CertSortKey; dir: SortDir };
  toggle: (k: CertSortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={cls} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

/* The shared picker's multi-value cell: first value + "+N", full list on hover. */
function MultiCell({ values }: { values: string[] }) {
  if (values.length === 0) return <>—</>;
  return (
    <span className="stm-multi" title={values.join(", ")}>
      <span className="stm-multi-first">{values[0]}</span>
      {values.length > 1 && <span className="stm-multi-more">+{values.length - 1}</span>}
    </span>
  );
}

/* Single-select filter pill on the shared Dropdown + PillTrigger chrome.
   `blank` is the value that counts as "no filter applied". */
function SelectPill({
  label,
  value,
  blank,
  options,
  onChange,
  tip,
}: {
  label: string;
  value: string;
  blank: string;
  options: string[];
  onChange: (v: string) => void;
  /** Hover line saying what this filter does — see `PillTrigger`. */
  tip?: string;
}) {
  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          value={value === blank ? null : value}
          open={open}
          toggle={toggle}
          onClear={() => onChange(blank)}
          tip={tip}
        />
      )}
    >
      {({ close }) => (
        <div className="dropdown-list">
          {options.map((o) => (
            <button
              key={o}
              className="dropdown-item"
              onClick={() => {
                onChange(o);
                close();
              }}
            >
              <span className={`checkbox ${o === value ? "checked" : ""}`}>
                {o === value && <CheckIcon />}
              </span>
              {o}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

// Silence unused-var warnings for the cert type re-export
export type { IndustryCert };
