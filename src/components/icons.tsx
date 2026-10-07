export const PlusCircleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v10M7 12h10" strokeWidth="2.4" />
  </svg>
);

export const XCircleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" strokeWidth="2.4" />
  </svg>
);

export const ChevronDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const SettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2.6" />
    <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
  </svg>
);

/* tdesign:search — Figma "Icon Set" (8:11248), the glyph every search bar
   leads with. The exported stroke (1.6, square caps) placed where the node puts
   it inside its 16px frame, so the glyph is 14.04 × 13.97 at 16px and scales
   1:1 to the Large bar's 20px (1362:1947 — stroke 2). It used to be the
   outlined stroke on a 15 × 14 box, which every bar stretched to 16 and drew
   ~7% oversize and 1px left of the node. */
export const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
    <path
      transform="translate(1.1631 1.2383)"
      d="M9.37299 9.29834L12.9083 12.8337M9.37299 9.29834C8.91054 9.77075 8.35899 10.1461 7.75026 10.404C7.14153 10.6618 6.48771 10.7964 5.82663 10.7999C5.16555 10.8034 4.51033 10.6758 3.89889 10.4245C3.28745 10.1731 2.73193 9.803 2.26447 9.33553C1.797 8.86807 1.42688 8.31255 1.17552 7.70111C0.924162 7.08967 0.79655 6.43445 0.800071 5.77337C0.803592 5.11229 0.938176 4.45847 1.19604 3.84974C1.4539 3.24101 1.82991 2.68946 2.30233 2.22701C3.24335 1.30582 4.50979 0.793058 5.82663 0.800071C7.14347 0.807084 8.40438 1.33331 9.33553 2.26447C10.2667 3.19562 10.7929 4.45653 10.7999 5.77337C10.8069 7.09021 10.2942 8.35732 9.37299 9.29834Z"
    />
  </svg>
);

export const AddIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 6.59961H0V5H5V0H6.59961V5H11.5996V6.59961H6.59961V11.5996H5V6.59961Z" fill="currentColor" />
  </svg>
);

/* Pencil (Figma 7:3612) — "edit this in place": the Certification tree's node
   editor and the user-details card's name row. The 11.48px stroke path Figma
   exports, offset into a 14px slot. */
export const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.167" strokeLinecap="square">
    <path d="M8.228 3.502L2.793 8.938L2.333 11.667L5.062 11.206L10.497 5.771L12.28 3.988L10.012 1.719L8.228 3.502ZM8.228 3.502L10.497 5.771" />
  </svg>
);

/* Thin plus — the "Add X" card's glyph (Figma 341:2764). */
export const PlusThinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.167" strokeLinecap="square">
    <path d="M7 2.917V11.083M11.083 7H2.917" />
  </svg>
);

/* Card-table minus — the Condition Set header's "remove set" (Figma 856:1854,
   Icon Library at 16px since the 2026-10-03 Card Tables pass; was 12px). The
   16px plus's horizontal bar, same 1.333 stroke and square caps. */
export const CardMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M12.6667 8H3.33333" />
  </svg>
);

/* Stepper glyphs (Figma 617:1181, re-issued 2026-10-06): 16px boxes, square
   caps. The minus is the node's own 6px bar — shorter than the plus's 9.33px
   arms, as drawn. */
export const StepperMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11.0013 8H5.00133" />
  </svg>
);

export const StepperPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M8 3.33333V12.6667M12.6667 8H3.33333" />
  </svg>
);

/* tdesign:close on a removable price column (Figma 752:2830): 16px, a heavier
   1.94 stroke than the 1.33 row ✕s, square caps. */
/* The ✕ on a multi-select pill (Figma 147:1147): a 14px box, 5.8px glyph,
   1.17 stroke, square caps. */
export const PillCloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M9.9 4.1L4.1 9.9M4.1 4.1L9.9 9.9" />
  </svg>
);

export const ColumnCloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.93939" strokeLinecap="square">
    <path d="M12 4L8 8M8 8L4 12M8 8L12 12M8 8L4 4" />
  </svg>
);

export const EditColumnsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 14.5813 14.6667" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.56264 2.64L5.9573 0.666667H8.62397L9.01864 2.64C9.55864 2.83933 10.056 3.12867 10.49 3.49067L12.3973 2.84533L13.7306 5.15467L12.2186 6.48333C12.3157 7.04585 12.3157 7.62082 12.2186 8.18333L13.7306 9.512L12.3973 11.8213L10.49 11.176C10.0517 11.5414 9.55403 11.8292 9.01864 12.0267L8.62397 14H5.9573L5.56264 12.0267C5.02724 11.8292 4.52961 11.5414 4.0913 11.176L2.18397 11.8213L0.850636 9.512L2.36264 8.18333C2.26689 7.62071 2.26689 7.04596 2.36264 6.48333L0.850636 5.15467L2.18397 2.84533L4.0913 3.49067C4.52961 3.12522 5.02724 2.83751 5.56264 2.64Z"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="square"
    />
    <path
      d="M9.9573 7.33333C9.9573 8.04058 9.67635 8.71885 9.17625 9.21895C8.67616 9.71905 7.99788 10 7.29064 10C6.58339 10 5.90512 9.71905 5.40502 9.21895C4.90492 8.71885 4.62397 8.04058 4.62397 7.33333C4.62397 6.62609 4.90492 5.94781 5.40502 5.44772C5.90512 4.94762 6.58339 4.66667 7.29064 4.66667C7.99788 4.66667 8.67616 4.94762 9.17625 5.44772C9.67635 5.94781 9.9573 6.62609 9.9573 7.33333Z"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="square"
    />
  </svg>
);

/* Figma "Radial Button" check (8:13497 → tdesign:check): thin square-cap
   stroke, 11.2px glyph. */
export const CheckIcon = () => (
  <svg width="11.2" height="11.2" viewBox="0 0 11.2 11.2" fill="none" stroke="currentColor" strokeWidth="1.12" strokeLinecap="square">
    <path d="M9.39 3.9L4.91 8.38L2.5 5.97" />
  </svg>
);

/* The select-all's "some ticked" dash (Figma 1537:1530, "Icon Library") —
   exported verbatim: an 11.2px glyph like the check above, a 4.2px stroke at
   0.93px with square caps, centred in the box. */
export const CheckboxDashIcon = () => (
  <svg width="11.2" height="11.2" viewBox="0 0 11.2 11.2" fill="none" stroke="currentColor" strokeWidth="0.933333" strokeLinecap="square">
    <path d="M7.70093 5.6H3.50093" />
  </svg>
);

export const SortIcon = ({ active, dir }: { active?: boolean; dir?: "asc" | "desc" }) => {
  if (!active) {
    // Sortable but not currently sorted — tdesign/material "unfold-more" double chevron.
    return (
      <span className="sort-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83Zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17Z" />
        </svg>
      </span>
    );
  }
  // Active — a single arrow; descending points down, ascending is the same arrow flipped.
  return (
    <span className="sort-icon sort-icon--active">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={dir === "asc" ? { transform: "rotate(180deg)" } : undefined}
      >
        <path d="M11 4v12.17l-5.59-5.59L4 12l8 8 8-8-1.41-1.42L13 16.17V4h-2Z" />
      </svg>
    </span>
  );
};

const sw = "1.7";

export const PackageIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8L12 3L3 8v8l9 5l9-5z" />
    <path d="M3.3 8L12 13L20.7 8" />
    <path d="M12 13v9" />
  </svg>
);

export const QuizIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
);

export const HandsOnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 010 1.4L11.4 11l3.3 3.3a1 1 0 11-1.4 1.4l-4-4a1 1 0 010-1.4l4-4a1 1 0 011.4 0z" />
    <path d="M3 19l4-4M19 5l-3 3" />
  </svg>
);

export const IdCardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11.5" r="2" />
    <path d="M14 10h4M14 13h3M6 16h12" />
  </svg>
);

export const FileIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const LinkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5" />
    <path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.5-1.5" />
  </svg>
);

export const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
  </svg>
);

export const ChevronLeftIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const ChevronRightIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/* Breadcrumb separator (Figma 1356:1831, "Icon Library") — the page header's
   14px chevron, export verbatim: 1.16667 stroke, square caps. */
export const CrumbChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M5.54167 10.2083L8.75 7L5.54167 3.79167" />
  </svg>
);

/* Pagination prev/next (Figma 77:288 / 77:289, "Icon Library") — paths are the
   export verbatim: 16px box, 1.33333 stroke, square caps. currentColor so the
   button's #a8a8a8 → white hover and disabled fade still apply. */
export const PagePrevIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M9.66667 11.6667L6 8L9.66667 4.33333" />
  </svg>
);

export const PageNextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M6.33333 11.6667L10 8L6.33333 4.33333" />
  </svg>
);

/* Row-end arrow (Figma 190:327) — the open-row affordance on large-table rows. */
export const RowArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="square">
    <path d="M7.92 14.58 12.5 10 7.92 5.42" />
  </svg>
);

/* Calendar — Figma "Icon Library" (7:891), the exported glyph: square corners,
   square caps, a header band with two hangers, and six day marks. The glyph is
   11.67×12.25 inside a 14px box, so it is translated by its Figma insets rather
   than redrawn. */
export const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <g transform="translate(1.1667 0.5833)">
      <path d="M11.0833 5.25V11.6667H0.583333V5.25M11.0833 5.25H0.583333M11.0833 5.25V2.33333H0.583333V5.25M2.91667 2.33333V0.583333M8.75 2.33333V0.583333" />
      <path d="M3.5 7.58333H3.50233V7.58567H3.5V7.58333ZM5.83333 7.58333H5.83567V7.58567H5.83333V7.58333ZM8.16667 7.58333H8.169V7.58567H8.16667V7.58333ZM8.16667 9.33333H8.169V9.33567H8.16667V9.33333ZM3.5 9.33333H3.50233V9.33567H3.5V9.33333ZM5.83333 9.33333H5.83567V9.33567H5.83333V9.33333Z" />
    </g>
  </svg>
);

