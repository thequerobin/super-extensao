# Próximos passos da Super Extensão

Registrado em 9 de novembro de 2026, a pedido do usuário.

## Proton VPN — integrado na versão 1.5.0

- Integrar a extensão do Proton VPN à Super Extensão.
- Repositório de origem: https://github.com/ProtonVPN/proton-vpn-browser-extension
- Disponibilizar a opção de **tunelamento dividido**, conforme solicitado pelo usuário.
- Manter a identidade visual e os idiomas do projeto.

## Configurações gerais

- A configuração deve ser **geral para toda a Super Extensão**, abrangendo seus módulos.
- Centralizar as preferências globais em uma área de **Configurações gerais**, com persistência e aplicação consistentes em toda a extensão, em vez de manter configurações globais independentes em cada módulo.

Status: integração implementada na versão 1.5.0, com aba VPN, seleção dos servidores gratuitos permitidos pela conta e tunelamento dividido nos modos incluir/excluir. Tema compartilhado com a Super Extensão. Compilação e testes automatizados disponíveis; login, conexão real e recuperação após reiniciar ainda precisam de validação em um navegador com uma conta Proton. Veja `vpn/INTEGRACAO.md`.
