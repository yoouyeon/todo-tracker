/**
 * `obsidian` 패키지는 타입만 있고 실행되는 코드가 없다.
 * 화면 테스트에서는 이 대체 모듈을 쓰고, 화면이 쓰는 것만 둔다.
 */
export function setIcon(): void {}

export const Platform = { isMobile: false };

/** 설정 화면은 테스트하지 않지만, 설정 읽기 함수가 같은 파일에 있어 불러올 수 있게만 둔다. */
export class PluginSettingTab {}
