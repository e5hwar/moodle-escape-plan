/* The file name inside a `.file-row`, everywhere an upload field lists a picked
   file. The name is the download affordance: clicking it saves the file, and
   hovering shows the shared "Download" tooltip (a native `title` is adopted by
   HoverTooltip). Mock rows that carry no blob URL still show the tooltip and
   simply no-op on click. */
export function FileNameLink({ name, url }: { name: string; url?: string }) {
  return (
    <a
      className="file-name"
      href={url ?? "#"}
      download={name}
      title="Download"
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
    >
      {name}
    </a>
  );
}