/* Close — Figma "tdesign:close" (1570:45011): a square-capped X on a 25.6 grid,
   noticeably heavier than SmallXIcon. Used on the Spotlight preview card. */
export const CloseXIcon = () => (
  <svg width="24" height="24" viewBox="0 0 25.6 25.6" fill="none" stroke="currentColor" strokeWidth="3.10303" strokeLinecap="square">
    <path d="M19.4 6.6L6.6 19.4M6.6 6.6L19.4 19.4" />
  </svg>
);

/* "arrow-right-up" from the File Upload - Primary component (378:257) — a
   16px square-capped glyph. */
export const ArrowRightUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M5.5146 5.33332L10.7001 5.33332V10.5188M10.1137 5.91963L5.34961 10.6838" />
  </svg>
);

/* The ✕ that clears a picked value out of a search bar (1284:2676) — a 16px
   square-capped X, not the rounded 13px `SmallXIcon` the app's chips use. */
export const ClearXIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11.3 4.7L8 8M8 8L4.7 11.3M8 8L11.3 11.3M8 8L4.7 4.7" />
  </svg>
);

/* The flow card's 24px left arrow (1289:2936) — square-capped 2px, pointing
   INTO the account that survives. Traced, not reused: the app's other arrows
   are rounded and drawn at 12-16px. */
export const ArrowLeftLongIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <path d="M11 6.5L5.5 12L11 17.5M6.75 12H19.75" />
  </svg>
);

export const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const CheckBoldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const CubeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8L12 3L3 8v8l9 5l9-5z" />
    <path d="M3.3 8L12 13L20.7 8" />
    <path d="M12 13v9" />
  </svg>
);

export const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M5 18h14" />
  </svg>
);

/* Drop-zone upload glyph (365:6129) — an arrow rising out of a tray. A distinct
   design from UploadIcon above, which the toolbar/thumbnail buttons still use. */
export const UploadTrayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <path d="M16.5 8.5L12 4L7.5 8.5M12 5.25V15" />
    <path d="M20.5 15V20H3.5V15" />
  </svg>
);

/* Reorder arrows for the review-run cards (Figma 714:1496 down / 714:1502 up).
   Transcribed from the exported assets — a 16px box, 1.33333 stroke, SQUARE
   caps. Deliberately NOT the KeyArrowUp/KeyArrowDownIcon keycap glyphs.

   The Companies table's Seat Changes cell (Figma 927:950) exports this exact
   same pair — identical path, box, stroke and caps — so it reuses these rather
   than adding a second copy under a seats-flavoured name. */
export const RunMoveUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11.6667 7L8 3.33333L4.33333 7M8 4.16667V12.8333" />
  </svg>
);

export const RunMoveDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11.6667 9.06667L8 12.7333L4.33333 9.06667M8 11.9V3.23333" />
  </svg>
);

/* Down arrow closing the landing's "FULL TABLE" bar (Figma 716:1648 → the
   916:947 Icon Library instance) — transcribed from the exported asset: same
   glyph as RunMoveDownIcon at 12px, so the 1.33333 stroke scales by 12/16 to 1.
   It replaced the 16px double chevron the bar used to carry. Takes
   currentColor, so it follows the button into accent on hover. */
export const FullTableIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M8.75 6.8L6 9.55L3.25 6.8M6 8.925V2.425" />
  </svg>
);

/* Right chevron closing the landing's quick-filter row (Figma 977:1014 → its
   977:1020 "Icon Library" instance) — "there are more filters than these",
   click-through into the full table. Transcribed from the exported 14px asset
   (square caps, 1.16667 stroke), NOT the shared ChevronRightIcon, whose round
   caps and 24-box geometry read differently at this size. Takes currentColor,
   so it follows the button's hover. */
export const MoreFiltersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M5.54167 10.2083L8.75 7L5.54167 3.79167" />
  </svg>
);

/* 14px right chevron closing the page header's action line ("Page Subtext",
   Figma 1597:2690) — the export verbatim: square caps, 1.16667 stroke on a 14
   box. Takes currentColor so it follows the accent label. */
export const NoteChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M5.54167 10.2083L8.75 7L5.54167 3.79167" />
  </svg>
);

/* edit-off — marks a read-only review rail (Figma 298:1886). */
/* "edit-off" — the review rail's Read-Only card (Figma 1448:2570): a 16px
   square-capped pencil with a slash, from the Icon Library family. */
export const EditOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M6.70289 6.70296L3.19149 10.2144L2.66523 13.3333L5.78422 12.8071L9.29562 9.29569M8.40612 5L11.4413 1.96484L14.0341 4.55757L10.9988 7.59272M11.9962 6.59565L9.40352 4.00293" />
    <path d="M2.6668 2.6668L6.70315 6.70315L9.29588 9.29588L13.3335 13.3335" />
  </svg>
);

/* Icon Library "download" at 14px (1278:1575, the Download All button) — path
   verbatim from the Figma export. Same glyph as `DownloadIcon12` below, drawn
   on its own 14 box rather than scaled. */
export const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M9.625 6.125L7 8.75L4.375 6.125M7 8.02083V2.33333M11.9583 8.75V11.6667H2.04167V8.75" />
  </svg>
);

/* The same Icon Library "download" at 12px (756:3157) — the glyph on the media
   stage's Download chip, on its own 12 box with a 1px stroke. */
export const DownloadIcon12 = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeLinecap="square">
    <path d="M8.25 5.25L6 7.5L3.75 5.25M6 6.875V2M10.25 7.5V10H1.75V7.5" />
  </svg>
);

export const DocumentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const SmallXIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/* Drag handle — Figma "move" (314:2054): 12×12, two columns of four 1.5px
   square dots (columns at x 4.125/7.875, rows at y 1.875/4.625/7.375/10.125). */
export const DragHandleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <rect x="3.375" y="1.125" width="1.5" height="1.5" />
    <rect x="7.125" y="1.125" width="1.5" height="1.5" />
    <rect x="3.375" y="3.875" width="1.5" height="1.5" />
    <rect x="7.125" y="3.875" width="1.5" height="1.5" />
    <rect x="3.375" y="6.625" width="1.5" height="1.5" />
    <rect x="7.125" y="6.625" width="1.5" height="1.5" />
    <rect x="3.375" y="9.375" width="1.5" height="1.5" />
    <rect x="7.125" y="9.375" width="1.5" height="1.5" />
  </svg>
);

export const GearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2.6" />
    <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
  </svg>
);

export const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);

/* Filled padlock (Figma 1360:1926) — the Locked Field banner's glyph. Paints in
   currentColor; the banner sets the node's #a8a8a8. */
export const FieldLockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4 6.66667H2.33333V14.6667H13.6667V6.66667H12V4.66667C12 3.6058 11.5786 2.58839 10.8284 1.83824C10.0783 1.08809 9.06087 0.666667 8 0.666667C6.93913 0.666667 5.92172 1.08809 5.17157 1.83824C4.42143 2.58839 4 3.6058 4 4.66667V6.66667ZM5.33333 4.66667C5.33333 3.95942 5.61429 3.28115 6.11438 2.78105C6.61448 2.28095 7.29276 2 8 2C8.70724 2 9.38552 2.28095 9.88562 2.78105C10.3857 3.28115 10.6667 3.95942 10.6667 4.66667V6.66667H5.33333V4.66667ZM6 11.3333V10H10V11.3333H6Z"
      fill="currentColor"
    />
  </svg>
);

/* Account-operations icons (Merge Accounts / Transfer Subscription) */
export const AlertTriangleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

/* Traced from Figma's own exports for the Merge comparison tables
   (1282:2333 / 1282:2418), not approximated: both are square-capped 1.33px
   strokes, which is why neither reuses `KeyArrowUpIcon` or `AlertTriangleIcon`
   (rounded joins, different geometry). Both take the cell's colour. */

/** The green "+N ↑" delta's arrow (1282:2471). */
export const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11.6667 7L8 3.33333L4.33333 7M8 4.16667V12.8333" />
  </svg>
);

/** The flag beside a blocking value (1282:2458). The node draws the triangle
 *  twice — a 1.33px outline over a 0.67px one — and the export's box is
 *  15.94 x 13.8, not square, so it is rendered at its own ratio. */
export const WarnTriangleIcon = () => (
  <svg width="16" height="14" viewBox="0 0 15.9362 13.7999" fill="none" stroke="currentColor">
    <path d="M14.2036 12.8H1.73288L7.96725 1.99926L14.2036 12.8Z" strokeWidth="0.666667" />
    <path d="M7.96809 1.33325L14.7814 13.1332H1.15475L7.96809 1.33325Z" strokeWidth="1.33333" strokeLinecap="square" />
    <path d="M7.96808 6.33325V8.66658M7.96808 10.9999H7.97075V11.0026H7.96808V10.9999Z" strokeWidth="1.33333" strokeLinecap="square" />
  </svg>
);

export const InfoCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.3" />
    <path d="M12 11v5.4M12 7.5h.01" />
  </svg>
);

/* Info glyph for a field subtext (Figma 696:1237, inside "Input Field + Subtext
   Tooltip" 696:1224). Traced exactly: a 16px box holding a 14.667 glyph, 1.333
   stroke with SQUARE caps — which is what turns the degenerate dot path into a
   crisp square pip. The other info glyphs in this file are round-capped
   approximations; this one is the design-system icon. */
