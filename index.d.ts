export interface ProcessInfo {
  pid: number;
  name?: string;
  bundleIdentifier?: string; // macOS only
}

export interface Selection {
  text: string;
  process?: ProcessInfo;
}

export function checkAccessibilityPermissions(prompt?: boolean): Promise<boolean>;
export function getSelection(): Promise<Selection>;
