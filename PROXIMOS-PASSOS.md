# Próximos passos da Super Extensão

Revisado em **11 de novembro de 2026**, referência **1.6.0**. Itens implementados foram testados com APIs simuladas; a validação em conta real permanece separada em [docs/validacao.md](docs/validacao.md).

## Estado e prioridade

| Prioridade | Frente | Estado atual | Próxima entrega |
| --- | --- | --- | --- |
| 1 | Google Drive/favoritos | Núcleo próprio integrado a Sincronizar, ações direcionais e agendamento | Validação real, grandes volumes e restauração de backups por interface |
| 2 | Validação em navegador | Testes de execução, recuperação, transporte e interface; Chromium bloqueado no ambiente atual | Conferir Google Drive com dois perfis de teste e tráfego real da VPN |
| 3 | Demais sincronizações | Outros provedores e perfis de abas continuam no legado | Migrar um conector por vez e definir propriedade de pastas sobrepostas |
| 4 | Motor próprio da VPN | Não iniciado; interface própria sobre Proton | Mapear sessão, proxy, regras e recuperação antes de substituir partes |
| Contínua | Interface e manutenção | Componentes e preferências compartilhados | Regressões visuais e consistência da documentação |

## 1. Motor próprio de sincronização

### Google Drive de favoritos — entregue em 1.6.0

- [x] Remover o painel de comparação; manter diagnóstico apenas nos testes internos.
- [x] Executar o núcleo próprio no fluxo normal de sincronização dos perfis atendidos.
- [x] Preservar IDs e aproveitar cache/mapeamentos legados quando consistentes.
- [x] Persistir base comum e mapeamentos próprios por perfil.
- [x] Reconciliar criação, edição, movimento, ordenação e remoção.
- [x] Mesclar alterações de campos distintos e interromper conflitos incompatíveis sem escolher uma versão silenciosamente.
- [x] Usar o mesmo núcleo para enviar/receber uma vez, mantendo a proteção de exclusões.
- [x] Escrever no Drive com condição de revisão, bloqueio remoto temporário e conferência posterior do conteúdo.
- [x] Pré-gerar o ID de arquivos novos e persistir o payload antes do envio.
- [x] Preservar a criptografia compatível e aceitar o cabeçalho XBEL legado sem carregar DTDs.
- [x] Guardar backup e diário por operação; recuperar criações e gravações já concluídas após interrupção.
- [x] Serializar execuções, atender cancelamento e reutilizar o agendamento existente.
- [x] Impedir sobreposição de pastas, alteração de escopo com operação pendente e uso de raízes protegidas/favoritos gerenciados.
- [x] Testar dois dispositivos simulados e falhas antes/depois dos checkpoints.

A primeira execução no novo worker aproveita o perfil salvo; não exige recriação nem um botão separado de migração. Cadastro, OAuth interativo e a estrutura de agendamento ainda usam a camada de compatibilidade. A execução de favoritos Google Drive é própria; a troca de todos os componentes do Floccus ainda não terminou.

### Validação e melhorias pendentes

- [ ] Validar OAuth, bloqueios, `If-Match`, gravação e leitura com uma conta Google real.
- [ ] Conferir convergência entre dois navegadores reais, inclusive edição concorrente e mudança de ordem.
- [ ] Interromper o worker/processo durante uma execução de teste e conferir a retomada real.
- [ ] Medir tempo e armazenamento com grandes importações; otimizar sem perder recuperação por operação.
- [ ] Criar uma tela para consultar e restaurar os backups internos; hoje eles ficam no armazenamento da extensão.
- [ ] Definir recuperação assistida de conflitos que atualmente exigem ajuste dos itens ou escolha do sentido nas ações avançadas.
- [ ] Definir retorno controlado ao motor anterior, reconstruindo caches/mapeamentos quando necessário; não alternar silenciosamente entre motores no mesmo perfil.

**Critério de validação real:** dados fictícios convergem entre dois navegadores após falhas e reinícios, sem duplicação ou perda; cópias e diário permitem explicar cada operação executada.

### Independência restante e próximos conectores

- [ ] Substituir APIs de cadastro, armazenamento de perfis e autenticação interativa ainda importadas do Floccus.
- [ ] Substituir a estrutura legada de alarmes/agendamento por uma própria, preservando as preferências existentes.
- [ ] Migrar os demais provedores, começando pelos efetivamente utilizados depois do Google Drive.
- [ ] Implementar perfis de abas no núcleo próprio.
- [ ] Definir sincronização de subpastas sobrepostas entre perfis com propriedade explícita dos itens.
- [ ] Manter fontes, licenças e avisos dos componentes ainda utilizados.

Detalhes, limites e caminhos dos backups: [docs/sync-engine.md](docs/sync-engine.md).

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
