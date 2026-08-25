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

export const SearchIcon = () => (
  <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.83114 8.23679e-05C7.35854 0.008312 8.82139 0.618266 9.90145 1.69832C10.9815 2.77838 11.5915 4.24123 11.5997 5.76864C11.6064 7.02957 11.2015 8.25094 10.4591 9.25301L14.0391 12.8331L12.9083 13.9649L9.337 10.3946C8.94597 10.6955 8.51866 10.9475 8.06258 11.1407C7.35657 11.4398 6.59787 11.5956 5.83114 11.5997C5.06433 11.6038 4.30404 11.4557 3.59481 11.1641C2.88554 10.8726 2.24058 10.4437 1.69832 9.90145C1.15607 9.35919 0.727208 8.71424 0.435629 8.00496C0.144086 7.29573 -0.00400175 6.53545 8.22256e-05 5.76864C0.0042134 5.0019 0.159996 4.24321 0.459067 3.53719C0.758139 2.83127 1.19444 2.19169 1.74227 1.65536C2.83386 0.586779 4.3036 -0.00805325 5.83114 8.23679e-05ZM5.82235 1.59969C4.7162 1.5938 3.65187 2.02511 2.86141 2.79891C2.46488 3.18719 2.14923 3.65022 1.9327 4.16122C1.71611 4.67252 1.60266 5.22215 1.59969 5.77743C1.59673 6.33263 1.70406 6.88304 1.91512 7.39657C2.12626 7.91018 2.43749 8.37695 2.83016 8.76961C3.22283 9.16228 3.6896 9.47351 4.20321 9.68465C4.71673 9.89572 5.26714 10.003 5.82235 10.0001C6.37762 9.99711 6.92725 9.88367 7.43856 9.66707C7.95012 9.45031 8.41284 9.13473 8.80086 8.73836C9.57458 7.94798 10.006 6.88368 10.0001 5.77743C9.99417 4.67132 9.55177 3.61231 8.76961 2.83016C7.98746 2.04801 6.92846 1.60561 5.82235 1.59969Z" fill="currentColor" />
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

/* Stepper glyphs (Figma 618:1266 / 618:1270): a 16px box holding a 9.33px
   stroke. The node draws its minus shorter than its plus bar; they are matched
   here so the two ends of one control balance. */
export const StepperMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round">
    <path d="M3.333 8h9.334" />
  </svg>
);

export const StepperPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round">
    <path d="M8 3.333v9.334M3.333 8h9.334" />
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

export const ArrowUpRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

/* "arrow-right-up" from the File Upload - Primary component (378:257) — a
   16px square-capped glyph, distinct from the rounded 12px ArrowUpRightIcon
   above that the breadcrumb/link rows use. */
export const ArrowRightUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M5.5146 5.33332L10.7001 5.33332V10.5188M10.1137 5.91963L5.34961 10.6838" />
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

/* Keycap arrows — the ↑ ↓ hints in the review queue footer (Figma 263:1618). */
export const ArrowUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const ArrowDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

/* Reorder arrows for the review-run cards (Figma 714:1496 down / 714:1502 up).
   Transcribed from the exported assets — a 16px box, 1.33333 stroke, SQUARE
   caps. Deliberately NOT the ArrowUp/ArrowDownIcon pair above, which is a
   rounded 12px keycap glyph on a 24px viewBox. */
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

/* Double chevron for the landing's "keep scrolling" bar (Figma 716:1656) —
   transcribed from the exported asset: 16px box, 1.33333 stroke, square caps. */
export const KeepScrollingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M11 4.66667L8 7.66667L5 4.66667M11 9L8 12L5 9" />
  </svg>
);

/* edit-off — marks a read-only review rail (Figma 298:1886). */
export const EditOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5.8l3.2 3.2M4.5 19.5H8l9.6-9.6-3.2-3.2-9.9 9.9z" />
    <path d="M3 3l18 18" />
  </svg>
);

