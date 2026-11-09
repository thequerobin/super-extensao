// Super Extensão: project branding, updated 2026-11-09.
import React from "react";
import "./Logo.css";
import { t } from "../../locales/ui";

const Logo: React.FC = () => (
  <h1 className="Logo super-brand">
    <img src="../icons/icon48.png" alt="" width={40} height={40} />
    <div><strong>Super Extensão</strong><span>{t("Your new tab, your way.")}</span></div>
  </h1>
);

export default Logo;