export const InfoTipIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.33333"
    strokeLinecap="square"
    aria-hidden="true"
  >
    <path d="M1.33333 8C1.33333 4.31800 4.31800 1.33333 8 1.33333C11.68200 1.33333 14.66667 4.31800 14.66667 8C14.66667 11.68200 11.68200 14.66667 8 14.66667C4.31800 14.66667 1.33333 11.68200 1.33333 8Z" />
    <path d="M8 11V7.33333M8 5H7.99733V4.99733H8V5Z" />
  </svg>
);

export const SwapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h13M14 5l3 3-3 3" />
    <path d="M20 16H7M10 13l-3 3 3 3" />
  </svg>
);

/* The swap glyph as the card-head "Button dialog" draws it (1285:2773): 14px,
   square-capped 1.167px, top arrow pointing left over a bottom one pointing
   right. `SwapIcon` above is the rounded variant the note rows use — same
   idea, different drawing, so they stay separate. */
export const SwapRolesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M12.25 8.45833H2.33333L5.25 11.375M1.75 5.54167H11.6667L8.75 2.625" />
  </svg>
);

export const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const CreditCardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19" />
  </svg>
);

/* ─── Rich-text editor toolbar icons — Figma 327:137 ───
   The toolbar set is its own icon family: square-cap strokes, drawn at #a8a8a8
   via the button's colour. Path data is the exported Figma vector, so these
   render 1:1 with the design rather than approximating it. The viewBox stays in
   the original 12-unit space and each renders at 16px, which scales the 1px
   stroke to Figma's 1.3333px — the same result as its 16px export. */
export const BoldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
    <path d="M3 6H6.5C7.60457 6 8.5 5.10457 8.5 4C8.5 2.89543 7.60457 2 6.5 2H3V6ZM3 6H7C8.10457 6 9 6.89543 9 8C9 9.10457 8.10457 10 7 10H3V6Z" />
  </svg>
);
export const ItalicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M4.5 2H8.75M3.5 10H7.75M6.70306 2.25L5.29681 9.75" />
  </svg>
);
export const UnderlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M8.5 2V6C8.5 7.38071 7.38071 8.5 6 8.5C4.61929 8.5 3.5 7.38071 3.5 6V2" />
    <path d="M9.5 10.5H2.5" />
  </svg>
);
export const BulletListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M4 2.5H10.5M4 6H10.5M4 9.5H10.5M1.4999 2.50202H1.50185V2.50007H1.4999V2.50202ZM1.4999 6.00202H1.50185V6.00007H1.4999V6.00202ZM1.4999 9.50202H1.50185V9.50007H1.4999V9.50202Z" />
  </svg>
);
export const NumberListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M5.5 2H11M5.5 6H11M5.5 10H11" />
    <path d="M1 1.5H1.5C1.77614 1.5 2 1.7257 2 2.00184V5M2 5H1M2 5H3M1 7H2.5C2.77614 7 3 7.22386 3 7.5V8.25C3 8.52614 2.77614 8.75 2.5 8.75H1.5C1.22386 8.75 1 8.97386 1 9.25V10.5H3" />
  </svg>
);
/* Image + "add" badge (333:177) — distinct from the plain ImageIcon above,
   which is still used by the media pickers. */
export const ImageAddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M10.5 5.5V1.5H1.5V10.5H5.5M6.5 7L4.5 5L1.75 7.75M8.875 4.125C8.875 4.67728 8.42728 5.125 7.875 5.125C7.32272 5.125 6.875 4.67728 6.875 4.125C6.875 3.57272 7.32272 3.125 7.875 3.125C8.42728 3.125 8.875 3.57272 8.875 4.125Z" />
    <path d="M9.5 7.5V9.5M9.5 9.5V11.5M9.5 9.5H7.5M9.5 9.5H11.5" />
  </svg>
);
/* Superscript / subscript (I333:203;7:6188, I333:204;7:6153) and inline code
   (I333:213;7:1874). Each is a smaller-than-12px vector that Figma nests inside
   the 12px slot, so the viewBox is offset to reproduce that placement. */
export const SuperscriptIcon = () => (
  <svg width="16" height="16" viewBox="-1.049 -0.5 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M3.45109 5.8675L0.956088 9.5H0.951088L3.45109 5.8675ZM3.45109 5.8675L3.95109 5.1395M3.95109 5.1395L6.45109 1.5H6.44609L3.95109 5.1395ZM3.95109 5.8675L6.44609 9.5H6.45109L3.95109 5.8675ZM3.95109 5.8675L3.44409 5.13M3.44409 5.13L0.951088 1.5H0.956088L3.44409 5.13ZM8.57609 0.5H9.70109C9.76739 0.5 9.83098 0.526339 9.87786 0.573223C9.92475 0.620107 9.95109 0.683696 9.95109 0.75V1.5C9.95109 1.5663 9.92475 1.62989 9.87786 1.67678C9.83098 1.72366 9.76739 1.75 9.70109 1.75H8.70109C8.63478 1.75 8.5712 1.77634 8.52431 1.82322C8.47743 1.87011 8.45109 1.9337 8.45109 2V3H9.82609" />
  </svg>
);
export const SubscriptIcon = () => (
  <svg width="16" height="16" viewBox="-1.049 -1.5 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M3.45109 4.8675L0.956088 8.5H0.951088L3.45109 4.8675ZM3.45109 4.8675L3.95109 4.1395M3.95109 4.1395L6.45109 0.5H6.44609L3.95109 4.1395ZM3.95109 4.8675L6.44609 8.5H6.45109L3.95109 4.8675ZM3.95109 4.8675L3.44409 4.13M3.44409 4.13L0.951088 0.5H0.956088L3.44409 4.13ZM8.57609 6H9.70109C9.76739 6 9.83098 6.02634 9.87786 6.07322C9.92475 6.12011 9.95109 6.1837 9.95109 6.25V7C9.95109 7.0663 9.92475 7.12989 9.87786 7.17678C9.83098 7.22366 9.76739 7.25 9.70109 7.25H8.70109C8.63478 7.25 8.5712 7.27634 8.52431 7.32322C8.47743 7.37011 8.45109 7.4337 8.45109 7.5V8.5H9.82609" />
  </svg>
);
export const CodeBlockIcon = () => (
  <svg width="16" height="16" viewBox="-0.293 -1.394 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M2.47511 6.37434L0.707107 4.60634L2.47511 2.83834M8.93911 6.37434L10.7071 4.60634L8.93911 2.83834M6.70711 0.606339L4.70711 8.60634" />
  </svg>
);
/* Block-format caret (I333:145;7:1513) — a chevron centred in the 14px slot the
   heading picker reserves for it. The viewBox stays in 10-unit space, so the
   0.8333 stroke renders at Figma's 1.1667px. */
export const RteCaretIcon = () => (
  <svg width="14" height="14" viewBox="-2.938 -3.884 10 10" fill="none" stroke="currentColor" strokeWidth="0.8333" strokeLinecap="square">
    <path d="M3.53551 0.589256L2.06259 2.06217L0.589256 0.589256" />
  </svg>
);
export const IndentRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 18h18M11 12h10M3 9l3 3-3 3" />
  </svg>
);
export const IndentLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 18h18M11 12h10M6 9l-3 3 3 3" />
  </svg>
);
export const LinkSmallIcon = () => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M5.64641 9.18183L4.9393 9.88893C4.06062 10.7676 2.63598 10.7676 1.75732 9.88893C0.878661 9.01027 0.878642 7.58563 1.75732 6.70695L3.34831 5.11596C4.22699 4.23728 5.65163 4.2373 6.53029 5.11596L6.82468 5.41035M6.35342 2.81819L7.06053 2.11108C7.93921 1.2324 9.36385 1.23242 10.2425 2.11108C11.1212 2.98974 11.1212 4.41438 10.2425 5.29306L8.65152 6.88405C7.77284 7.76273 6.3482 7.76271 5.46954 6.88405L5.05682 6.47133" />
  </svg>
);
export const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 17l-5-5-7 7" />
  </svg>
);
export const VideoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3z" />
  </svg>
);
export const AudioIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

/* ─── Rail / tree atoms — Figma 314:899 (rail) + 314:2239 "Tree Menu States" ───
   Shared by every page whose left panel is a rail + tree (Industries,
   Question Bank). All three render at #a8a8a8 via the row's colour. */

/* Filled info glyph (I314:829;7:5011) — a 12.83px disc with the "i" knocked
   out, centred in a 14px slot. Carries the rail header's tooltip. */
export const InfoFilledIcon = () => (
  <svg width="14" height="14" viewBox="-0.583 -0.583 14 14" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.41667 12.8333C9.96042 12.8333 12.8333 9.96042 12.8333 6.41667C12.8333 2.87292 9.96042 0 6.41667 0C2.87292 0 0 2.87292 0 6.41667C0 9.96042 2.87292 12.8333 6.41667 12.8333ZM5.831 4.375V3.206H7V4.375H5.831ZM7 5.25V9.625H5.83333V5.25H7Z"
    />
  </svg>
);

/* Tree caret — the Figma Tree's 16px Icon Library triangle (861:2277 closed,
   859:2235 open). One glyph: the closed right-pointing triangle, which
   `.tree-caret-btn.is-open` rotates 90° into the exact open asset. */
/* Header-row group toggles (Skills table, Figma 1119:1577 expand-vertical /
   1127:1755 shrink-vertical): 16px, 1.333 stroke, square caps, white. */
export const ExpandVerticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M12.6667 1.66667L3.33333 1.66667M12.6667 14.3333H3.33333M10.3333 6L8 3.66667L5.66667 6M5.66667 10L8 12.3333L10.3333 10M8 11.5L8 4.5" />
  </svg>
);

