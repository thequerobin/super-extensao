# Validação da Super Extensão

Revisado em 11 de novembro de 2026, referência **1.6.1**. Esta página separa evidência automatizada de verificações ainda pendentes.

## Evidência disponível

A última execução registrada durante a implementação da versão 1.6.1 passou **114 testes** da suíte `npm test`. Essa execução inclui o novo worker, a interface sem o painel de comparação e a sincronização da raiz com pastas permanentes protegidas, migração do cache anterior e retomada após interrupção. Nenhuma conta real foi acessada durante o teste.

| Área | Cobertura automatizada | Limite da evidência |
| --- | --- | --- |
| Limpeza e abas | Exceções, importação de domínios, falhas, pausa, recuperação e transições de abas com APIs simuladas | Não comprova encerramento nativo nem tempo de conclusão antes de o navegador fechar |
| Sincronização atual | Bundle da interface em JSDOM, perfis, rascunhos, backup de perfis, assistente e bloqueio | Não comprova autenticação e sincronização com contas reais |
| Núcleo próprio Drive | Reconciliação, escrita condicional, bloqueios, aplicação local, criptografia, migração de IDs, dois dispositivos e injeção de falhas nos checkpoints | Transporte, armazenamento e favoritos são simulados; ainda não comprova o serviço real |
| VPN | Interface/adaptador, isolamento, limites de plano, regras, estados e indicador por aba | Não comprova túnel, IP, WebRTC ou recuperação no serviço real |
| Interface compartilhada | Comparação de estilos e temas com o CSS compilado e testes DOM de idioma/navegação | JSDOM não mede a geometria real nem comprova que nada está cortado |

A ponte VPN também passou pela checagem TypeScript durante as implementações anteriores. Para repeti-la, use o compilador das dependências Proton com `--noEmit -p vpn/tsconfig.interface.json`.

O Chromium não iniciou neste ambiente, retornando `socket() failed: Operation not permitted`. Não houve acesso a uma conta Google ou Proton real para validar as últimas versões. Os registros históricos de Edge nas versões 1.3/1.4, com perfis temporários, dados fictícios e WebDAV local, não certificam as alterações atuais.

## Reproduzir a suíte

Node.js 20 ou superior, na raiz:

```sh
npm ci
npm run setup:vpn
npm test
```

A instalação das dependências Proton é necessária ao teste CSS que usa PostCSS. Para reconstruir a sincronização, execute também `npm run setup:sync`, seguido de `npm run build:sync-engine` (worker) e `npm run build:sync` (interface).

Ao alterar o motor Proton, execute `npm run build:vpn`. Para alterar somente sua interface, use `npm run build:vpn-ui`. Esses comandos exigem `setup:vpn`. Recompilações da Sincronização usam `setup:sync` e `setup:vpn`, pois também geram os estilos dos painéis.

## Checklist manual

Use perfis de teste e favoritos fictícios. Registre a versão instalada e o resultado; os passos abaixo são verificações pendentes, não operações já executadas.

### Layout e preferências

- [ ] Abrir todas as abas nos temas claro, escuro e sistema e em PT-BR/inglês.
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

### Limpeza, abas e Nova guia

- [ ] Fechar a última janela pelo X e verificar o relatório na próxima abertura.
- [ ] Interromper uma limpeza de teste e conferir a recuperação posterior.
- [ ] Conferir cookies protegidos e escopo da limpeza com dados fictícios.
- [ ] Conferir várias janelas e as reservas criadas pela extensão.
- [ ] Exportar/importar configurações da Nova guia e selecionar novamente imagens próprias.

## Registro de novas evidências

Para cada rodada manual, registre: data, versão/commit, navegador/versão, sistema, cenário, dados fictícios usados e resultado observado. Não inclua senhas, tokens, arquivos de perfis com credenciais ou favoritos pessoais em logs e capturas publicados.

As próximas entregas e os critérios para substituir os motores estão em [PROXIMOS-PASSOS.md](../PROXIMOS-PASSOS.md).
