# Próximos passos da Super Extensão

Revisado em **12 de novembro de 2026**, referência **1.7.1**. Itens implementados foram testados com APIs simuladas; a conferência da interface no Helium isolado, a confirmação de sincronização real relatada pelo usuário e as validações ainda pendentes estão separadas em [docs/validacao.md](docs/validacao.md).

## Estado e prioridade

| Prioridade | Frente | Estado atual | Próxima entrega |
| --- | --- | --- | --- |
| 1 | Google Drive/favoritos | Núcleo próprio integrado; sincronização confirmada pelo usuário na 1.6.2 | Dois navegadores reais, falhas/reinícios, grandes volumes e restauração de backups por interface |
| 2 | Validação em navegador | Testes de execução, recuperação, transporte e interface; interface conferida parcialmente no Helium isolado | Conferir Google Drive com dois perfis de teste e tráfego real da VPN |
| 3 | Demais sincronizações | Outros provedores e perfis de abas continuam no legado | Migrar um conector por vez e definir propriedade de pastas sobrepostas |
| 4 | Motor próprio da VPN | 1.7.0: controlador próprio, invalidação por geração, alarmes de recuperação e persistência/rotação de tokens | Validar os fluxos reais; extrair integralmente estados, credenciais e transporte do adaptador |
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
- [ ] Separar transporte, estado/recuperação, sessão e proteção WebRTC em módulos próprios.
- [x] Criar testes de contrato para a primeira substituição, incluindo PAC após Babel/minificação.
- [x] Estender contratos para o controlador, gerações, alarmes e persistência/rotação de tokens (1.7.0).
- [x] Manter a chave/formato de sessão ao substituir persistência e renovação; invalidar fork/refresh após logout (1.7.0).
- [x] Adicionar guardas de operações atrasadas, confirmação antes de notificar conexão e despertar por alarmes.
- [ ] Validar em conta real a persistência e a recuperação depois dessas substituições.
- [ ] Preservar a autorização do serviço e os avisos/licenças dos componentes ainda utilizados.

A reescrita continua parcial: regras/PAC, controlador de proxy, gerações, alarmes e persistência/rotação de tokens são próprios. A máquina de estados, o protocolo de login, as credenciais temporárias, o transporte e a seleção de servidores ainda possuem adaptadores Proton. O indicador descreve o roteamento do endereço da aba; não é medição de pacotes nem prova externa do IP.

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