export const ShrinkVerticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M10.3333 12.3333L8 10L5.66667 12.3333M13.3333 8H2.66667M10.3333 3.66667L8 6L5.66667 3.66667M8 1.66667V5.16667M8 14.3333V10.8333" />
  </svg>
);

/* Solid caret down (1169:1600, "Icon Library") — the disclosure wedge on the
   attempts dropdown's trigger. Same 16-box solid family as TreeCaretIcon, NOT
   one of the stroked chevrons; the path is the Figma export verbatim and the
   fill is currentColor so the trigger can tint it #a8a8a8. */
export const CaretDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 10L11.6667 6.33333H4.33333L8 10Z" />
  </svg>
);

export const TreeCaretIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10 8L6.33333 4.33333V11.6667L10 8Z" />
  </svg>
);

/* Tree add row plus (861:2264) — the thin Icon Library plus at the tree's
   16px icon size (1.333 stroke, square caps). */
/* Icon Library close (941:1078) — the 16px / 1.333 / square-cap ×, the remove
   affordance beside a removable row. Pairs with TreeAddIcon on the same grid;
   distinct from `SmallXIcon`, which is a 13px rounded-cap glyph. */
export const RemoveRowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11.3 4.7L8 8M8 8L4.7 11.3M8 8L11.3 11.3M8 8L4.7 4.7" />
  </svg>
);

/* tdesign:close — the remove ✕ the Quiz tables draw (Figma 750:1672 rows and
   pool members, 1097:1205 Sections). 16px on a 16 grid, arms running corner to
   corner at 4/12 with a HEAVY 1.94 stroke and square caps. Deliberately not
   `SmallXIcon` (13px, round caps, 48 call sites elsewhere) and not
   `RemoveRowIcon` (the Icon Library close at a lighter 1.333). */
export const RowCloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.93939" strokeLinecap="square">
    <path d="M12 4L8 8M8 8L4 12M8 8L12 12M8 8L4 4" />
  </svg>
);

export const TreeAddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M8 3.33333V12.6667M12.6667 8H3.33333" />
  </svg>
);

/* The 20px plus that leads an "Add" card — Question Bank's Add Sub-Category
   card (Figma 1512:2804, its "Icon Library" glyph). */
export const AddCardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="square" aria-hidden="true">
    <path d="M10 4.16667V15.8333M15.8333 10H4.16667" />
  </svg>
);

/* Folder with a plus — the category kebab's "Add Sub-Category" (Figma
   1188:1617, added 2026-09-16 when the action left the tree card for the menu).
   Drawn on the node's 14.667×12.333 art at a 1px/1.833px offset so it sits on
   the 16px grid the rest of the `u-menu` glyph family uses. */
export const TreeAddSubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333">
    <path d="M1.333 2.5H6L7.333 4.167H14.667V13.5H1.333V2.5Z" />
    <path d="M8 6.833V10.833M10 8.833H6" strokeLinecap="square" />
  </svg>
);

/* Tree row kebab (314:2060) — the VERTICAL 3-dot: 1.75px dots at y
   2.625/7/11.375 in a 14px slot (12px on sub rows via `.tree-sub-menu-btn`). */
export const TreeKebabIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="6.125" y="1.75" width="1.75" height="1.75" />
    <rect x="6.125" y="6.125" width="1.75" height="1.75" />
    <rect x="6.125" y="10.5" width="1.75" height="1.75" />
  </svg>
);

/* Clear-search ✕ — Figma "Search Bar - Applied" (399:216, node 7:1802). Same
   16px / 1.3333 square-cap family as the row-action icons below. */
export const SearchClearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M11.301 4.701L8 8M8 8L4.701 11.301M8 8L11.301 11.301M8 8L4.701 4.701" />
  </svg>
);

/* ─── Table row-action icons — Figma "3-Dot Menu - Hover State" (386:269) ───
   The hover bar that every table row reveals draws from one icon family: 16px
   in a 16-unit box, 1.3333px square-cap strokes, tinted #a8a8a8 by the button.
   Path data is the exported Figma vector translated back into the 16-unit frame
   (Figma exports the tight stroke bbox), so these render 1:1 with the design.

   A table keeps whichever subset of actions it already had — the Figma frame is
   a combined state showing every glyph at once, not a fixed set of buttons. */
export const RowEditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M8.67 4.33L2 11V14H5L11.67 7.33M8.67 4.33L11.67 7.33M8.67 4.33L11.33 1.67L14.33 4.67L11.67 7.33" />
  </svg>
);

export const RowEyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M8.005 2.667C4.584 2.667 1.687 4.907 0.7 8C1.686 11.093 4.584 13.333 8.005 13.333C11.425 13.333 14.323 11.093 15.31 8C14.323 4.907 11.426 2.667 8.005 2.667Z" />
    <path d="M10.672 8C10.672 8.707 10.391 9.386 9.891 9.886C9.391 10.386 8.712 10.667 8.005 10.667C7.298 10.667 6.62 10.386 6.12 9.886C5.619 9.386 5.338 8.707 5.338 8C5.338 7.293 5.619 6.614 6.12 6.114C6.62 5.614 7.298 5.333 8.005 5.333C8.712 5.333 9.391 5.614 9.891 6.114C10.391 6.614 10.672 7.293 10.672 8Z" />
  </svg>
);

export const RowEyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M8.79 5.45C9.206 5.582 9.584 5.81 9.892 6.118C10.2 6.425 10.428 6.804 10.556 7.22M14.196 10.19C14.683 9.527 15.06 8.788 15.312 8.003C14.325 4.909 11.426 2.669 8.006 2.669C7.585 2.669 7.174 2.702 6.771 2.768M14.006 14.003L2.006 2.003M3.878 3.875C2.37 4.839 1.246 6.299 0.7 8.003C1.687 11.096 4.585 13.336 8.005 13.336C9.525 13.336 10.941 12.894 12.133 12.131L3.878 3.875ZM5.339 8.003C5.339 7.267 5.638 6.6 6.121 6.117L9.891 9.889C9.518 10.262 9.043 10.516 8.526 10.618C8.009 10.721 7.472 10.668 6.985 10.466C6.498 10.264 6.082 9.923 5.789 9.484C5.496 9.046 5.339 8.53 5.339 8.003Z" />
  </svg>
);

export const RowExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M6 2.667H2.667V13.333H13.333V10M12.833 3.167L8 8M9.333 2.667H13.333V6.667" />
  </svg>
);

/* Trash can with an ✕ on the body — the delete / revoke action. Added to the
   Figma family on 2026-08-06; replaced the off-family `SmallXIcon` the Revoke
   and Delete buttons used to borrow. */
export const RowDeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M3.333 3.333H12.667M3.333 3.333L3.667 14.667H12.333L12.667 3.333M3.333 3.333H2M12.667 3.333H14M9.886 7.115L8 9M8 9L6.115 10.886M8 9L6.115 7.115M8 9L9.886 10.886M5.667 1.333H10.333V3.333H5.667V1.333Z" />
  </svg>
);

/* Card with a bookmark ribbon — the subscription/plan action. */
export const RowCardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M8.667 6.667H12V10.667L10.333 9.667L8.667 10.667V6.667Z" />
    <path d="M14.667 6.667H1.333M14.667 6.667V2.667H1.333V6.667M14.667 6.667V13.333H1.333V6.667" />
  </svg>
);

/* ─── Row 3-dot MENU icons — Figma "3-Dot Menu - Menu Clicked" (388:354) ───
   Same 16px / 1.3333 square-cap library as the `Row*` bar icons above; the menu
   just tints them white (or #404040 when the row is disabled) instead of
   #a8a8a8. Kept under their own prefix because these glyphs only appear in the
   dropdown, never in the hover bar. */
export const MenuPreviewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M3.667 12.667H1.334L1.333 2.667H14.667V12.667H12.333M8 13L7 14H9L8 13Z" />
  </svg>
);

export const MenuHistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M1.701 8.668C2.035 11.852 4.727 14.334 8 14.334C9.68 14.334 11.291 13.667 12.479 12.479C13.666 11.292 14.333 9.681 14.333 8.001C14.333 6.321 13.666 4.71 12.479 3.523C11.291 2.335 9.68 1.668 8 1.668C6.915 1.668 5.893 1.941 5 2.422C3.795 3.072 2.832 4.093 2.253 5.334M8 4.668V8.001L9.667 9.668M1.667 2.334V5.668H5" />
  </svg>
);

/* Stand-in for a menu action the Figma Icon Library has no glyph for yet
   (Revoke, Login As, Invoice, Dashboard, …). Deliberately reads as an empty
   slot rather than as meaning — swap each one out as the real icon lands. */
export const MenuPlaceholderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M1.333 1.333H14.667V14.667H1.333V1.333Z" />
    <path d="M1.333 1.333L14.667 14.667M14.667 1.333L1.333 14.667" strokeOpacity="0.45" />
  </svg>
);

/* ── Companies 3-dot menu glyphs — Figma 670:1323 "3-Dot Menu - B2B
   Companies". Transcribed from the exported assets (16px box, 1.33333
   square-capped strokes, drawn at each asset's own inset offsets). ── */

/* user-vip — Change Account Holder. The crown-tag path is square-cornered
   but butt-capped in the asset, so it carries no linecap of its own. */
export const MenuUserVipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333">
    <path strokeLinecap="square" d="M6.667 10H5.333C3.492 10 2 11.493 2 13.333V14H6.7M10.667 5C10.667 6.657 9.324 8 7.667 8C6.01 8 4.667 6.657 4.667 5C4.667 3.343 6.01 2 7.667 2C9.324 2 10.667 3.343 10.667 5Z" />
    <path d="M14 9.667H10L9 11.667L12 15L15 11.667L14 9.667Z" />
  </svg>
);

