# Validação da Super Extensão

Revisado em 12 de novembro de 2026, referência **1.7.13**. Esta página separa evidência automatizada de verificações ainda pendentes.

## Revisão de privacidade 1.7.13 — aprovação real pendente

A suíte completa passou **357 testes**, além de build, TypeScript do worker/interface, UI e whitespace. Foram adicionados testes de bloqueio durável/liberação por sessão, falhas/readback, cancelamento de autenticação, probe HTTPS sem credenciais, PAC obrigatório sem DNS, previsão de rede, alertas de privacidade, ícone vermelho e liberação explícita no painel.

A tentativa de execução nativa com Chromium foi bloqueada por `socket() failed: Operation not permitted`. Nenhum resultado de IP, DNS, tráfego Proton ou ausência de vazamentos é declarado. O runner isolado está em `scripts/check-vpn-native.cjs`. [Achados, correções, riscos residuais e roteiro de aprovação](auditoria-vpn.md). A extensão não substitui um kill switch/firewall do sistema operacional.

## Login e WebRTC próprios 1.7.12

A suíte completa passou **329 testes**, com 22 novos testes de login/privacidade e ampliação da validação de origens. Compilação de produção, TypeScript do worker/interface, `check:ui` e `git diff --check` passaram. Foram exercitados o núcleo e os adaptadores reais com rede/armazenamento/APIs simulados: nonce/URL do serviço, TTL, suspensão, consumo único, duplicatas, logout/novo login durante troca, dados inválidos, erros de armazenamento, confirmação pública sem segredos, escrita/restauração WebRTC ordenadas, propriedade efetiva, erros de callback e UI antiga após desconexão.

O usuário relatou funcionamento aparente da 1.7.11 e pediu uma revisão minuciosa posterior. Essa revisão continua pendente. Na 1.7.12 ainda faltam login/MFA e sessão reais, teste de IP/WebRTC com tráfego, restauração da preferência no navegador, conflito com outra extensão, encerramento/reinício e cenários de falha nativa. Esta rodada não realizou login nem mediu vazamento real. Abas de autorização iniciadas antes da atualização devem ser reabertas pela extensão.

## Catálogo e seleção próprios 1.7.11

A suíte completa passou **307 testes**: 28 novos contratos de catálogo/seleção e ampliação do contrato de recente manual. Compilação de produção, TypeScript do worker/interface, `check:ui` e `git diff --check` passaram. A suíte executa o núcleo e os adaptadores v1/v2/estado reais com rede e armazenamento simulados: cache por conta/plano, requisições concorrentes, 304, falhas transitórias, logout durante busca/escrita, descarte de respostas antigas, inserção por ID, persistência de carga, ranking estável, disponibilidade, tier, failover e restauração de uma escolha manual não automática.

O usuário confirmou funcionamento da 1.7.10 antes de autorizar esta etapa. A conexão Proton real, manutenção de um servidor manual, failover automático e reinício do navegador ainda precisam ser conferidos na 1.7.11. Não foi realizado login real nem medido IP/tráfego nesta rodada.

## Transporte HTTP próprio 1.7.10

A suíte completa passou **279 testes**, incluindo 29 contratos HTTP novos e um contrato adicional para integração com credenciais. Compilação de produção, TypeScript do worker/interface, `check:ui` e `git diff --check` passaram. Foram executados o núcleo, a fachada API e o adaptador HTTP reais com rede e armazenamento simulados; o SessionStore próprio foi exercitado no refresh concorrente. Testes cobrem prazos e cancelamento durante envio/corpo/refresh, cabeçalhos sem mutação e com token renovado, preservação de erros/builders/304/binário, upgrade, bloqueio HTML sem exposição do corpo, Retry-After entre instâncias, isolamento entre contas/métodos e ausência de repetição automática de mutações.

O usuário confirmou funcionamento da 1.7.9 antes de autorizar esta etapa. Essa confirmação é evidência manual relatada, sem logs específicos. A API Proton real e seus redirecionamentos/cabeçalhos/limites não foram acessados nesta rodada; login, troca de servidor e refresh reais precisam ser conferidos novamente na 1.7.10.

## Credenciais temporárias próprias 1.7.9

