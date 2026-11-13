(function () {
  "use strict";
  let currentHost = "";
  let currentAutoplay = SuperTools.autoplaySettings();
  async function changeAutoplay(update) {
    await serializeMutation(async () => {
      const {autoplay} = await chrome.storage.local.get({autoplay:SuperTools.AUTOPLAY_DEFAULTS});
      const next = SuperTools.autoplaySettings(autoplay);
      update(next);
      await chrome.storage.local.set({autoplay:SuperTools.autoplaySettings(next)});
    });
    await renderAutoplay();
  }
  async function renderAutoplay() {
    const {autoplay} = await chrome.storage.local.get({autoplay:SuperTools.AUTOPLAY_DEFAULTS});
    currentAutoplay = SuperTools.autoplaySettings(autoplay);
    $("autoplayEnabled").checked = currentAutoplay.enabled;
    $("autoplayDefault").value = currentAutoplay.globalBehavior;
    $("currentAutoplayRule").value = currentAutoplay.siteSettings[currentHost] || "default";
    $("currentAutoplayRule").disabled = !currentHost;
    if (currentHost) {
      const policy = SuperTools.autoplayPolicy(currentHost,currentAutoplay);
      $("currentAutoplayEffective").textContent = !currentAutoplay.enabled ? SuperI18n.text("Controle desativado.") : SuperI18n.t(policy.matched?"uiAutoplayMatched":"uiAutoplayGlobal",{action:SuperI18n.text(policy.block?"Bloqueando":"Permitindo"),domain:policy.matched});
    }
    const filter = $("autoplaySearch").value.trim().toLowerCase();
    const entries = Object.entries(currentAutoplay.siteSettings).filter(([domain]) => domain.includes(filter)).sort(([a],[b]) => a.localeCompare(b));
    SuperDomainList.renderDomainList($("autoplayRules"), entries.map(([domain, permission]) => ({
      domain, value: permission, choices: [
        {value: "allow", label: SuperI18n.text("Permitir")}, {value: "block", label: SuperI18n.text("Bloquear")},
      ],
    })), {
      removeLabel: domain => SuperI18n.t("uiRemoveRule", {domain}),
      choiceLabel: domain => SuperI18n.t("uiAutoplayLabel", {domain}),
      onChoice: handle((domain, value) => changeAutoplay(next => {next.siteSettings[domain] = value;})),
      onRemove: handle(domain => changeAutoplay(next => {delete next.siteSettings[domain];})),
    });
    $("autoplayEmpty").hidden=entries.length>0;
    $("autoplayEmpty").textContent=filter?SuperI18n.text("Nenhuma regra corresponde à busca."):SuperI18n.text("Nenhuma regra por site.");
  }
  async function renderTabs() {
    const {tabGuard}=await chrome.storage.local.get({tabGuard:SuperTools.TAB_DEFAULTS});
    const settings=SuperTools.tabSettings(tabGuard);
    $("tabGuardEnabled").checked=settings.enabled;
    $("tabGuardScope").value=settings.scope;
    $("singleNewTab").checked=settings.singleNewTab;
    $("newTabLast").checked=settings.newTabLast;
    $("newTabLast").disabled=!settings.singleNewTab;
  }
  async function initTools() {
    await SuperI18n.ready;
    SuperI18n.watch(()=>{ $("currentAutoplayHost").textContent=currentHost||SuperI18n.text("Abra um site HTTP/HTTPS para ajustar sua regra");renderAutoplay().catch(showError); });
    try {
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if (tab?.url && /^https?:\/\//u.test(tab.url)) currentHost=new URL(tab.url).hostname;
    } catch {}
    $("currentAutoplayHost").textContent=currentHost || SuperI18n.text("Abra um site HTTP/HTTPS para ajustar sua regra");
    await renderAutoplay();await renderTabs();
    $("autoplayEnabled").addEventListener("change",handle(() => changeAutoplay(next => {next.enabled=$("autoplayEnabled").checked;})));
    $("autoplayDefault").addEventListener("change",handle(() => changeAutoplay(next => {next.globalBehavior=$("autoplayDefault").value;})));
    $("currentAutoplayRule").addEventListener("change",handle(async () => {
      if (!currentHost) return;
      const permission=$("currentAutoplayRule").value;
      await changeAutoplay(next => {if(permission==="default") delete next.siteSettings[currentHost]; else next.siteSettings[currentHost]=permission;});
      notify(SuperI18n.text("Regra do site salva."));
    }));
    $("autoplayForm").addEventListener("submit",event => {
      event.preventDefault();handle(async () => {
        const domain=SuperTools.normalizeHostname($("autoplayDomain").value);
        const permission=$("autoplayPermission").value;
        await changeAutoplay(next => {next.siteSettings[domain]=permission;});
        $("autoplayDomain").value="";notify(SuperI18n.text("Regra de autoplay salva."));
      })();
    });
    $("autoplaySearch").addEventListener("input",handle(renderAutoplay));
    $("exportAutoplay").addEventListener("click",() => {
      const json=JSON.stringify({siteSettings:currentAutoplay.siteSettings,globalBehavior:currentAutoplay.globalBehavior},null,2);
      const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;a.download="super-extensao-autoplay.json";a.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      notify(SuperI18n.text("Regras de autoplay exportadas."));
    });
    $("chooseAutoplayImport").addEventListener("click",() => $("autoplayImportFile").click());
    $("autoplayImportFile").addEventListener("change",handle(async () => {
      const file=$("autoplayImportFile").files[0];if(!file)return;
      try {
        if(file.size>1024*1024) throw new Error(SuperI18n.text("O arquivo de regras deve ter até 1 MB."));
        const data=JSON.parse(await file.text());
        const raw=Array.isArray(data)?Object.fromEntries(data.map(domain=>[domain,"allow"])):data?.siteSettings;
        if(!raw || typeof raw!=="object" || Array.isArray(raw))throw new Error(SuperI18n.text("Arquivo de regras inválido."));
        const parsed=SuperTools.autoplaySettings({siteSettings:raw});
        const count=Object.keys(parsed.siteSettings).length;
        if(!count)throw new Error(SuperI18n.text("Nenhuma regra válida encontrada no arquivo."));
        await changeAutoplay(next=>{next.siteSettings={...next.siteSettings,...parsed.siteSettings};});
        notifyMessage("uiRulesImported",{count});
      } finally {$("autoplayImportFile").value="";}
    }));
    for(const id of ["tabGuardEnabled","tabGuardScope","singleNewTab","newTabLast"]) $(id).addEventListener("change",handle(async()=>{
      const next=SuperTools.tabSettings({enabled:$("tabGuardEnabled").checked,scope:$("tabGuardScope").value,singleNewTab:$("singleNewTab").checked,newTabLast:$("newTabLast").checked});
      await serializeMutation(()=>chrome.storage.local.set({tabGuard:next}));await renderTabs();notify(SuperI18n.text("Preferências de abas salvas."));
    }));
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=="local")return;
      if(changes.autoplay)renderAutoplay().catch(showError);
      if(changes.tabGuard)renderTabs().catch(showError);
    });
  }
  initTools().catch(showError);
})();
