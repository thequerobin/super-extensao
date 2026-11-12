# Núcleo próprio da Nova guia — etapa 1, versão 1.7.18

A primeira extração do Tabliss está integrada ao fluxo normal da Nova guia. Não é apenas uma cópia em outro diretório: o armazenamento, as ações e a validação usam implementações próprias em `newtab/engine`, sem importar Tabliss, React ou serviços online. As fachadas nos caminhos antigos mantêm os componentes atuais funcionando com o novo núcleo.

## Responsabilidades

| Parte | Implementação ativa |
| --- | --- |
| Estado reativo, defaults e transações em memória | `newtab/engine/database.ts` e `events.ts` |
| Modelo, posições e configuração inicial | `newtab/engine/model.ts` |
| Fundos, widgets, ordenação, aparência e foco | `newtab/engine/settings.ts` |
| Validação, exportação v3 e conversão v2 | `newtab/engine/formats.ts` |
| Fila de gravação, erros e mudanças externas | `newtab/engine/persistence.ts` |
| Adaptadores de storage da extensão e IndexedDB | `newtab/engine/browser-storage.ts` |
| Coordenação da migração legada e dados associados | `newtab/engine/migration.ts`; acesso à antiga base fica na fachada de plataforma |
| Ligação React e ciclo de vida do documento | Adaptadores existentes em `vendor/tabliss-source/src/lib/db` e `src/db` |
| Dashboard visual, editor, catálogo/componentes dos widgets e provedores | Ainda na camada Tabliss adaptada |

O build continua partindo da aplicação React adaptada, mas agora inclui o núcleo próprio. Isso **não conclui a retirada de todo o Tabliss**. A próxima extração deve tratar a orquestração do dashboard e o ciclo de vida dos widgets; depois, editor e provedores, preservando IDs/formatos e a biblioteca visual compartilhada. React é uma dependência de interface, não algo que precise ser removido para a extração funcional.

## Compatibilidade e correções

- As chaves `tabliss/config/*`, a base `tabliss/cache`, o object store `changes`, IDs e valores binários existentes são mantidos. Não há renomeação/cópia obrigatória da configuração nem solicitação de recriar o dashboard.
- Importação/exportação continua usando JSON v3, com conversão de arquivos v2 já suportados. Não inclui imagens locais: elas permanecem no cache do dispositivo, como antes. Conversores históricos v1 permanecem no fornecedor, sem novo suporte ativo declarado nesta etapa.
- Antes de alterar o estado, a importação valida e copia o conteúdo. Arquivos desconhecidos, de versão futura, com estrutura inválida ou chaves perigosas não limpam as configurações/imagens existentes e não modificam o objeto recebido. Dados de plugins ficam em `data/<id>`; não é validação de todos os formatos internos de cada widget.
- As alterações de uma transação em memória ficam visíveis antes das notificações, evitando que um observador leia apenas metade de uma reordenação ou troca de configuração. Reset restaura os mesmos defaults locais.
- A persistência agrupa a última alteração por chave e serializa gravações nativas. Captura os valores antes de aguardar operações anteriores; uma falha antiga não repõe um valor que já tenha uma escrita nova enfileirada. Erros continuam visíveis no fluxo existente e alterações pendentes podem ser reenviadas por `flush` ou por uma próxima edição.
- O adaptador de extensão limita o escopo ao prefixo completo com `/`, acompanha mudanças de outras abas e evita eco de escrita. Mudanças de outros módulos ou de nomes parecidos não são importadas/removidas. Idioma continua compartilhado pela chave já usada por `SuperPreferences`.
- IndexedDB confirma a gravação pela conclusão da transação, não pelo sucesso de uma requisição isolada. Reabrir a mesma base preserva Blobs de imagens.
- O registro legado `persist:data` só é removido depois de confirmar a nova configuração e o cache migrado. Falhas preservam a origem; a base antiga de cache não é apagada automaticamente. Configuração atual existente prevalece. Uma preferência global de idioma, sozinha, não impede a migração do layout. Inicializadores concorrentes compartilham a execução; um layout criado enquanto o cache antigo era lido não é substituído.
- A inicialização aguarda a migração e encaminha falhas ao aviso existente. Cache indisponível continua sendo uma degradação quando não há imagens legadas que dependam dele; não é tratado como sucesso na migração dessas imagens.