/* Envelope — Manage Billing Emails. */
export const MenuMailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M15.333 3.333V5.629L8.667 9L2 5.629V3.333H15.333V14H2V3.333" />
  </svg>
);

/* usergroup — View All Employees. */
export const MenuUsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M10.667 5.333C10.667 6.806 9.473 8 8 8C6.527 8 5.333 6.806 5.333 5.333C5.333 3.861 6.527 2.667 8 2.667C9.473 2.667 10.667 3.861 10.667 5.333Z" />
    <path d="M3.333 12.667C3.333 11.194 4.527 10 6 10H10C11.473 10 12.667 11.194 12.667 12.667V14H3.333V12.667Z" />
    <path d="M4.667 2.667C3.194 2.667 2 3.861 2 5.333C2 6.806 3.194 8 4.667 8C2.458 8 0.667 9.791 0.667 12V14M15.333 14V12C15.333 9.791 13.543 8 11.333 8C12.806 8 14 6.806 14 5.333C14 3.861 12.806 2.667 11.333 2.667" />
  </svg>
);

/* Receipt with a torn bottom edge — View Invoices. */
export const MenuInvoiceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M4 2.667H13.333M4 2.667V14L5.667 12.667L7.167 14L8.667 12.667L10.167 14L11.667 12.667L13.333 14V2.667M4 2.667H2.667M13.333 2.667H14.667M6.667 6H10.667M7.333 8.667H10" />
  </svg>
);

/* Padlock — Revoke Access on the Who Paid menus (Figma 786:1719 available /
   785:1699 disabled). Transcribed from the exported asset, which draws in an
   11.333×14 box inset 18.75% left/right and 8.33%/12.5% top/bottom of the 16px
   frame — i.e. the same path translated by (2.333, 0.667). */
export const MenuLockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M6.667 10.667H9.333M3 7.333H13V14H3V7.333ZM4.667 4.667C4.667 3.783 5.018 2.935 5.643 2.31C6.268 1.685 7.116 1.333 8 1.333C8.884 1.333 9.732 1.685 10.357 2.31C10.982 2.935 11.333 3.783 11.333 4.667V7.333H4.667V4.667Z" />
  </svg>
);

/* Arrow into a frame — View Company Dashboard, and Login As on the Users
   menu (673:1437 ships the identical asset). */
export const MenuEnterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M7 5L10 8L7 11M9.167 8H2.667M10 2.333H13.333V13.667H10" />
  </svg>
);

/* Price tag with an ✕ — Cancel Subscription. */
export const MenuCancelSubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M4 4H13.333M4 4L4.333 15.333H13L13.333 4M4 4H2.667M13.333 4H14.667M10.553 7.781L8.667 9.667M8.667 9.667L6.781 11.552M8.667 9.667L6.781 7.781M8.667 9.667L10.553 11.552M6.333 2H11V4H6.333V2Z" />
  </svg>
);

/* ── Users 3-dot menu glyphs — Figma 673:1437 "3-Dot Menu - B2C User". Same
   transcription rules as the Companies set above. Edit User Details, Login As,
   View All Company Employees and Remove User reuse RowEditIcon / MenuEnterIcon
   / MenuUsersIcon / RowDeleteIcon — those assets are byte-identical. ── */

/* Badge with a person — View Profile. */
export const MenuProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M6.472 1.668C6.602 1.37 6.815 1.117 7.087 0.939C7.358 0.761 7.676 0.667 8 0.667C8.325 0.667 8.642 0.761 8.913 0.939C9.185 1.117 9.398 1.37 9.528 1.668H13.667V14.334H2.333V1.668H6.472Z" />
    <path d="M11.333 12.001C11.333 11.471 11.123 10.962 10.748 10.587C10.373 10.212 9.864 10.001 9.333 10.001H6.667C6.136 10.001 5.628 10.212 5.253 10.587C4.877 10.962 4.667 11.471 4.667 12.001M9.667 6.334C9.667 6.776 9.491 7.2 9.179 7.513C8.866 7.825 8.442 8.001 8 8.001C7.558 8.001 7.134 7.825 6.822 7.513C6.509 7.2 6.333 6.776 6.333 6.334C6.333 5.892 6.509 5.468 6.822 5.156C7.134 4.843 7.558 4.668 8 4.668C8.442 4.668 8.866 4.843 9.179 5.156C9.491 5.468 9.667 5.892 9.667 6.334Z" />
  </svg>
);

/* Same badge with a check — Manage Training Progress. */
export const MenuProgressIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M6.472 1.668C6.602 1.37 6.815 1.117 7.087 0.939C7.358 0.761 7.676 0.667 8 0.667C8.325 0.667 8.642 0.761 8.913 0.939C9.185 1.117 9.398 1.37 9.528 1.668H13.667V14.334H2.333V1.668H6.472Z" />
    <path d="M5.172 8.277L7.057 10.163L10.829 6.392" />
  </svg>
);

/* Bank building — View User's Company. */
export const MenuBankIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M14 14.667H2M4 8V12M8 8V12M12 8V12M2 4.667V5.333H14V4.667L8 1.333L2 4.667Z" />
  </svg>
);

/* Card struck through — Cancel Subscription on the Users menu. The Companies
   menu keeps its own price-tag glyph (MenuCancelSubIcon); 673:1941 ships this
   card instead. The outline's gaps are the asset's — the lines break where the
   slash crosses them. */
export const MenuCardOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M10.667 6.667H14.667M14.667 6.667V2.667H6.667M14.667 6.667V10.667M4 10H6M1.333 6.667H6M14.667 14.667L1.333 1.333M2.667 2.667H1.333V13.333H13.333L2.667 2.667Z" />
  </svg>
);

/* Document with a folded corner and a person on it — View User IDs (node
   679:2031). The person is MenuProfileIcon's, dropped 0.667 to sit inside the
   page. */
export const MenuIdDocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M2.667 1.333H10L13.333 4.667V14.667H2.667V1.333Z" />
    <path d="M11.333 12.667C11.333 12.136 11.123 11.628 10.748 11.252C10.372 10.877 9.864 10.667 9.333 10.667H6.667C6.136 10.667 5.628 10.877 5.252 11.252C4.877 11.628 4.667 12.136 4.667 12.667M9.667 7C9.667 7.442 9.491 7.866 9.179 8.179C8.866 8.491 8.442 8.667 8 8.667C7.558 8.667 7.134 8.491 6.821 8.179C6.509 7.866 6.333 7.442 6.333 7C6.333 6.558 6.509 6.134 6.821 5.821C7.134 5.509 7.558 5.333 8 5.333C8.442 5.333 8.866 5.509 9.179 5.821C9.491 6.134 9.667 6.558 9.667 7Z" />
  </svg>
);

/* ── Users PAGE-level 3-dot menu — Figma 677:1956: Scholarships, Merge
   Accounts, Transfer Subscription, in the Icon Library's 16px square-cap
   style. ── */

/* Git-merge nodes — Merge Accounts. */
export const MenuMergeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M12.333 10.333V9.667C12.333 9.136 12.123 8.628 11.748 8.253C11.372 7.877 10.864 7.667 10.333 7.667H5.667C5.136 7.667 4.628 7.456 4.252 7.081C3.877 6.706 3.667 6.197 3.667 5.667M12.333 10.333C11.891 10.333 11.467 10.509 11.155 10.822C10.842 11.134 10.667 11.558 10.667 12C10.667 12.442 10.842 12.866 11.155 13.179C11.467 13.491 11.891 13.667 12.333 13.667C12.775 13.667 13.199 13.491 13.512 13.179C13.824 12.866 14 12.442 14 12C14 11.558 13.824 11.134 13.512 10.822C13.199 10.509 12.775 10.333 12.333 10.333ZM3.667 5.667C4.109 5.667 4.533 5.491 4.845 5.179C5.158 4.866 5.333 4.442 5.333 4C5.333 3.558 5.158 3.134 4.845 2.821C4.533 2.509 4.109 2.333 3.667 2.333C3.225 2.333 2.801 2.509 2.488 2.821C2.176 3.134 2 3.558 2 4C2 4.442 2.176 4.866 2.488 5.179C2.801 5.491 3.225 5.667 3.667 5.667ZM3.667 6V10M5.333 12C5.333 12.442 5.158 12.866 4.845 13.179C4.533 13.491 4.109 13.667 3.667 13.667C3.225 13.667 2.801 13.491 2.488 13.179C2.176 12.866 2 12.442 2 12C2 11.558 2.176 11.134 2.488 10.822C2.801 10.509 3.225 10.333 3.667 10.333C4.109 10.333 4.533 10.509 4.845 10.822C5.158 11.134 5.333 11.558 5.333 12Z" />
  </svg>
);

/* Mortarboard with its tassel — Scholarships (node 1521:3816). The asset's
   15.78×14.13 group sits at (0.111, 0.538) in the 16 box; shifted into the
   viewBox it lands on the 16px grid (board 1.333–14.667 across, 1.333–14 down). */
export const MenuScholarshipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M14 6.1V10M8 10L12 7.4V11.667C12 12.955 10.21 14 8 14C5.791 14 4 12.955 4 11.667V7.4L8 10ZM8 10L1.333 5.667L8 1.333L14.667 5.667L8 10Z" />
  </svg>
);

/* Opposed horizontal arrows — Transfer Subscription. */
export const MenuTransferIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M14 9.667H2.667L6 13M2 6.333H13.333L10 3" />
  </svg>
);

