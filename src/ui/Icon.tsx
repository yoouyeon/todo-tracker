import { setIcon } from "obsidian";
import { useEffect, useRef } from "react";

/** 옵시디언 기본 아이콘. 이름은 옵시디언이 쓰는 lucide 아이콘 이름이다. */
export function Icon({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) setIcon(ref.current, name);
  }, [name]);
  return <span ref={ref} className="tt-icon" aria-hidden="true" />;
}
