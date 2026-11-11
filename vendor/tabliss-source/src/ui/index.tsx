import React from "react";
import catalog from "../../../../ui/catalog.json";

// React adapter for the same catalog used by the popup, Vue and native VPN.
type Kind = keyof typeof catalog;
type Spec = { tag: string; class: string; attrs?: Record<string, string>; tags?: string[] };
function component<P extends React.HTMLAttributes<HTMLElement>>(kind: Kind, defaultTag?: string) {
  const spec: Spec = catalog[kind];
  const Component = ({ as, className, children, ...props }: P & { as?: string }) => {
    const tag = as || defaultTag || spec.tag;
    if (!(spec.tags || [spec.tag]).includes(tag)) throw new Error(`Invalid tag for ${kind}: ${tag}`);
    const defaults = { ...spec.attrs };
    if (tag !== "button") delete defaults.type;
    const inputType = (props as React.InputHTMLAttributes<HTMLInputElement>).type;
    const controlClass = kind === "control" && tag === "input" && ["checkbox", "radio", "range", "color", "file"].includes(inputType || "")
      ? "ui-" + inputType : spec.class;
    return React.createElement(tag, { ...defaults, ...props, className: [controlClass, className].filter(Boolean).join(" ") }, children);
  };
  Component.displayName = "Ui" + kind[0].toUpperCase() + kind.slice(1);
  return Component;
}

export const UiButton = component<React.ButtonHTMLAttributes<HTMLButtonElement>>("button");
export const UiCard = component<React.FieldsetHTMLAttributes<HTMLFieldSetElement>>("card");
export const UiField = component<React.LabelHTMLAttributes<HTMLLabelElement>>("field");
export const UiCheck = component<React.LabelHTMLAttributes<HTMLLabelElement>>("check");
export const UiInput = component<React.InputHTMLAttributes<HTMLInputElement>>("control");
export const UiSelect = component<React.SelectHTMLAttributes<HTMLSelectElement>>("control", "select");
export const UiTextarea = component<React.TextareaHTMLAttributes<HTMLTextAreaElement>>("control", "textarea");
export const UiActions = component<React.HTMLAttributes<HTMLDivElement>>("actions");
export const UiStack = component<React.HTMLAttributes<HTMLDivElement>>("stack");
export const UiNote = component<React.HTMLAttributes<HTMLParagraphElement>>("note");
export const UiNotice = component<React.HTMLAttributes<HTMLParagraphElement>>("notice");
export const UiTitle = component<React.HTMLAttributes<HTMLHeadingElement>>("title");