/* ── Tasks 3-dot menu glyphs — Figma 735:1375 "3-Dot Menu - Task". Edit Task,
   Make Visible, Manage User Progress and Delete Task reuse RowEditIcon /
   RowEyeIcon / MenuProgressIcon / RowDeleteIcon — those assets are
   byte-identical. Same transcription rules as the sets above. ── */

/* Bill sliding into a cash tray with a coin — View Who Paid (node 7:5522). */
export const MenuPaidIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M14 7.336H13.883L12.667 3.781L2.236 7.336L2 7.334M1.667 7.337H2L9.431 1.401L11.309 4.034" />
    <path d="M9.667 10.668C9.667 11.11 9.491 11.534 9.179 11.846C8.866 12.159 8.442 12.334 8 12.334C7.558 12.334 7.134 12.159 6.821 11.846C6.509 11.534 6.333 11.11 6.333 10.668C6.333 10.226 6.509 9.802 6.821 9.489C7.134 9.177 7.558 9.001 8 9.001C8.442 9.001 8.866 9.177 9.179 9.489C9.491 9.802 9.667 10.226 9.667 10.668Z" />
    <path d="M14.333 7.334V14.001H1.667V7.334H14.333Z" />
    <path d="M1.667 7.334H3C3 7.688 2.86 8.027 2.609 8.277C2.359 8.527 2.02 8.668 1.667 8.668V7.334ZM14.333 7.334H13C13 7.688 13.141 8.027 13.391 8.277C13.641 8.527 13.98 8.668 14.333 8.668V7.334ZM1.667 14.001H3.001C3.002 13.826 2.967 13.652 2.9 13.49C2.833 13.328 2.735 13.181 2.611 13.057C2.487 12.933 2.34 12.835 2.178 12.768C2.016 12.701 1.842 12.666 1.667 12.666V14.001ZM14.333 14.001H13C13 13.647 13.141 13.308 13.391 13.058C13.641 12.808 13.98 12.667 14.333 12.667V14.001Z" />
  </svg>
);

/* Manage Completions menu glyphs (Figma 970:991 "3-Dot Menu - Manage
   Completions"). Square-cap 16px strokes like the rest of the Menu family;
   the box-and-mark pair reads as a completion checkbox rather than the
   free-standing check / circle-✕ this menu borrowed before. */

/* Box with a check — Mark as Completed (node 7:1472). */
export const MenuMarkCompleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M2 2H14V14H2V2Z" />
    <path d="M11 6L7 10L5 8" />
  </svg>
);

/* Box with an ✕ — Mark as Incomplete (node 7:1818). */
export const MenuMarkIncompleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M14 2H2V14H14V2Z" />
    <path d="M9.886 6.114L8 8M8 8L6.114 9.886M8 8L6.114 6.114M8 8L9.886 9.886" />
  </svg>
);

/* Circle with a plus — Grant Additional Attempts (node 7:34). */
export const MenuGrantAttemptsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333">
    <circle cx="8" cy="8" r="6.667" />
    <path d="M11 8H5M8 5V11" strokeLinecap="square" />
  </svg>
);

/* The same 7:34 circle-plus under the name its other role gives it: "Create
   New Task" in the Certification builder's Add Task menu (1259:1674). */
export const AddCircleIcon = MenuGrantAttemptsIcon;

/* Small arrow-right — the "subject → change" separator in the Changes Made
   hover card (node 1155:1166). Drawn at the node's own 10.286 box so the
   0.857 stroke stays as fine as the design's. */
export const ChangeArrowIcon = () => (
  <svg width="10.2857" height="10.2857" viewBox="0 0 10.2857 10.2857" fill="none">
    <path
      d="M5.57143 7.5L7.92857 5.14286L5.57143 2.78571M7.39286 5.14286H1.82143"
      stroke="currentColor"
      strokeWidth="0.857143"
      strokeLinecap="square"
    />
  </svg>
);

/* tdesign:close at the 14px size the Changes Made card's per-row dismiss uses
   (node 1155:1187). The 20px `ModalCloseIcon` is a different cut. */
export const SmallCloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M10.5 3.5L7 7M7 7L3.5 10.5M7 7L10.5 10.5M7 7L3.5 3.5"
      stroke="currentColor"
      strokeWidth="1.69697"
      strokeLinecap="square"
    />
  </svg>
);

/* Speech bubble with a question mark — View All Attempts (node 7:3217). */
export const MenuAttemptsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M1.667 2H14.333V11.333H4.333L1.667 13.667V2Z" />
    <path d="M6.667 5.667C6.667 5.313 6.807 4.974 7.057 4.724C7.307 4.473 7.646 4.333 8 4.333C8.354 4.333 8.693 4.473 8.943 4.724C9.193 4.974 9.333 5.313 9.333 5.667C9.333 7 8.002 7.019 8.002 7.167M8 9H8.003V9.003H8V9Z" />
  </svg>
);

/* Mouse pointer inside a slashed circle — the QUESTION BANK's Archive glyph
   (Figma 1085:1082 "3-Dot Menu - Question Bank"): an archived question can no
   longer be picked into a Quiz or a Feedback Form. Other pages' Archive rows
   keep the octagon-✕ `MenuArchiveIcon` below; the designer only re-cut this
   one menu. */
export const MenuArchiveOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M9.133 6.047L10.468 5.533L9.955 6.868M5.255 1.923C6.118 1.534 7.054 1.333 8 1.333C11.682 1.333 14.667 4.318 14.667 8C14.667 8.978 14.456 9.907 14.077 10.744M3.287 3.287C2.667 3.905 2.175 4.64 1.84 5.448C1.505 6.257 1.332 7.124 1.333 8C1.333 11.682 4.318 14.667 8 14.667C8.876 14.668 9.743 14.496 10.552 14.161C11.361 13.826 12.096 13.334 12.714 12.714M2 2L14 14M8.339 11.067L7.439 8.563L4.933 7.662L6.905 6.903L9.097 9.096L8.339 11.067Z" />
  </svg>
);

/* Octagon with an ✕ — the archive/deactivate glyph (Figma node 7:1812). */
export const MenuArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M10.121 5.879L8 8M8 8L5.879 10.121M8 8L10.121 10.121M8 8L5.879 5.878M5.377 1.667H10.623L14.333 5.377V10.623L10.623 14.333H5.377L1.667 10.623V5.377L5.377 1.667Z" />
  </svg>
);

/* ── Certifications 3-dot menu glyphs — Figma 735:1454 "3-Dot Menu -
   Certifications". Edit Certification, Make Visible/Hidden, View Who Paid,
   Manage User Progress and Delete Certification reuse RowEditIcon /
   RowEyeIcon / RowEyeOffIcon / MenuPaidIcon / MenuProgressIcon /
   RowDeleteIcon — those assets are byte-identical. These two are new. ── */

/* Broken chain — Manage Content Links (node 735:1501). The asset already
   draws in the full 16px frame, so it needs no translation. */
export const MenuLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M7.784 4.66L9.333 3.111C9.805 2.64 10.444 2.375 11.111 2.375C11.441 2.375 11.768 2.44 12.073 2.566C12.378 2.693 12.655 2.878 12.889 3.111C13.122 3.345 13.307 3.622 13.434 3.927C13.56 4.232 13.625 4.559 13.625 4.889C13.625 5.219 13.56 5.546 13.434 5.851C13.307 6.156 13.122 6.433 12.889 6.667L11.34 8.216M4.66 7.785L3.111 9.333C2.639 9.805 2.374 10.444 2.374 11.111C2.374 11.778 2.639 12.418 3.111 12.889C3.582 13.361 4.222 13.626 4.889 13.626C5.556 13.626 6.195 13.361 6.667 12.889L8.215 11.34M9.332 6.667L6.665 9.333" />
  </svg>
);

/* Compass dial struck through — Archive & Replace (node 790:1747). Retiring a
   Certification takes it off the catalog's map; the slash is the asset's. */
export const MenuArchiveReplaceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M9.133 6.047L10.468 5.533L9.955 6.868M5.255 1.923C6.118 1.534 7.054 1.333 8 1.333C11.682 1.333 14.667 4.318 14.667 8C14.667 8.978 14.456 9.907 14.077 10.744M3.287 3.287C2.667 3.905 2.175 4.64 1.84 5.448C1.505 6.257 1.332 7.124 1.333 8C1.333 11.682 4.318 14.667 8 14.667C8.876 14.668 9.743 14.496 10.552 14.161C11.361 13.826 12.096 13.334 12.714 12.714M2 2L14 14M8.339 11.067L7.439 8.563L4.933 7.662L6.905 6.903L9.097 9.096L8.339 11.067Z" />
  </svg>
);

/* Stacked layers — the Setup card's Industries step (1592:2601). The export's
   group sits at an inset, so a translate places it; path verbatim. */
export const SetupIndustriesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333">
    <g transform="translate(1.2667 1.2777)">
      <path d="M0.733333 6.38889L6.73333 8.97356L12.7333 6.38956M12.7333 10.3896L6.73333 12.9736L0.733333 10.3896M1.73333 2.80556L6.73333 0.722222L11.7333 2.80556L6.73333 4.88889L1.73333 2.80556Z" />
    </g>
  </svg>
);

/* Card with a ribbon — the Setup card's Awards step (1592:2621). Path
   verbatim, placed by the export's inset. */
export const SetupAwardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <g transform="translate(0.6667 2)">
      <path d="M3.33333 6H6M3.33333 8.66667H11.3333M8.66667 0.666667H11.3333V4.33333L10 3.33333L8.66667 4.33333V0.666667Z" />
      <path d="M14 0.666667V11.3333H0.666667V0.666667H14Z" />
    </g>
  </svg>
);

/* tdesign:check on a 12px box (1046:1067 inside "Icon Filled", and 1592:2593
   at 14px — the viewBox scales the 1.6 stroke with it). */
