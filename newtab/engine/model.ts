/* SPDX-License-Identifier: GPL-3.0-only */
export const positions = [
  "topLeft",
  "topCentre",
  "topRight",
  "middleLeft",
  "middleCentre",
  "middleRight",
  "bottomLeft",
  "bottomCentre",
  "bottomRight",
] as const;
export type WidgetPosition = (typeof positions)[number];
export interface BackgroundDisplay {
  blur?: number;
  luminosity?: number;
}
export interface BackgroundState {
  id: string;
  key: string;
  display: BackgroundDisplay;
}
export interface WidgetDisplay {
  colour?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  position: WidgetPosition;
}
export interface WidgetState {
  id: string;
  key: string;
  order: number;
  display: WidgetDisplay;
}
export interface State {
  background: BackgroundState;
  [key: `widget/${string}`]: WidgetState | null;
  [key: `data/${string}`]: unknown;
  focus: boolean;
  locale: string;
  timeZone: string | null;
}
export function defaults(locale: string): State {
  return {
    background: {
      id: "default-gradient",
      key: "background/gradient",
      display: { luminosity: -0.2, blur: 0 },
    },
    "widget/default-time": {
      id: "default-time",
      key: "widget/time",
      order: 0,
      display: { position: "middleCentre" },
    },
    "widget/default-greeting": {
      id: "default-greeting",
      key: "widget/greeting",
      order: 1,
      display: { position: "middleCentre" },
    },
    focus: false,
    locale,
    timeZone: null,
  };
}