A fila é local a cada documento. Não implementa transação atômica entre `storage.set` e `remove`, merge de conflitos entre dispositivos, diário de retomada após encerrar o processo nem garantia de conclusão de escrita durante o fechamento do navegador. O flush de saída é uma tentativa, não confirmação durável de tudo. Essas limitações não devem ser confundidas com o núcleo de sincronização de favoritos ou com a proteção da VPN.

## Próxima ação combinada: testes em casa — pendente

Em 12 de novembro de 2026, o usuário pediu apenas atualização documental e informou que executará os testes quando chegar em casa. Não há nova aprovação de uso real nem execução agendada. Nesta atualização não foram alterados código, versão instalada ou dados, e não foram executados novos testes.

Roteiro manual para a 1.7.18:

- [ ] Confirmar a versão instalada e registrar navegador/versão e commit dos arquivos carregados.
- [ ] Abrir a Nova guia com a configuração existente e conferir fundos, widgets, textos/notas, posições e aparência.
- [ ] Abrir o editor, adicionar/reordenar/remover um widget de teste e mudar sua posição/aparência; fechar e reabrir a Nova guia para conferir persistência.
- [ ] Conferir imagens locais já salvas; testar uma imagem de exemplo e reabrir a página, sem apagar o cache existente.
- [ ] Abrir duas abas da Nova guia e conferir propagação de alterações de configuração e idioma, sem escritas em ciclo ou perda de uma edição nova.
- [ ] Exportar uma cópia da configuração antes dos testes de importação. Em um perfil de teste, importar JSON válido e depois um arquivo inválido/de versão futura; o inválido deve produzir erro sem alterar a configuração nem as imagens do perfil.
- [ ] Reiniciar o navegador e conferir configurações, notas e imagens novamente. A exportação JSON não inclui as imagens locais.
- [ ] Registrar o resultado de cada cenário e eventuais mensagens de erro, sem compartilhar configurações privadas ou chaves de serviços.

Os 418 testes automatizados abaixo são evidência da implementação anterior. A conferência manual acima continua pendente até o usuário relatar os resultados; só então atualizar o registro de evidências e decidir a próxima etapa da extração.

## Evidência e reprodução

A suíte completa passou **418 testes**, incluindo 21 novos contratos de banco/ações, importação v2/v3 sem perda por arquivo inválido, filas/falhas/respostas antigas, isolamento e mudanças entre abas, IndexedDB com imagens binárias, migração confirmada e inicialização do bundle de produção em DOM simulado. A implementação IndexedDB é exercitada com `fake-indexeddb` já disponível no ambiente de testes do Floccus; não foi adicionada dependência de execução à Nova guia.

Compilação da Nova guia, TypeScript do núcleo isolado, TypeScript da aplicação adaptada, UI e whitespace passaram. A inicialização do bundle de produção foi exercitada com armazenamento legado e troca de idioma; não equivale a teste no Helium/perfil pessoal. Ainda faltam conferir editor, importação/exportação, várias abas, imagens locais e fechamento/reinício no navegador real.

Na raiz completa do projeto:

```sh
npm ci
npm run setup:newtab
npm run setup:sync
npm run build:newtab
npm test
node_modules/.bin/tsc -p newtab/tsconfig.engine.json
vendor/tabliss-source/node_modules/.bin/tsc --noEmit -p vendor/tabliss-source/tsconfig.json
npm run check:ui
```

As fontes/interfaces de compatibilidade mantêm a atribuição Tabliss e GPL-3.0. `newtab/LICENSE.txt` e `newtab/main.js.LICENSE.txt` continuam acompanhando os arquivos distribuídos. A extração não remove obrigações de licença nem constitui uma distribuição oficial do Tabliss.