export const SetupCheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
    <path d="M9.63361 3.75015L4.83466 8.55015L2.25008 5.96557" />
  </svg>
);

/* Open folder — "View All Tasks" (node 974:1063). The asset draws its group at
   an inset rather than in the full 16px frame, so a translate places it; the
   path data itself is the export's, untouched. */
export const MenuAllTasksIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <g transform="translate(0 1.6667)">
      <path d="M0.666667 11.6667H13L15 5H2.66667L0.666667 11.6667ZM0.666667 11.6667V0.666667H4.66667L6.66667 2.33333H13V5" />
    </g>
  </svg>
);

/* Certificate card with a seal — "Add Award" / "Manage Award" in the
   Certification row menu (node 1226:1425). An Award is a Card and/or a
   Certificate, so the glyph is the card itself rather than a rosette. */
export const MenuAwardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M1.333 3.333H14.667V12.667H1.333V3.333Z" />
    <path d="M6 7.333C6 8.069 5.403 8.667 4.667 8.667C3.93 8.667 3.333 8.069 3.333 7.333C3.333 6.597 3.93 6 4.667 6C5.403 6 6 6.597 6 7.333Z" />
    <path d="M8.667 6.667H12.667M8.667 9.333H11.333" />
  </svg>
);

/* Cloud with an up-arrow — "Backup Certification" (node 974:1069), replacing
   the placeholder box the entry carried before the frame gained a real glyph. */
export const MenuBackupIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <g transform="translate(0 1.3333)">
      <path d="M0.666667 8.33407C0.666667 8.81559 0.761508 9.29239 0.945775 9.73725C1.13004 10.1821 1.40013 10.5863 1.74061 10.9268C2.42824 11.6144 3.36087 12.0007 4.33333 12.0007H11.6667C12.5828 12.0019 13.4661 11.6601 14.1428 11.0427C14.8196 10.4252 15.2406 9.57675 15.3232 8.66438C15.4057 7.75201 15.1437 6.8418 14.5887 6.11291C14.0338 5.38403 13.2261 4.88929 12.3247 4.72607C12.255 3.62642 11.7691 2.59461 10.9657 1.84051C10.1623 1.08641 9.10185 0.666667 8 0.666667C6.89815 0.666667 5.83768 1.08641 5.0343 1.84051C4.23092 2.59461 3.74499 3.62642 3.67533 4.72607C2.8308 4.88013 2.06709 5.32563 1.51729 5.98495C0.967493 6.64427 0.666466 7.4756 0.666667 8.33407Z" />
      <path d="M10 6.33407L8 4.33407L6 6.33407M8 9.33407V7.33407V4.66741" />
    </g>
  </svg>
);

/* Speech bubble with three bars — "View Responses" in the Feedback Form row
   menu (807:1280). Same 16px / 1.3333 square-cap library as its siblings. */
export const MenuResponsesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M4.667 8V8.667M8 4.667V8.667M11.333 6.667V8.667M1.667 2H14.333V11.333H4.333L1.667 13.667V2Z" />
  </svg>
);

/* Kebab Menu - Horizontal (386:260) — three 2px square dots on the 8px
   centreline, at x 2/7/12. Figma strokes a 0.667 square with a 1.3333 cap,
   which resolves to exactly these filled rects. */
export const RowKebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="7" width="2" height="2" />
    <rect x="7" y="7" width="2" height="2" />
    <rect x="12" y="7" width="2" height="2" />
  </svg>
);

/* The caret on a dropdown field (101:278, the "Icon Set" instance inside
   Figma 101:272 "Dropdown - No Selection") — a SOLID 14px wedge, not one of the
   stroked chevrons. Path is the Figma export verbatim; the fill is
   currentColor so the field can tint it. */
export const DropdownCaretIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.58324 9.79585L12.25 5.1291L11.0835 3.96261L7 8.04613L2.91648 3.96261L1.75 5.1291L6.41676 9.79585C6.57146 9.95051 6.78125 10.0374 7 10.0374C7.21875 10.0374 7.42854 9.95051 7.58324 9.79585Z"
      fill="currentColor"
    />
  </svg>
);

/* Chevron down (568:4382) on the icon library's 16px / 1.3333 / square-cap
   grid — the disclosure glyph for the archived-Spotlights row. Distinct from
   the older `ChevronDownIcon`, which is a rounded-cap 24-box glyph. */
export const ChevronDownSquareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M11.667 6.333L8 10L4.333 6.333" />
  </svg>
);

/* Chevron right (762:4704 / 762:4707, "Icon Library") — the open-row affordance
   on the Hands-On submissions table, in the resting cell AND inside the hover
   pill. Same 16px / 1.3333 / square-cap grid as ChevronDownSquareIcon; the path
   is the Figma export verbatim. Inline (not the exported <img>) because the two
   states tint it differently — #a8a8a8 resting, white in the pill. */
export const RowChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M6.33333 11.6667L10 8L6.33333 4.33333" />
  </svg>
);

/* Arrow right (673:1432, "Icon Library") — the between-dates glyph on the Date
   Range pill's custom-range value. 14px box, square caps, 1.1667 stroke; path
   is the Figma export verbatim. */
export const RangeArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M7.58333 10.2083L10.7917 7L7.58333 3.79167M10.0625 7H2.47917" />
  </svg>
);

/* Info (566:2277) — the ringed "i". Path data is the Figma export verbatim, on
   its own 11-unit box rather than re-centred on the icon frame's 12: the 0.5
   coordinates put every 1px stroke on the pixel grid, and a centred vertical
   stroke only lands cleanly in an odd-width box. Re-centring it on 12 splits
   each stroke across two pixel columns and the glyph turns to mush at this
   size. */
/* Page-subtext info glyph (Figma 742:1061 → Icon Library 7:5006 at 14px): the
   circle-i drawn AT 14px — 1.1667 stroke, square caps, 8.33% inset — so it
   renders crisp. `InfoIcon` below is the 11px cut; scaling it to 14px via CSS
   blurred the strokes, which is what "the info icon isn't clear" was. */
export const InfoIcon14 = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M1.16667 7C1.16667 3.77825 3.77825 1.16667 7 1.16667C10.2218 1.16667 12.8333 3.77825 12.8333 7C12.8333 10.2218 10.2218 12.8333 7 12.8333C3.77825 12.8333 1.16667 10.2218 1.16667 7Z" />
    <path d="M7 9.625V6.41667M7 4.375H6.99767V4.37267H7V4.375Z" />
  </svg>
);

/* The ⓘ that ends a field's subtext (Figma 1369:1669, every field's "User can
   enter an answer of their own ⓘ"): a 12px box, 10px circle, 1px square-capped
   stroke — drawn natively at 12 so the stroke lands on whole pixels, rather
   than scaling the 11px `InfoIcon` cut (which blurred). */
export const InfoIcon12 = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M1 6C1 3.23858 3.23858 1 6 1C8.76142 1 11 3.23858 11 6C11 8.76142 8.76142 11 6 11C3.23858 11 1 8.76142 1 6Z" />
    <path d="M6 8.25V5.5M6 3.75H5.998V3.748H6V3.75Z" />
  </svg>
);

export const InfoIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeLinecap="square">
    <path d="M0.5 5.5C0.5 2.7385 2.7385 0.5 5.5 0.5C8.2615 0.5 10.5 2.7385 10.5 5.5C10.5 8.2615 8.2615 10.5 5.5 10.5C2.7385 10.5 0.5 8.2615 0.5 5.5Z" />
    <path d="M5.5 7.75V5M5.5 3.25H5.498V3.248H5.5V3.25Z" />
  </svg>
);

/* move (558:2075) — the large-table drag handle: a 2×4 grid of 2.5px square
   dots on a 20px box. Same construction as RowKebabIcon: Figma strokes a 0.833
   square with a 1.6667 square cap, which resolves to these filled rects. */
export const RowDragIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    {[1.875, 6.458, 11.042, 15.625].map((y) => (
      <g key={y}>
        <rect x="5.625" y={y} width="2.5" height="2.5" />
        <rect x="11.875" y={y} width="2.5" height="2.5" />
      </g>
    ))}
  </svg>
);

/* move (751:2524) — the Quiz Questions row drag handle: the 16px "move"
   variant of the family, two columns of four 2px square dots. Same
   construction as RowDragIcon: Figma strokes a 0.667 square with a 1.333
   square cap, which resolves to these filled rects. */
export const MoveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {[1.5, 5.167, 8.833, 12.5].map((y) => (
      <g key={y}>
        <rect x="4.5" y={y} width="2" height="2" />
        <rect x="9.5" y={y} width="2" height="2" />
      </g>
    ))}
  </svg>
);

/* Copy — two stacked pages, from the Figma icon library (436:607). Drawn on the
   library's 14px box: the sheet in front, then the one behind it. */
export const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1667" strokeLinecap="square">
    <path d="M7.583 0.583V4.083H11.083M7.583 0.583H8.167L11.083 3.5V4.083M7.583 0.583H3.5V9.917H11.083V4.083" strokeLinecap="butt" />
    <path d="M1.167 2.917V12.25H7.583" />
  </svg>
);

/* Arrow keycaps (Figma 439:713 / 439:716) — the ← → glyphs shown inside a
   20px key cap. 12px box, square caps, matching the icon library's geometry. */
export const KeyArrowRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeLinecap="square">
    <g transform="translate(1.83 2.54)">
      <path d="M4.875 6.20711L7.625 3.45711L4.875 0.707107M7 3.45711H0.5" />
    </g>
  </svg>
);

