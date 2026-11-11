# Próximos passos da Super Extensão

Revisado em **11 de novembro de 2026**, com base na implementação **1.5.19**. Este arquivo é o roteiro principal; itens marcados como implementados não significam validação com contas reais. Consulte [a evidência e o checklist manual](docs/validacao.md).

## Estado e prioridade

| Prioridade | Frente | Estado atual | Próxima entrega |
| --- | --- | --- | --- |
| 1 | Motor próprio de sincronização | Leitor/comparador Google Drive sem escrita | Identidade persistente e reconciliador de três versões, ainda sem aplicar alterações |
| 2 | Validação em navegador | 71 testes simulados registrados; Chromium bloqueado no ambiente atual | Conferir layout, Google Drive e VPN com perfis de teste |
| 3 | Migração da sincronização | Nenhum perfil migrado | Escrita segura, recuperação e ativação explícita por perfil |
| 4 | Motor próprio da VPN | Não iniciado; interface própria sobre o motor Proton | Mapear contratos de sessão, proxy, regras e recuperação antes de substituir partes |
| Contínua | Interface e manutenção | Base visual e preferências compartilhadas | Regressões visuais, consistência dos novos componentes e documentação atualizada |

## 1. Motor próprio de sincronização — Google Drive primeiro

### Entregue na etapa 1

- [x] Núcleo independente em `sync/engine`, sem importar o motor Floccus.
- [x] Leitor Google Drive com renovação OAuth em memória, pesquisa do arquivo e paginação.
- [x] Leitura XBEL, conferência de tamanho/revisão remota e detecção de alterações locais durante a consulta.
- [x] Comparação por tipo, título, URL e caminho, preservando contagens de itens duplicados.
- [x] Botão **Comparar com Google Drive** nas opções do perfil, usando a configuração salva.
- [x] Interrupção para arquivos duplicados, dados inválidos, cancelamento, timeout e recursos não suportados.
- [x] Testes do núcleo e da tela, sem operações de escrita no Drive ou nos favoritos.

### Etapa 2 — modelo e planejamento

- [ ] Definir IDs estáveis, relação entre IDs locais/remotos e versão do formato persistido.
- [ ] Guardar uma base comum confirmada por perfil, separada do cache legado.
- [ ] Reconhecer criação, edição, movimento, ordenação e remoção sem tratar URLs repetidas como o mesmo favorito.
- [ ] Reconciliar base comum, estado local e estado remoto.
- [ ] Definir resolução de conflitos: edição nos dois lados, exclusão contra edição, movimentos incompatíveis e pastas removidas com filhos alterados.
- [ ] Produzir um plano determinístico e revisável, sem aplicar alterações nesta etapa.
- [ ] Testar convergência de dois dispositivos, repetição sem duplicações e ausência de operações após sincronização já concluída.

**Concluir quando:** os casos de conflito, identidade, movimentos, ordem e duplicações estiverem cobertos por testes, com um plano reproduzível e nenhuma escrita implícita.

### Etapa 3 — execução e recuperação

- [ ] Implementar serialização e escrita compatíveis com o arquivo usado pelo perfil.
- [ ] Validar a estratégia de concorrência suportada pela API Drive e impedir sobrescritas sobre revisões remotas alteradas.
- [ ] Fazer backup antes da primeira aplicação e das operações destrutivas.
- [ ] Definir proteção contra exclusões em massa, incluindo perda da pasta local, arquivo vazio e primeira sincronização.
- [ ] Aplicar alterações locais com diário persistente e retomada após interrupção do service worker.
- [ ] Garantir que repetir uma operação interrompida não duplique favoritos nem perca alterações confirmadas.
- [ ] Implementar fila, exclusão mútua por perfil/pasta, cancelamento e progresso.
- [ ] Tratar erros transitórios, limites do Google e recuperação da autorização sem expor credenciais.
- [ ] Implementar compatibilidade com arquivos criptografados antes de permitir migração desses perfis.

**Concluir quando:** falhas injetadas durante gravação, aplicação local e persistência permitirem recuperação previsível, com backup e proteção contra perda de dados.

### Etapa 4 — migrar um perfil e validar

- [ ] Separar a API da interface das classes e ações legadas ainda importadas do Floccus.
- [ ] Migrar um perfil Google Drive explicitamente, mantendo credenciais, pasta, arquivo e preferências.
- [ ] Impedir que os dois motores escrevam simultaneamente no mesmo perfil ou pasta.
- [ ] Definir retorno ao motor anterior, incluindo tratamento dos caches e mapeamentos após alterações pelo novo motor.
- [ ] Implementar agendamento, execução ao iniciar, logs e recuperação após reinício.
- [ ] Validar autorização e sincronização entre dois perfis de navegador com uma conta de teste.
- [ ] Comparar os resultados com os cenários suportados pelo motor anterior.
- [ ] Migrar os demais conectores e perfis de abas depois de estabilizar o Google Drive.

