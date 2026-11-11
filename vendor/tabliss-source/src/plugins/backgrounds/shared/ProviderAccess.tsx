import { UiButton, UiField, UiInput, UiStack, UiNote, UiActions, UiNotice } from "../../../ui";
import React from "react";
import { t } from "../../../locales/ui";
import { Provider, storedKey, saveProviderKey, watchProviderKeys, errorMessage } from "./provider";
export function useProviderRevision(): number {
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => watchProviderKeys(() => setRevision(value => value + 1)), []);
  return revision;
}
export function ProviderAccess({ provider }: { provider: Provider }) {
  const [key, setKey] = React.useState(""), [status, setStatus] = React.useState(""), [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    storedKey(provider).then(value => { if (active) setKey(value); }).catch(error => { if (active) setStatus(errorMessage(error)); });
    return () => { active = false; };
  }, [provider]);
  return <UiStack className="provider-access">
    <UiField>{provider === "unsplash" ? t("Unsplash Access Key") : t("GIPHY API key")}
      <UiInput type="password" autoComplete="off" value={key} onChange={event => { setKey(event.target.value); setStatus(""); }} />
    </UiField>
    <UiNote className="info">{t("Saved only on this device; not included in exported settings.")}</UiNote>
    <UiActions>
    <UiButton disabled={saving} onClick={async () => {
      setSaving(true);
      try { await saveProviderKey(provider, key); setStatus(t("Saved. The background will retry automatically.")); }
      catch (error) { setStatus(errorMessage(error)); }
      finally { setSaving(false); }
    }}>{t("Save API key")}</UiButton>
    <a href={provider === "unsplash" ? "https://unsplash.com/documentation" : "https://developers.giphy.com/docs/api/"} target="_blank" rel="noopener noreferrer">{t("How to get an API key")}</a>
    </UiActions>
    <p role="status" className="ui-inline-status" hidden={!status}>{status}</p>
  </UiStack>;
}
export function ProviderStatus({ error, retry }: { error: unknown; retry: () => void }) {
  if (!error) return null;
  return <UiNotice as="div" className="background-provider-status">
    <p>{errorMessage(error)}</p>
    <UiButton className="ui-button-compact" onClick={retry}>{t("Try again")}</UiButton>
  </UiNotice>;
}
