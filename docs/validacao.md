# Validação da Super Extensão

Revisado em 11 de novembro de 2026, referência **1.6.10**. Esta página separa evidência automatizada de verificações ainda pendentes.

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
npm test
npm run check:ui
```

A instalação das dependências Proton é necessária ao teste CSS que usa PostCSS. As dependências Tabliss são necessárias aos testes React das imagens da Nova guia. Para reconstruir a sincronização, execute também `npm run setup:sync`, seguido de `npm run build:sync-engine` (worker) e `npm run build:sync` (interface).

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
