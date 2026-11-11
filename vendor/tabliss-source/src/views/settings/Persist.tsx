import { UiButton, UiCard } from "../../ui";
import { t } from "../../locales/ui";
import React from "react";

const Persist: React.FC = () => {
  const [error, setError] = React.useState(false);
  const [persisted, setPersisted] = React.useState(true); // Hide until we know otherwise

  React.useEffect(() => {
    if (navigator.storage) navigator.storage.persisted().then(setPersisted);
  }, []);

  if (persisted) return null;

  const handleClick = () => {
    navigator.storage
      .persist()
      .then((persisted) =>
        persisted ? setPersisted(persisted) : setError(true),
      );
  };

  return (
    <UiCard className="Widget" style={{ textAlign: "center" }}>
      <h4>{t("Persist Settings")}</h4>
      <p>
        {t("Would you like Tabliss to ask your browser to save your setting permanently?")}</p>
      {error ? (
        <p>{t("Could not persist settings at this time.")}</p>
      ) : (
        <UiButton className="button button--primary" onClick={handleClick}>
          {t("Persist Settings")}</UiButton>
      )}
    </UiCard>
  );
};

export default Persist;
