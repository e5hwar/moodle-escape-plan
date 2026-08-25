import { useRef, useState } from "react";
import { DocumentIcon, SmallXIcon, UploadTrayIcon } from "./icons";

/** One picked image. `size` is in bytes; `ext` is the upper-cased extension. */
export type PickedImage = { name: string; size: number; ext: string };

/* File Upload - Single Language (Figma 678:2012): the same .drop-big zone as
   the dual-language columns, minus the bordered shell and language tag, at full
   width. One image only, so a picked file swaps the zone for its row rather
   than stacking an "add more" strip.

   Shared by the Skill wizard's badge image and the Certification wizard's
   thumbnail — both are single, optional images with the same accepted types. */
export function ImageUploadField({
  value,
  onChange,
  accept = "image/jpeg,image/png,image/gif",
  types = "JPEG, PNG, GIF",
  maxSize = "20MB",
}: {
  value: PickedImage | null;
  onChange: (v: PickedImage | null) => void;
  accept?: string;
  /** Accepted-types line inside the zone. */
  types?: string;
  /** Maximum-size line inside the zone. */
  maxSize?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    onChange({
      name: f.name,
      size: f.size,
      ext: (f.name.split(".").pop() ?? "").toUpperCase(),
    });
  }

  if (value) {
    return (
      <div className="file-list">
        <div className="file-row">
          <span className="file-icon"><DocumentIcon /></span>
          <div className="file-meta">
            <div className="file-name">{value.name}</div>
            <div className="file-sub">
              {(value.size / 1024 / 1024).toFixed(1)} MB · {value.ext}
            </div>
          </div>
          <button className="file-remove" onClick={() => onChange(null)} aria-label="Remove file">
            <SmallXIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="drop-big"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files);
        }}
      >
        <span className="drop-big-icon"><UploadTrayIcon /></span>
        <div className="drop-big-title">Drag and drop, or click to upload</div>
        <div className="drop-big-hint">
          <div>Accepted File Types: {types}</div>
          <div>Maximum File Size: {maxSize}</div>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => pick(e.target.files)}
      />
    </>
  );
}

/** Uncontrolled wrapper for call sites that don't persist the picked file. */
export function ImagePicker(props: Omit<Parameters<typeof ImageUploadField>[0], "value" | "onChange">) {
  const [file, setFile] = useState<PickedImage | null>(null);
  return <ImageUploadField {...props} value={file} onChange={setFile} />;
}
