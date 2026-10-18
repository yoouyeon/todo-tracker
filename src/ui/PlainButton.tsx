import type { ReactNode } from "react";
import { cx } from "./cx";

interface Props {
  className?: string;
  onClick: () => void;
  /** 펼침 상태를 가진 버튼일 때만 넘긴다. */
  expanded?: boolean;
  children: ReactNode;
}

/**
 * 글자처럼 보여야 하는 클릭 요소. 테마가 `button`마다 입히는 테두리·그림자·굵기를 받지 않도록
 * `<button>` 대신 일반 요소를 쓰고, 키보드(Enter, Space)와 포커스는 직접 처리한다.
 */
export function PlainButton({ className, onClick, expanded, children }: Props) {
  return (
    <span
      role="button"
      tabIndex={0}
      className={cx("tt-plain", className)}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </span>
  );
}
