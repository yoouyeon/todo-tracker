import { isLedgerPath, normalizeFolder } from "./paths";
import { parseLedger } from "./parseLedger";
import type { ParsedLedger } from "./types";

/** 저장소가 vault에서 필요한 것만 담은 얇은 경계. 테스트에서는 가짜로 바꾼다. */
export interface LedgerFile {
  path: string;
}

export interface LedgerVault {
  listMarkdownFiles(): LedgerFile[];
  read(file: LedgerFile): Promise<string>;
}

export interface LedgerSnapshot {
  /** 처음 훑기가 끝났는지 */
  loaded: boolean;
  folder: string;
  /** 경로 순서. 내용이 바뀔 때마다 새 배열이 된다. */
  ledgers: ParsedLedger[];
}

export interface LedgerSource {
  subscribe(listener: () => void): () => void;
  getSnapshot(): LedgerSnapshot;
}

/**
 * 설정 폴더의 월 장부를 읽어 파싱 결과를 들고 있다가, 파일이 바뀌면 그 파일만 다시 읽는다.
 * 화면은 `useSyncExternalStore`로 `subscribe`/`getSnapshot`을 구독한다.
 */
export class TaskStore implements LedgerSource {
  private readonly ledgers = new Map<string, ParsedLedger>();
  private readonly readVersions = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private scanVersion = 0;
  private snapshot: LedgerSnapshot;

  constructor(
    private readonly vault: LedgerVault,
    private readonly getFolder: () => string,
  ) {
    this.snapshot = { loaded: false, folder: normalizeFolder(getFolder()), ledgers: [] };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): LedgerSnapshot => this.snapshot;

  /** 설정 폴더의 모든 월 장부를 다시 읽는다. 시작할 때와 폴더 설정이 바뀔 때 쓴다. */
  async scan(): Promise<void> {
    const version = ++this.scanVersion;
    const folder = this.getFolder();
    const files = this.vault.listMarkdownFiles().filter((file) => isLedgerPath(file.path, folder));
    const parsed = await Promise.all(files.map((file) => this.readAndParse(file)));
    // 훑는 동안 폴더 설정이 또 바뀌었으면 마지막 훑기만 반영한다.
    if (version !== this.scanVersion) return;
    this.ledgers.clear();
    for (const ledger of parsed) if (ledger) this.ledgers.set(ledger.path, ledger);
    this.publish(true);
  }

  /** 파일이 만들어지거나 수정되었을 때. 월 장부가 아니면 무시한다. */
  async refresh(file: LedgerFile): Promise<void> {
    if (!isLedgerPath(file.path, this.getFolder())) return;
    const version = this.bumpReadVersion(file.path);
    const ledger = await this.readAndParse(file);
    // 읽는 동안 같은 파일이 또 바뀌었거나 지워졌으면 이 결과는 버린다.
    if (this.readVersions.get(file.path) !== version) return;
    if (ledger) this.ledgers.set(file.path, ledger);
    else this.ledgers.delete(file.path);
    this.publish();
  }

  remove(path: string): void {
    this.bumpReadVersion(path);
    if (this.ledgers.delete(path)) this.publish();
  }

  async rename(file: LedgerFile, oldPath: string): Promise<void> {
    this.remove(oldPath);
    await this.refresh(file);
  }

  private bumpReadVersion(path: string): number {
    const version = (this.readVersions.get(path) ?? 0) + 1;
    this.readVersions.set(path, version);
    return version;
  }

  /** 읽기에 실패하면(그 사이 지워진 경우 등) null */
  private async readAndParse(file: LedgerFile): Promise<ParsedLedger | null> {
    try {
      return parseLedger(file.path, await this.vault.read(file));
    } catch {
      return null;
    }
  }

  private publish(loaded = false): void {
    this.snapshot = {
      loaded: this.snapshot.loaded || loaded,
      folder: normalizeFolder(this.getFolder()),
      ledgers: [...this.ledgers.values()].sort((a, b) => a.path.localeCompare(b.path)),
    };
    for (const listener of [...this.listeners]) listener();
  }
}
