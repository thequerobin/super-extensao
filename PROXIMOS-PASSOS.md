# Próximos passos da Super Extensão

Revisado em **13 de novembro de 2026**, referência **1.7.26**. A página de bloqueio permite voltar ao endereço interceptado após confirmação da VPN e novo clique, com revalidação de estado e sem repetir POST. Consulta/cache de conta, política Free/pago e resolução das configurações de recursos usam núcleos próprios desde a 1.7.25. Endpoints, formatos e fachadas de compatibilidade permanecem. A conexão Proton pessoal ainda precisa ser repetida após a correção da previsão de rede da 1.7.24. Evidências, limites, confirmações do usuário e validações ainda pendentes estão separados em [docs/validacao.md](docs/validacao.md).

## Estado e prioridade

| Prioridade | Frente | Estado atual | Próxima entrega |
| --- | --- | --- | --- |
| 1 | Google Drive/favoritos | Núcleo próprio integrado; sincronização confirmada pelo usuário na 1.6.2 | Dois navegadores reais, falhas/reinícios, grandes volumes e restauração de backups por interface |
| 2 | Validação em navegador | Testes de execução, recuperação, transporte e interface; interface conferida parcialmente no Helium isolado | Conferir Google Drive com dois perfis de teste e tráfego real da VPN |
| 3 | Demais sincronizações | Outros provedores e perfis de abas continuam no legado | Migrar um conector por vez e definir propriedade de pastas sobrepostas |
| 4 | Motor próprio da VPN | 1.7.19: runner nativo aprovado; conta, troca EUA/Canadá, recuperação pela página local e inclusão/exclusão com medições externas no Helium; regras originais restauradas | Medir queda e transições com captura autorizada pelo Windows, ampliar IPv6/DNS, testar suspensão/reinício completo, liberação/cancelamento e recursos de terceiros; ver docs/vpn-validacao-pc.md |
| Contínua | Interface e manutenção | Catálogo e adaptadores compartilhados entregues em 1.6.8; 154 testes aprovados; fontes das páginas estáticas e estilos validados centralizados | Ampliar a conferência visual de diálogos, contraste, textos longos e alturas do popup |

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
- [x] Impedir sobreposição de pastas, alteração de escopo com operação pendente e alterações indevidas das pastas permanentes/favoritos gerenciados.
- [x] Testar dois dispositivos simulados e falhas antes/depois dos checkpoints.

A primeira execução no novo worker aproveita o perfil salvo; não exige recriação nem um botão separado de migração. Cadastro, OAuth interativo e a estrutura de agendamento ainda usam a camada de compatibilidade. A execução de favoritos Google Drive é própria; a troca de todos os componentes do Floccus ainda não terminou.

### Validação e melhorias pendentes

- [x] Registrar a confirmação do usuário de que a sincronização Google Drive funcionou após a atualização 1.6.2.
- [ ] Validar detalhadamente OAuth, bloqueios, `If-Match`, gravação e leitura com dados fictícios; o relato de sucesso não certifica cada cenário.
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
- [x] Consulta leve de estado confirmado e abertura do painel sem estado falso de conexão; carregar conta/servidores em segundo plano (1.7.2).
- [x] Países recolhidos, bandeiras SVG locais, filtros de plano/manutenção e carregamento em lotes.
- [x] Carregamento progressivo, sem bloquear todo o painel enquanto os servidores chegam.
- [x] Inclusão/exclusão de sites, subdomínios e aplicação de regras na conexão ativa.
- [x] Sinal verde/azul por aba no ícone, preservando o badge de pausa da limpeza.
- [x] Invalidar o cache do indicador na navegação, recarga, ativação e substituição da aba; restaurar o ícone normal sem controle do proxy (1.7.1).
- [x] Ajustes de largura e caixa fixa das setas dos países.

### Validar no navegador

- [ ] Login, autorização negada, nova autorização e saída de conta.
- [ ] Conexão/desconexão e IP real, incluindo perda de rede e recuperação após reinício.
- [ ] Inclusão/exclusão de domínio, subdomínios e redes locais no tráfego real.
- [ ] Cor e texto do indicador ao navegar, trocar de aba, mudar regras e usar modo anônimo.
- [ ] Comportamento quando outra extensão ou política assumir o proxy.
- [ ] Garantir visualmente que setas, bandeiras e foco cabem no popup sem rolagem horizontal.

### Reescrita futura do motor

