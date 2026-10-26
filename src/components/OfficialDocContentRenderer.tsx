/* eslint-disable @next/next/no-img-element */

import type { OfficialDocContentBlock } from "@/lib/official-docs";

type Props = {
  blocks: OfficialDocContentBlock[];
  emptyText?: string;
  className?: string;
  textClassName?: string;
  imageBlockClassName?: string;
  imageClassName?: string;
  captionClassName?: string;
  linkClassName?: string;
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

function renderLinkedText(text: string, linkClassName?: string) {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className={linkClassName}>
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function OfficialDocContentRenderer({
  blocks,
  emptyText,
  className,
  textClassName,
  imageBlockClassName,
  imageClassName,
  captionClassName,
  linkClassName,
}: Props) {
  if (!blocks.length) {
    return <div className={className}>{emptyText || "Chưa có nội dung."}</div>;
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "image") {
          return (
            <figure key={`${block.url}-${index}`} className={imageBlockClassName}>
              <img src={block.url} alt={`doc-inline-${index + 1}`} className={imageClassName} loading="lazy" />
              <figcaption className={captionClassName}>{block.url}</figcaption>
            </figure>
          );
        }

        return (
          <p key={`text-${index}`} className={textClassName}>
            {renderLinkedText(block.content, linkClassName)}
          </p>
        );
      })}
    </div>
  );
}
