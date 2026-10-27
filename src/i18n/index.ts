import i18next from "i18next";
import en from "./en.json";
import ko from "./ko.json";

/**
 * 화면에 보이는 문구. 언어별 문구는 같은 폴더의 `<언어>.json`에 있고, 키와 값의 모양은 `ko.json`이 기준이다.
 * 언어는 Obsidian 언어 설정을 따르고, 문구가 없는 언어는 영어로 보여 준다.
 */
const resources = { ko: { translation: ko }, en: { translation: en } } as const;

declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["ko"];
  }
}

// 문구를 쓰는 모듈이 불러오는 순간부터 쓸 수 있게 리소스를 동기로 읽는다. 플러그인을 켤 때 언어를 다시 고른다.
void i18next.init({
  lng: "ko",
  fallbackLng: "en",
  resources,
  initAsync: false,
  // React가 이스케이프하므로 i18next는 하지 않는다. 문구는 텍스트로만 넣는다.
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const t = i18next.t.bind(i18next);

/** 지금 문구의 언어. 날짜 형식에 쓴다. */
export const uiLanguage = (): string => i18next.language;

/** Obsidian 언어 코드(`getLanguage()`)를 받아 문구 언어를 고른다. */
export function setUiLanguage(language: string): void {
  void i18next.changeLanguage(language in resources ? language : "en");
}