A suíte completa passou **249 testes**, incluindo 27 contratos novos de credenciais. A compilação de produção, as checagens TypeScript do worker/interface, `check:ui` e `git diff --check` passaram. Os testes exercitam o núcleo próprio e os adaptadores de protocolo/armazenamento reais com rede e APIs nativas simuladas. Cobrem concorrência, TTL e expiração JWT da resposta nova, cache legado, renovação em wake, timeout, erros transitórios, reautorização limitada, logout/troca de conta durante pedidos e gravações, armazenamento sem confirmação e isolamento entre páginas da extensão.

O usuário informou ter validado a versão 1.7.8 antes de autorizar esta etapa; não forneceu logs ou resultados separados por cenário. Esta confirmação não cobre a nova renovação 1.7.9: conta Proton real, passagem pelo prazo de renovação e suspensão/reinício nativos continuam pendentes nesta versão. Não foram usados tokens reais nem houve alteração de dados de uma conta durante a implementação.

## Indicador após troca manual de servidor 1.7.8

A suíte completa passou **222 testes**. Os dois contratos novos reproduzem o ícone perdido com a fonte 1.7.7 e passam com a correção: troca manual cujos eventos intermediários são agrupados, seleções sucessivas com mesma cor e mudança do proxy sem mudança de cor/estado. Cobrem tanto o indicador verde quanto o azul, perda de controle e preservação do badge de pausa. O cache de ações por aba agora inclui a revisão da conexão, fornecida pelo worker a partir de `connectionLifecycle.capture()`; eventos de alteração do proxy invalidam as ações aplicadas. Os pixels renderizados continuam em cache, sem recriar o desenho em cada troca.

Compilação de produção, TypeScript do worker/interface, `check:ui` e `git diff --check` passaram. As APIs e o canvas são simulados; não foi observada uma troca com conta Proton real nesta rodada.

## Limpeza Geral 1.7.7

Rótulos Geral e Arm. Local, submenu com cinco colunas e automação/pausa restritas a Geral. Os contratos existentes de navegação e idioma verificam a visibilidade do rodapé e as novas traduções. Conferência visual nativa continua limitada pelo ambiente já documentado.

## Abas e exceções de limpeza 1.7.6

A suíte completa passou **220 testes**. As novas verificações executam o popup em JSDOM e o worker com APIs simuladas: listas independentes, inclusão/remoção, importação de favoritos com destino e contagem de duplicados por lista, restauração da aba, troca de idioma sem perda de rascunhos, ações manuais visíveis somente em O que apagar, exclusão global de histórico independente das exceções, origem com porta e cancelamento antes de qualquer remoção se houver lista inválida. Snapshots manuais antigos preservam as novas listas armazenadas quando os campos forem omitidos. `build:ui`, `build:i18n`, `check:ui` e `git diff --check` passaram.