export const KeyArrowLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeLinecap="square">
    <g transform="translate(1.83 2.54)">
      <path d="M3.45711 0.707107L0.707107 3.45711L3.45711 6.20711M1.33211 3.45711H7.83211" />
    </g>
  </svg>
);

/* ⌘ keycap glyph (Figma 773:1231) — the search bar's command key, drawn on the
   icon library's 14px box. The 18px Large bar reuses it; the viewBox scales the
   1.1667 stroke with it. */
export const KeyCommandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667">
    <path d="M8.45833 5.54167V8.45833M8.45833 5.54167H5.54167M8.45833 5.54167V3.79167C8.45833 3.44555 8.56097 3.1072 8.75326 2.81942C8.94555 2.53163 9.21887 2.30733 9.53864 2.17488C9.85841 2.04242 10.2103 2.00777 10.5497 2.07529C10.8892 2.14282 11.201 2.30949 11.4458 2.55423C11.6905 2.79897 11.8572 3.11079 11.9247 3.45026C11.9922 3.78973 11.9576 4.14159 11.8251 4.46136C11.6927 4.78113 11.4684 5.05445 11.1806 5.24674C10.8928 5.43903 10.5545 5.54167 10.2083 5.54167H8.45833ZM8.45833 8.45833H5.54167M8.45833 8.45833H10.2083C10.5545 8.45833 10.8928 8.56097 11.1806 8.75326C11.4684 8.94555 11.6927 9.21887 11.8251 9.53864C11.9576 9.85841 11.9922 10.2103 11.9247 10.5497C11.8572 10.8892 11.6905 11.201 11.4458 11.4458C11.201 11.6905 10.8892 11.8572 10.5497 11.9247C10.2103 11.9922 9.85841 11.9576 9.53864 11.8251C9.21887 11.6927 8.94555 11.4684 8.75326 11.1806C8.56097 10.8928 8.45833 10.5545 8.45833 10.2083V8.45833ZM5.54167 5.54167V8.45833M5.54167 5.54167H3.79167C3.44555 5.54167 3.1072 5.43903 2.81942 5.24674C2.53163 5.05445 2.30733 4.78113 2.17488 4.46136C2.04242 4.14159 2.00777 3.78973 2.07529 3.45026C2.14282 3.11079 2.30949 2.79897 2.55423 2.55423C2.79897 2.30949 3.11079 2.14282 3.45026 2.07529C3.78973 2.00777 4.14159 2.04242 4.46136 2.17488C4.78113 2.30733 5.05445 2.53163 5.24674 2.81942C5.43903 3.1072 5.54167 3.44555 5.54167 3.79167V5.54167ZM5.54167 8.45833V10.2083C5.54167 10.5545 5.43903 10.8928 5.24674 11.1806C5.05445 11.4684 4.78113 11.6927 4.46136 11.8251C4.14159 11.9576 3.78973 11.9922 3.45026 11.9247C3.11079 11.8572 2.79897 11.6905 2.55423 11.4458C2.30949 11.201 2.14282 10.8892 2.07529 10.5497C2.00777 10.2103 2.04242 9.85841 2.17488 9.53864C2.30733 9.21887 2.53163 8.94555 2.81942 8.75326C3.1072 8.56097 3.44555 8.45833 3.79167 8.45833H5.54167Z" />
  </svg>
);

/* ↵ and ⇧ keycap glyphs (Figma 756:3772 / 1113:1109) — the wizard footer's
   ⌘+Enter and ⌘+Shift+Enter hints, drawn on the same 14px Icon Library box as
   {@link KeyCommandIcon}. Paths are the Figma exports verbatim, recoloured to
   currentColor so the keycap's own tone drives them. */
export const KeyEnterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M3.35417 9.33333H9.33333C10.2998 9.33333 11.0833 8.54983 11.0833 7.58333L11.0833 2.91667M4.66667 7.29167L2.625 9.33333L4.66667 11.375" />
  </svg>
);

/* ↑ / ↓ keycap glyphs — the search panel footer's "To Navigate" pair (Figma
   21:15992 / 21:15994), 12px Icon Library exports verbatim. Not mirror images
   of each other in the file (the heads sit 2.5 / 9.55 from the top), so both
   are transcribed rather than one being flipped; ↓ is the same glyph as
   {@link FullTableIcon}. */
export const KeyArrowUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M8.75 5.25L6 2.5L3.25 5.25M6 3.125V9.625" />
  </svg>
);

export const KeyArrowDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
    <path d="M8.75 6.8L6 9.55L3.25 6.8M6 8.925V2.425" />
  </svg>
);

export const KeyShiftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="square">
    <path d="M10.2083 6.41667L7 2.1875L3.79167 6.41667H5.83333V12.25H8.16667V6.41667H10.2083Z" />
  </svg>
);

/* Manage Completions task-table glyphs (Figma 960:980) — 12px "Icon Library"
   instances beside a cell's value. Paths are the Figma exports verbatim,
   translated into the 12px box the instance places them in; Figma bakes the
   colours in (#a8a8a8 / #ffc524 / #ff1f31), here they take currentColor so the
   cell's own tone drives them. */

/* Flag — a completion an admin set by hand. */
export const FlagIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeLinecap="square">
    <g transform="translate(1.5 1)">
      <path d="M0.5 6H4L5 7H8.5L7.5 4.25L8.5 1.5H5L4 0.5H0.5V6ZM0.5 6V9.75" />
    </g>
  </svg>
);

/* Hourglass — an attempt submitted and awaiting review. */
export const HourglassIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
    <g transform="translate(2 1)">
      <path d="M4 5C4.92826 5 5.8185 5.36875 6.47487 6.02513C7.13125 6.6815 7.5 7.57174 7.5 8.5V9.5H0.5V8.5C0.5 7.57174 0.868749 6.6815 1.52513 6.02513C2.1815 5.36875 3.07174 5 4 5ZM4 5C3.07174 5 2.1815 4.63125 1.52513 3.97487C0.868749 3.3185 0.5 2.42826 0.5 1.5V0.5H7.5V1.5C7.5 2.42826 7.13125 3.3185 6.47487 3.97487C5.8185 4.63125 4.92826 5 4 5Z" />
    </g>
  </svg>
);

/* Error triangle — every attempt used without a pass. */
export const ErrorTriangleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
    <g transform="translate(0 0.75)">
      <path d="M10.6532 9.59954H1.29966L5.97544 1.49896L10.6532 9.59954Z" strokeWidth="0.5" />
      <path d="M5.97606 0.999934L11.0861 9.84993H0.866064L5.97606 0.999934Z" strokeLinecap="square" />
      <path d="M5.97606 4.74993V6.49993M5.97606 8.24993H5.97806V8.25193H5.97606V8.24993Z" strokeLinecap="square" />
    </g>
  </svg>
);

/* Filled alert circle — the 16px disc with the exclamation knocked out
   (Figma 1031:1038 "Icon Library", the Outstanding Balance card's glyph).
   Path data is the Figma export verbatim. Distinct from InfoFilledIcon,
   which is the smaller "i" disc. */
/* Outline alert circle — Figma 457:583 "Icon Library" (the Past Attempts
   Flagged card). The node's 14.667px group sits 0.667px in from the 16px box;
   path data verbatim, stroked in currentColor (the node's #a8a8a8 comes from
   NoteCard's `mutedIcon`). */
export const AlertCircleOutlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <g transform="translate(0.666667 0.666667)" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <path d="M14 7.33333C14 11.0153 11.0153 14 7.33333 14C3.65133 14 0.666667 11.0153 0.666667 7.33333C0.666667 3.65133 3.65133 0.666667 7.33333 0.666667C11.0153 0.666667 14 3.65133 14 7.33333Z" />
      <path d="M7.33333 4.33333V8M7.33333 10.3333H7.336V10.336H7.33333V10.3333Z" />
    </g>
  </svg>
);

export const AlertCircleFilledIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 0.666667C12.05 0.666667 15.3333 3.95 15.3333 8C15.3333 12.05 12.05 15.3333 8 15.3333C3.95 15.3333 0.666667 12.05 0.666667 8C0.666667 3.95 3.95 0.666667 8 0.666667ZM7.33333 9.33333H8.66667V4.33333H7.33333V9.33333ZM8.66933 10.3333H7.33333V11.6693H8.66933V10.3333Z"
      fill="currentColor"
    />
  </svg>
);

/* tdesign:user-1-filled — the person glyph of the no-photo avatar (Figma
   1571:3662), transcribed from the 47px export; takes currentColor. */
export const UserFilledIcon = () => (
  <svg viewBox="0 0 47 47" fill="currentColor" aria-hidden="true">
    <path d="M13.708 13.7091C13.708 11.1122 14.7396 8.62164 16.5759 6.78535C18.4122 4.94905 20.9027 3.91743 23.4996 3.91743C26.0965 3.91743 28.5871 4.94905 30.4234 6.78535C32.2597 8.62164 33.2913 11.1122 33.2913 13.7091C33.2913 16.306 32.2597 18.7966 30.4234 20.6329C28.5871 22.4691 26.0965 23.5008 23.4996 23.5008C20.9027 23.5008 18.4122 22.4691 16.5759 20.6329C14.7396 18.7966 13.708 16.306 13.708 13.7091ZM6.85379 37.2091C6.85379 34.6122 7.8854 32.1216 9.7217 30.2853C11.558 28.4491 14.0485 27.4174 16.6455 27.4174H30.3538C31.6397 27.4174 32.9129 27.6707 34.1009 28.1628C35.2889 28.6549 36.3683 29.3761 37.2775 30.2853C38.1868 31.1946 38.908 32.274 39.4001 33.462C39.8922 34.65 40.1455 35.9232 40.1455 37.2091V41.1258H6.85379V37.2091Z" />
  </svg>
);
