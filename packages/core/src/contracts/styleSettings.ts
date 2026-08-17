/**
 * styleSettings.ts — Contract types for the StyleSettingsManifest system.
 *
 * Additive only (I-9). Every control writes a CSS custom property token;
 * it never writes raw hex values or bypasses the three-tier token scheme (F-1).
 */

export type StyleControlKind =
  | "color"
  | "number"
  | "range"
  | "select"
  | "toggle"
  | "text";

export interface StyleControlBase {
  /** Unique ID within the manifest */
  id: string;
  kind: StyleControlKind;
  title: string;
  description?: string;
  /**
   * CSS custom property to write, e.g. `--color-accent`.
   * Must be a token declared in the three-tier scheme (F-1); never a raw rule.
   */
  cssVariable: string;
  /** Default value as a string; runtime-typed by `kind` */
  default: string;
}

export interface ColorControl extends StyleControlBase {
  kind: "color";
}

export interface NumberControl extends StyleControlBase {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
  /** CSS unit appended to the stored number, e.g. "px" or "rem" */
  unit?: string;
}

export interface RangeControl extends StyleControlBase {
  kind: "range";
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export interface SelectControl extends StyleControlBase {
  kind: "select";
  options: Array<{ value: string; label: string }>;
}

export interface ToggleControl extends StyleControlBase {
  kind: "toggle";
  /** CSS value written when the toggle is on */
  onValue: string;
  /** CSS value written when the toggle is off */
  offValue: string;
}

export interface TextControl extends StyleControlBase {
  kind: "text";
}

export type StyleControl =
  | ColorControl
  | NumberControl
  | RangeControl
  | SelectControl
  | ToggleControl
  | TextControl;

export interface StyleSettingsSection {
  title: string;
  controls: StyleControl[];
}

export interface StyleSettingsManifest {
  /** Theme name, matching the theme's `name` field */
  theme: string;
  version: number;
  sections: StyleSettingsSection[];
}

/** Runtime store: maps cssVariable → current value string */
export type StyleSettingsValues = Record<string, string>;