- [x] Mapear contratos de autenticação, sessão, atualização de token, autorização e recuperação em [docs/vpn-engine.md](docs/vpn-engine.md).
- [x] Extrair regras e compilação PAC para `vpn/engine`, usadas pelo proxy e pelo indicador.
- [x] Corrigir o registro do observador de controle do proxy e cobrir a tomada por outra extensão.
- [x] Substituir a aplicação do proxy por um controlador próprio com serialização, confirmação e tratamento de erros (1.7.0).
- [x] Extrair máquina de estados, restauração e recuperação para `vpn/engine/state.ts`, preservando comandos e armazenamento (1.7.4).
- [x] Evitar alternância automática de servidores: intervalo após conexão/restauração e status incompleto tratado como desconhecido (1.7.5).
- [x] Coordenar retries, atividade e verificações de saúde por despertares; impedir retomada de intenção antiga ao voltar do modo ocioso (1.7.4).
- [x] Extrair obtenção, cache, expiração, renovação e descarte de credenciais temporárias para módulos próprios (1.7.9).
- [x] Extrair transporte HTTP: prazo/cancelamento, JSON/binário, erros, Retry-After e repetição de leituras após refresh (1.7.10).
- [x] Extrair catálogo, cache, ranking, seleção manual/automática e failover para módulos próprios; preservar escolha manual na recuperação (1.7.11).
- [x] Extrair WebRTC e coordenação do login: estado temporário, validade, consumo único, guarda de sessão e escritas de privacidade próprias (1.7.12).
- [x] Extrair consulta/cache de conta, controle de plano e resolução de configurações de recursos, mantendo os adaptadores e os dados existentes (1.7.25).
- [x] Criar testes de contrato para a primeira substituição, incluindo PAC após Babel/minificação.
- [x] Estender contratos para o controlador, gerações, alarmes e persistência/rotação de tokens (1.7.0).
- [x] Manter a chave/formato de sessão ao substituir persistência e renovação; invalidar fork/refresh após logout (1.7.0).
- [x] Adicionar guardas de operações atrasadas, confirmação antes de notificar conexão e despertar por alarmes.
- [ ] Validar em conta real a persistência e a recuperação depois dessas substituições.
- [ ] Preservar a autorização do serviço e os avisos/licenças dos componentes ainda utilizados.

A extração dos módulos funcionais está implementada: regras/PAC, controlador de proxy, máquina de estados, restauração, recuperação, gerações, alarmes, credenciais temporárias, transporte HTTP, catálogo/seleção de servidores, WebRTC, coordenação do login e persistência/rotação de tokens são próprios. O serviço Proton, sua página oficial, formatos/endpoints, traduções e utilitários de compatibilidade permanecem; isso não equivale à remoção de todo código do fornecedor. A revisão minuciosa do código gerou correções na 1.7.13; validação com tráfego real continua pendente. Veja [auditoria-vpn.md](docs/auditoria-vpn.md). O indicador descreve o roteamento do endereço da aba; não é medição de pacotes nem prova externa do IP.

## 3. Interface e configurações gerais

- [x] Tema e idioma compartilhados, com seletores no cabeçalho.
- [x] Menus fixos e componentes comuns para botões, campos, cartões, avisos e switches.
- [x] Contorno de foco interno e controles de largura nos painéis.
- [x] Altura ajustável do popup e preservação da seção selecionada.
- [x] Centralizar a aplicação do tema em `SuperPreferences.bindTheme`, incluindo a aba de reserva.
- [x] Unificar os tokens de cor das configurações da Nova guia e o contorno de teclado.
- [x] Cobrir troca de tema/idioma, preservação de rascunhos, campos compostos e descarte de observadores com testes automatizados.
- [ ] Revisar visualmente todas as telas, assistentes e diálogos em PT-BR/inglês e nos três temas.
- [ ] Conferir teclado, foco, contraste, textos longos e alturas mínima/máxima no navegador.
- [x] Avaliar Configurações gerais: nenhuma tela adicional é necessária nesta etapa; manter tema/idioma no cabeçalho e preferências funcionais no módulo correspondente.
- [ ] Fazer os próximos controles adotarem `ui-components.css` e seus tokens.

## 4. Limpeza, abas e Nova guia

### Extração da Nova guia