/* ⌘ — the command keycap on the primary CTA (Figma 267:2013). Drawn rather
   than typed so it doesn't depend on the font carrying U+2318. */
export const CommandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
);

export const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M5 20h14" />
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

/* Account-operations icons (Merge Accounts / Transfer Subscription) */
export const AlertTriangleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
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
export const EnterKeyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7v4a3 3 0 0 1-3 3H5" />
    <path d="M9 10l-4 4 4 4" />
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

/* Tree caret (I314:2057;7:1537) — a 3.21×6.42 chevron with a 1.167 square-cap
   stroke, centred in a 14px slot. Rotated 90° by `.tree-caret-btn.is-open`. */
export const TreeCaretIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.167" strokeLinecap="square">
    <path d="M5.54 3.79L8.75 7l-3.21 3.21" />
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

/* ── Manage Users PAGE-level 3-dot menu — Figma 677:1956. The sidebar draws
   its own off-family merge/transfer glyphs (24-unit, round caps); these are
   the Icon Library's 16px square-cap versions. ── */

/* Git-merge nodes — Merge Accounts. */
export const MenuMergeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M12.333 10.333V9.667C12.333 9.136 12.123 8.628 11.748 8.253C11.372 7.877 10.864 7.667 10.333 7.667H5.667C5.136 7.667 4.628 7.456 4.252 7.081C3.877 6.706 3.667 6.197 3.667 5.667M12.333 10.333C11.891 10.333 11.467 10.509 11.155 10.822C10.842 11.134 10.667 11.558 10.667 12C10.667 12.442 10.842 12.866 11.155 13.179C11.467 13.491 11.891 13.667 12.333 13.667C12.775 13.667 13.199 13.491 13.512 13.179C13.824 12.866 14 12.442 14 12C14 11.558 13.824 11.134 13.512 10.822C13.199 10.509 12.775 10.333 12.333 10.333ZM3.667 5.667C4.109 5.667 4.533 5.491 4.845 5.179C5.158 4.866 5.333 4.442 5.333 4C5.333 3.558 5.158 3.134 4.845 2.821C4.533 2.509 4.109 2.333 3.667 2.333C3.225 2.333 2.801 2.509 2.488 2.821C2.176 3.134 2 3.558 2 4C2 4.442 2.176 4.866 2.488 5.179C2.801 5.491 3.225 5.667 3.667 5.667ZM3.667 6V10M5.333 12C5.333 12.442 5.158 12.866 4.845 13.179C4.533 13.491 4.109 13.667 3.667 13.667C3.225 13.667 2.801 13.491 2.488 13.179C2.176 12.866 2 12.442 2 12C2 11.558 2.176 11.134 2.488 10.822C2.801 10.509 3.225 10.333 3.667 10.333C4.109 10.333 4.533 10.509 4.845 10.822C5.158 11.134 5.333 11.558 5.333 12Z" />
  </svg>
);

/* Opposed horizontal arrows — Transfer Subscription. */
export const MenuTransferIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
    <path d="M14 9.667H2.667L6 13M2 6.333H13.333L10 3" />
  </svg>
);

/* Octagon with an ✕ — the archive/deactivate glyph (Figma node 7:1812). */
export const MenuArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M10.121 5.879L8 8M8 8L5.879 10.121M8 8L10.121 10.121M8 8L5.879 5.878M5.377 1.667H10.623L14.333 5.377V10.623L10.623 14.333H5.377L1.667 10.623V5.377L5.377 1.667Z" />
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

/* Chevron down (568:4382) on the icon library's 16px / 1.3333 / square-cap
   grid — the disclosure glyph for the archived-Spotlights row. Distinct from
   the older `ChevronDownIcon`, which is a rounded-cap 24-box glyph. */
export const ChevronDownSquareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3333" strokeLinecap="square">
    <path d="M11.667 6.333L8 10L4.333 6.333" />
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