**Concluir quando:** um perfil de teste sincronizar de ponta a ponta, sobreviver a falhas e reinícios e demonstrar convergência entre dois navegadores. O motor próprio ainda não é o padrão.

Detalhes da etapa entregue: [docs/sync-engine.md](docs/sync-engine.md).

## 2. VPN

### Implementado

- [x] Integração do motor Proton e interface própria em `vpn/source`.
- [x] Login pela página oficial e separação de sessão, mensagens e armazenamento.
- [x] Países recolhidos, bandeiras SVG locais, filtros de plano/manutenção e carregamento em lotes.
- [x] Carregamento progressivo, sem bloquear todo o painel enquanto os servidores chegam.
- [x] Inclusão/exclusão de sites, subdomínios e aplicação de regras na conexão ativa.
- [x] Sinal verde/azul por aba no ícone, preservando o badge de pausa da limpeza.
- [x] Ajustes de largura e caixa fixa das setas dos países.

### Validar no navegador

- [ ] Login, autorização negada, nova autorização e saída de conta.
- [ ] Conexão/desconexão e IP real, incluindo perda de rede e recuperação após reinício.
- [ ] Inclusão/exclusão de domínio, subdomínios e redes locais no tráfego real.
- [ ] Cor e texto do indicador ao navegar, trocar de aba, mudar regras e usar modo anônimo.
- [ ] Comportamento quando outra extensão ou política assumir o proxy.
- [ ] Garantir visualmente que setas, bandeiras e foco cabem no popup sem rolagem horizontal.

### Reescrita futura do motor

- [ ] Documentar contratos de autenticação, sessão, atualização de token e autorização de conta/plano.
- [ ] Separar transporte, estado de conexão, proxy, regras de roteamento e proteção WebRTC em módulos próprios.
- [ ] Criar testes de contrato antes de substituir cada parte, mantendo a interface atual.
- [ ] Migrar persistência e recuperação sem perder sessões ou misturar espaços dos módulos.
- [ ] Preservar a autorização do serviço e os avisos/licenças dos componentes ainda utilizados.

A reescrita do motor VPN não foi iniciada. O indicador descreve o roteamento do endereço da aba; não é medição de pacotes nem prova externa do IP.

## 3. Interface e configurações gerais

- [x] Tema e idioma compartilhados, com seletores no cabeçalho.
- [x] Menus fixos e componentes comuns para botões, campos, cartões, avisos e switches.
- [x] Contorno de foco interno e controles de largura nos painéis.
- [x] Altura ajustável do popup e preservação da seção selecionada.
- [ ] Revisar todas as telas, assistentes e diálogos em PT-BR/inglês e nos três temas.
- [ ] Conferir teclado, foco, contraste, textos longos e alturas mínima/máxima no navegador.
- [ ] Verificar se uma tela dedicada de **Configurações gerais** ainda é necessária para preferências além de tema/idioma; não duplicar seletores já globais.
- [ ] Fazer os próximos controles adotarem `ui-components.css` e seus tokens.

## 4. Limpeza, abas e Nova guia

- [ ] Validar fechamento pelo X no Helium e recuperação após encerrar o processo com limpeza pendente.
- [ ] Conferir pausa/retomada, relatório e notificação após falha parcial.
- [ ] Conferir proteção da última aba com várias janelas e modo anônimo.
- [ ] Testar importação/exportação da Nova guia e os provedores online realmente utilizados.
- [ ] Revalidar personalizações, favoritos e sessões após cada migração dos motores.

## 5. Manutenção

- [ ] Normalizar textos com codificação incorreta, incluindo a descrição do `package.json`.
- [ ] Avaliar testes DOM que dependem de dependências de compilação do Proton; manter o preparo documentado enquanto essa dependência existir.
- [ ] Registrar novas evidências de testes reais com versão, navegador, cenário e resultado.
- [ ] Atualizar este roteiro ao fechar cada etapa, mantendo licenças, fontes e documentação de reconstrução.

Alterações apenas documentais mantêm a versão instalada. Alterações que afetem a extensão devem seguir [AGENTS.md](AGENTS.md), incluindo versão igual no manifest, package e lockfile.
