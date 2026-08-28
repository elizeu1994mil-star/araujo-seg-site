# Araujo Seg — site com cálculo de rota

Este projeto mantém a chave do OpenRouteService fora do HTML.

## 1. Segurança primeiro

A chave enviada anteriormente em uma conversa deve ser revogada no painel do OpenRouteService e substituída por uma nova.

Não coloque a nova chave dentro de `public/index.html`.

## 2. Instalar o Node.js

Instale o Node.js 18 ou superior.

## 3. Preparar o projeto

Abra o terminal nesta pasta e execute:

    npm install

Depois copie `.env.example` para um novo arquivo chamado `.env`.

No Windows, você pode simplesmente duplicar o arquivo e renomeá-lo para `.env`.

Dentro de `.env`:

    ORS_API_KEY=SUA_NOVA_CHAVE_AQUI
    PORT=3000

## 4. Rodar

No terminal:

    npm start

Depois abra:

    http://localhost:3000

## Como funciona

1. O visitante digita o ponto de partida.
2. O navegador envia origem + destino para `/api/route`.
3. `server.js` usa a chave privada para:
   - geocodificar origem e destino;
   - calcular a rota `driving-car`;
   - retornar somente distância e duração.
4. O site mostra km e tempo estimado.
5. Ao clicar em "Solicitar operação", a mensagem do WhatsApp inclui:
   - saída;
   - destino;
   - distância estimada;
   - tempo estimado.

## Publicação

Como agora existe um backend, não basta hospedar apenas o HTML em hospedagem estática.
Use um serviço com Node.js, por exemplo Render, Railway ou uma VPS.

No serviço de hospedagem, configure a variável de ambiente:

    ORS_API_KEY

com sua nova chave. Não publique o arquivo `.env`.