A tentativa de conferência visual no Chromium local foi bloqueada por `socket() failed: Operation not permitted`. Não houve exclusão real de dados do navegador nesta rodada. Conferir geometria e preservação real de cache/localStorage em perfil de teste permanece pendente. O escopo por origem segue [browsingData](https://developer.chrome.com/docs/extensions/reference/api/browsingData).

## Alternância de servidores 1.7.5

A suíte completa passou **214 testes**. Os sete contratos novos cobrem intervalo após troca automática (impedindo verificação imediata do próximo servidor), respostas v2 sem status, integração com os status binários já decodificados, dados ausentes, cache `_up` obsoleto, visibilidade independente da disponibilidade, IDs numéricos/textuais, falha ao buscar cargas e detecção de indisponibilidade v1. O helper de saúde e os adaptadores reais são executados com IO simulado. Compilação de produção, TypeScript do worker/interface e `check:ui` passaram. Não foi acessada uma conta Proton nem observada uma conexão real durante esta correção.

## Estado e recuperação da VPN 1.7.4

A suíte completa passou **207 testes**. Compilação de produção, checagens TypeScript do worker/interface e `check:ui` passaram. Máquina de estados extraída para `vpn/engine/state.ts`, com dependências de IO/protocolo injetadas. A suíte cobre restauração única, comandos durante a inicialização, prontidão sem esperar rede, credenciais tardias após desconexão/logout, alteração de servidor/regras, avisos de rede e retomada por wake, perda de proxy, falhas de permissão, throttling e retomada de retry adiado, verificações de saúde atrasadas, limpeza repetida após falha e persistência ordenada. Os contratos do adaptador executam a nova máquina real com transporte simulado. Não foi acessada uma conta Proton nem validado tráfego/IP real; esse limite permanece.

## Abertura da VPN 1.7.2

A suíte completa passou **183 testes**. Os seis novos contratos cobrem a primeira renderização conectada com carregamento de rede pendente, estados realmente conectando/desconectados, logout durante a leitura inicial, ausência de segredos no resumo público e inicialização do painel antes da barreira de primeiro frame. O shell pré-consulta o worker e acompanha eventos durante o carregamento dos scripts; uma resposta inicial antiga não sobrepõe desconexão/logout. O adaptador não deduz conexão em andamento da mera presença de servidor salvo.

A mensagem `connectionState` entrega somente resumo público do servidor, estado e erro de apresentação; confirma o proxy no navegador e não busca plano ou lista de servidores. Conta e servidores podem continuar carregando sem trocar o cartão conectado por um spinner. Abrir o painel não envia comando `connect`. O estado não é persistido como uma tela conectada para a próxima abertura. Quando o worker ainda está restaurando uma conexão, ela continua sendo apresentada como conectando.

Compilação de produção, checagens TypeScript e `check:ui` passaram. A evidência desta rodada usa APIs simuladas/JSDOM; não foi medida a primeira pintura de um popup nativo com conta Proton. A limitação de inicialização nativa registrada na rodada 1.7.1 permanece.

## Indicador VPN 1.7.1

A suíte completa passou **177 testes**; os seis testes do indicador passaram, incluindo três cenários novos de navegação/recarga sem mudança de cor, ativação/substituição de aba e eventos em sequência. O teste remove o estado de action do navegador simulado antes do evento de conclusão, inclusive quando a URL não muda. Os testes novos reproduzem a perda do ícone com a fonte 1.7.0 e passam com a correção. Perder o controle do proxy agora restaura ícone/título normais, em vez de exibir azul com a mensagem de VPN ativa.

O cache `applied` era mantido apenas por aba/cor/idioma. O Chromium limpa valores de action da aba ao navegar entre documentos ([código do navegador](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/extension_action_runner.cc)); o cache passa a ser invalidado em mudanças de URL, início/conclusão da carga, ativação e substituição da aba. Eventos pendentes têm revisão própria para descartar trabalho ultrapassado. O badge de pausa não é modificado.

A tentativa de validar uma extensão isolada no Chromium 156 desta rodada foi bloqueada na inicialização por `socket() failed: Operation not permitted`. Portanto, a evidência nova é automatizada com APIs simuladas e inspeção da implementação do Chromium; não comprova login/tráfego real nem uma execução nativa desta versão. `check:ui`, consistência de versões e `git diff --check` passaram.

## Motor VPN 1.7.0

A suíte completa passou **174 testes**, incluindo 20 novos contratos da VPN. A compilação de produção, as checagens TypeScript do worker/interface e `check:ui` passaram. Os novos contratos exercitam o controlador próprio, gerações, recuperação por alarmes e persistência/rotação de tokens. Incluem cancelamento enquanto credenciais ou `settings.set` estão pendentes, troca rápida de servidor, erro de `set/get/clear`, perda de controle, rollback, notificações somente após confirmação, desafios de host/porta incorretos e refresh/fork concluídos após logout. Há testes que executam o `state.ts` e o interceptor reais com portas simuladas. Não foi acessada uma conta Proton nem medido tráfego/IP nesta rodada. O restante da máquina de estados e do transporte continua no adaptador.

## Alinhamento e opacidade 1.6.11

Após recompilar a nova guia, os controles foram medidos no Helium com perfil temporário, em viewports de 1280, 520 e 320 px. Ambos ficaram a 12 px do topo, com 46 px de altura e borda inferior em 58 px. A barra esquerda ficou em 50% de opacidade em repouso e em 100% com hover e foco de teclado. Não houve exceção de página nos estados verificados. `check:ui` e a conferência de consistência das quatro versões passaram. Esta rodada de CSS usou a verificação direcionada no navegador, sem repetir a suíte completa.

## Barra de controles 1.6.10

Conferida no Helium com perfil temporário nos temas claro e escuro. A barra acompanha a superfície do tema, tem raio de 12 px e botões de 36 × 36 px com nomes acessíveis. Foram exercitados a abertura de configurações por Enter, fechamento por Escape, alternância dos widgets e entrada/saída de tela cheia. Não houve exceções de página nos cenários verificados. Os 17 testes existentes de imagens da nova guia e componentes visuais passaram.

## Ajustes visuais 1.6.9

Os 17 testes de imagens da nova guia e componentes visuais passaram. A nova guia foi recompilada e conferida no Helium com perfil temporário. Em larguras de 520 e 320 px, os campos de idioma e fuso horário ficaram separados por 12 px sem estouro horizontal. O botão nativo de arquivos reservou 12 px até o texto do arquivo. O editor do Unsplash não exibe mais o controle de pausa; o componente de créditos da página inicial permanece inalterado. Não foram usadas contas ou credenciais pessoais.

## Evidência disponível

A suíte da versão 1.6.8 passou **154 testes** com `npm test`. Além da cobertura anterior dos motores, preferências e interfaces, foram adicionados contratos dos componentes HTML/DOM, Vue e React, semântica de formulário, modelos, referências, conteúdo seguro e correspondência dos artefatos estáticos com suas fontes. O teste de exportação de logs agora aceita as quebras de linha nativas do Windows e do Linux. Nenhuma conta real foi acessada durante os testes.

| Área | Cobertura automatizada | Limite da evidência |
| --- | --- | --- |
| Limpeza e abas | Exceções, importação de domínios, falhas, pausa, recuperação e transições de abas com APIs simuladas | Não comprova encerramento nativo nem tempo de conclusão antes de o navegador fechar |
| Sincronização atual | Bundle da interface em JSDOM, perfis, rascunhos, backup de perfis, assistente e bloqueio | Não comprova autenticação e sincronização com contas reais |
| Núcleo próprio Drive | Reconciliação, escrita condicional, bloqueios, aplicação local, criptografia, migração de IDs, dois dispositivos e injeção de falhas nos checkpoints | Transporte, armazenamento e favoritos são simulados; ainda não comprova o serviço real |
| VPN | Interface/adaptador, isolamento, limites de plano, regras, estados e indicador por aba | Não comprova túnel, IP, WebRTC ou recuperação no serviço real |
| Interface compartilhada | Contratos HTML/DOM/Vue/React, comparação de estilos e temas, artefatos estáticos e testes de idioma/navegação | JSDOM não mede geometria; a conferência real abaixo cobre somente os estados descritos |

A ponte VPN também passou novamente pela checagem TypeScript na rodada 1.6.8. Para repeti-la, use o compilador das dependências Proton com `--noEmit -p vpn/tsconfig.interface.json`.

Em rodadas anteriores, o Chromium não iniciou por `socket() failed: Operation not permitted`. Na 1.6.8, foi possível executar o Helium em modo headless com um perfil temporário, separado do perfil pessoal. Foram carregados os bundles reais da extensão e conferidos os estados abaixo, sem login Google/Proton nem credenciais pessoais.

| Estado medido no Helium | Resultado |
| --- | --- |
| Abertura nativa por `chrome.action.openPopup()` | Popup de 520 px, conteúdo de 520 px, controles compartilhados disponíveis após o carregamento |
| Perfis de sincronização e VPN sem login | Painéis de 480 px sem estouro horizontal |
| Novo perfil de sincronização | Seleção de serviços abriu e permitiu navegação interna |
| Conexões OAuth | Campos com 6 px entre texto do rótulo e input; navegação interna preservada |
| Chave GIPHY na nova guia, viewports de 520 e 320 px | 6 px entre rótulo e campo, 12 px até a descrição e entre botão e link; sem estouro horizontal no bloco |

Não houve exceção de página não tratada nos cenários medidos. As capturas locais foram inspecionadas durante a implementação. O teste do popup nativo usou janela de 1280 px; o popup mantém largura mínima de 520 px, portanto janelas menores que essa largura não estão cobertas por esse resultado. Não foram medidos todos os widgets, diálogos, temas, estados conectados ou tempos de rede. Os registros históricos de Edge nas versões 1.3/1.4 também não certificam os cenários restantes.

## Evidência relatada pelo usuário

Em **11 de novembro de 2026**, após a publicação da **1.6.2**, o usuário confirmou “Deu certo agora” no fluxo de sincronização Google Drive que havia retornado erro. O cenário em discussão era um perfil com a raiz geral do navegador. Essa é uma confirmação de uso real relatada pelo usuário, separada dos testes automatizados. Navegador/versão, sistema operacional e quantidade de favoritos não foram informados nesse teste. Não comprova os cenários de dois dispositivos, falhas, criptografia, retomada ou ausência de duplicações por inspeção detalhada; eles permanecem no checklist.

## Reproduzir a suíte

Node.js 20 ou superior, na raiz:

```sh
npm ci
npm run setup:vpn
npm run setup:newtab
npm run setup:sync
npm test
npm run check:ui
```

A instalação das dependências Proton é necessária ao teste CSS que usa PostCSS. As dependências Tabliss são necessárias aos testes React das imagens da Nova guia; as dependências Floccus são necessárias aos contratos Vue. Para reconstruir a sincronização, execute também `npm run setup:sync`, seguido de `npm run build:sync-engine` (worker) e `npm run build:sync` (interface).

Ao alterar o motor Proton, execute `npm run build:vpn`. Para alterar somente sua interface, use `npm run build:vpn-ui`. Esses comandos exigem `setup:vpn`. Recompilações da Sincronização usam `setup:sync` e `setup:vpn`, pois também geram os estilos dos painéis.

## Checklist manual

Use perfis de teste e favoritos fictícios. Registre a versão instalada e o resultado; os passos abaixo são verificações pendentes, não operações já executadas.

### Layout e preferências

- [ ] Abrir todas as abas, assistentes e diálogos nos temas claro, escuro e sistema e em PT-BR/inglês.
- [ ] Conferir aba de reserva e configurações da Nova guia com tema explícito diferente do sistema e após mudança do sistema.
- [ ] Rolar com mouse/teclado e ajustar a altura do popup ao mínimo e máximo.
- [ ] Confirmar cabeçalho/submenus fixos, ausência de rolagem horizontal e acesso aos últimos controles.
- [ ] Focar buscas, campos e países pela tecla Tab; conferir o contorno inteiro.
- [ ] Expandir/recolher países da VPN, incluindo nomes longos; conferir as setas dos dois estados.
- [ ] Fechar/reabrir o popup e verificar seção, página da VPN e rolagem preservadas.

### Google Drive

- [ ] Configurar OAuth para o endereço mostrado em Conexões e autorizar um perfil de teste.
- [ ] Sincronizar pelo botão normal e conferir migração de IDs sem duplicações.
- [ ] Criar, editar, mover, reordenar e remover alguns itens nos dois lados, usando duas instalações de teste.
- [ ] Conferir conflito no mesmo campo e uso deliberado de Enviar/Receber uma vez.
- [ ] Conferir a proteção para exclusão total/grande antes de qualquer alteração.
- [ ] Validar arquivo ausente, nomes duplicados, autorização revogada, bloqueio de outro dispositivo e revisão rejeitada.
- [ ] Conferir o conteúdo criptografado após sincronizar um perfil com senha.
- [ ] Fechar o popup durante a execução e depois interromper o worker; conferir retomada sem criar cópias repetidas.
- [ ] Inspecionar backup, diário e logs sem publicar favoritos pessoais ou credenciais.
- [ ] Confirmar que outros provedores e perfis de abas continuam no legado.

### VPN

- [ ] Autorizar uma conta de teste, conectar e conferir o IP por um serviço externo escolhido para o teste.
- [ ] Testar os modos excluir e incluir, com domínio exato e subdomínios.
- [ ] Confirmar verde para endereço roteado e azul para endereço fora do túnel; navegar e trocar de aba.
- [ ] Conferir páginas internas, rede local e modo anônimo autorizado.
- [ ] Desconectar e verificar retorno do ícone original, preservando a pausa da limpeza.
- [ ] Testar perda de rede, reinício e tomada do proxy por outra extensão/política.
- [ ] Conferir as regras/PAC próprios da 1.6.5 no tráfego real: inclusão/exclusão, subdomínios, redes locais e API de login.

### Limpeza, abas e Nova guia

- [ ] Fechar a última janela pelo X e verificar o relatório na próxima abertura.
- [ ] Interromper uma limpeza de teste e conferir a recuperação posterior.
- [ ] Conferir cookies protegidos e escopo da limpeza com dados fictícios.
- [ ] Conferir várias janelas e as reservas criadas pela extensão.
- [ ] Exportar/importar configurações da Nova guia e selecionar novamente imagens próprias.
- [ ] Salvar chaves válidas de Unsplash/GIPHY nas opções do fundo e conferir imagens, créditos, limites e repetição após falhas reais.

## Registro de novas evidências

Para cada rodada manual, registre: data, versão/commit, navegador/versão, sistema, cenário, dados fictícios usados e resultado observado. Não inclua senhas, tokens, arquivos de perfis com credenciais ou favoritos pessoais em logs e capturas publicados.

As próximas entregas e os critérios para substituir os motores estão em [PROXIMOS-PASSOS.md](../PROXIMOS-PASSOS.md).