**Próxima ação combinada:** o usuário fará a validação da 1.7.18 quando estiver em casa, seguindo o [checklist](docs/newtab-engine.md#próxima-ação-combinada-testes-em-casa--pendente). Aguardamos o relato para registrar a evidência e retomar a próxima etapa. Esta atualização é somente documental; não executa testes nem altera a implementação.

- [x] Etapa 1 na 1.7.18: banco reativo, modelo/defaults, ações, importação/exportação, fila de persistência e migração passam ao núcleo próprio `newtab/engine`. Caminhos de armazenamento e imagens existentes são preservados.
- [x] Validar importação antes de limpar o estado; ordenar escritas e preservar a origem legada até confirmar a persistência.
- [ ] Conferir os dados existentes, editor, importação/exportação, imagens e várias abas no navegador real.
- [ ] Extrair a orquestração do dashboard e o ciclo de vida dos widgets.
- [ ] Extrair o editor, o catálogo e os provedores restantes, mantendo formatos, dados e licenças.

O Tabliss ainda fornece interface e componentes funcionais de widgets/provedores; não foi removido integralmente. [Arquitetura e limites](docs/newtab-engine.md).

### Validação dos módulos locais

- [x] Adicionar exceções independentes de cache e localStorage, importação de favoritos por destino e ações manuais somente em O que apagar (1.7.6).

- [ ] Validar fechamento pelo X no Helium e recuperação após encerrar o processo com limpeza pendente.
- [ ] Conferir pausa/retomada, relatório e notificação após falha parcial.
- [ ] Conferir proteção da última aba com várias janelas e modo anônimo.
- [x] Corrigir erros de resposta/chave ausente em Unsplash/GIPHY, preservar cache e adicionar configuração local das chaves (1.6.6).
- [ ] Testar importação/exportação da Nova guia e o carregamento real com chaves válidas dos provedores utilizados.
- [ ] Revalidar personalizações, favoritos e sessões após cada migração dos motores.

## 5. Manutenção

- [x] Corrigir a codificação da descrição do `package.json` e revisar textos das fontes próprias/documentação desta rodada.
- [ ] Avaliar testes DOM que dependem de dependências de compilação do Proton; manter o preparo documentado enquanto essa dependência existir.
- [x] Registrar a confirmação de sincronização 1.6.2, identificando os detalhes não informados.
- [ ] Ampliar as evidências reais com navegador/versão, cenário e resultado para cada teste.
- [ ] Atualizar este roteiro ao fechar cada etapa, mantendo licenças, fontes e documentação de reconstrução.

Alterações apenas documentais mantêm a versão instalada. Alterações que afetem a extensão devem seguir [AGENTS.md](AGENTS.md), incluindo versão igual no manifest, package e lockfile.

Na 1.7.7, o submenu de limpeza usa Geral e Arm. Local em uma única linha; automação, pausa e ações de limpeza aparecem somente em Geral.

Na 1.7.8, o cache do indicador inclui a geração da conexão e é invalidado por mudanças do proxy, reaplicando o ícone após troca manual de servidor mesmo quando a cor permanece igual.


### Próximas etapas da revisão VPN

1. Concluído na 1.7.14: prazos de armazenamento/mensagens, tratamento de respostas tardias e estado não confirmado. Ver [limites e prazos](docs/vpn-engine.md#prazos-de-io--1714).
2. Concluído na 1.7.15: página local de bloqueio com motivo, consulta de estado, reconexão e confirmação explícita de liberação sem VPN. Integração nativa real ainda pendente.
3. Concluído na 1.7.17: atualização compatível, revisão de licenças declaradas, instalação limpa e substituição do empacotador vulnerável. Restam 31 alertas baixos/moderados de ferramentas e migrações principais, detalhados em [vpn-dependencias.md](docs/vpn-dependencias.md).

Os testes nativos de tráfego, IP/DNS, reinício e falhas reais precisam ser executados quando houver ambiente disponível. Nenhuma certificação de privacidade é declarada por testes simulados.


4. **Próxima execução: validação real no PC do usuário**, a retomar quando ele pedir em casa. Seguir [vpn-validacao-pc.md](docs/vpn-validacao-pc.md): runner isolado, IP/DNS/WebRTC, queda e avisos, troca/suspensão/reinício, reconexão/liberação explícita e regras por site. Registrar ambiente, commit, resultado e evidência; nenhum desses testes está marcado como executado por este registro.
5. Depois da validação e das correções necessárias, tratar os alertas baixos/moderados das ferramentas por grupos.
