const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const ORS_API_KEY = process.env.ORS_API_KEY;

app.use(express.json({ limit: '20kb' }));

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);


/* =========================================
   VALIDAÇÃO
========================================= */

function validarTexto(valor) {
  return (
    typeof valor === 'string' &&
    valor.trim().length >= 3 &&
    valor.trim().length <= 250
  );
}


/* =========================================
   AEROPORTOS CONHECIDOS

   Evita ambiguidades como "Congonhas",
   que também é o nome de uma cidade em MG.
========================================= */

const AEROPORTOS_CONHECIDOS = [
  {
    termos: [
      'aeroporto de congonhas',
      'aeroporto congonhas',
      'congonhas cgh',
      'cgh'
    ],
    coordenadas: [-46.6566, -23.6261],
    nome: 'Aeroporto de São Paulo/Congonhas (CGH), São Paulo - SP'
  },
  {
    termos: [
      'aeroporto de guarulhos',
      'aeroporto guarulhos',
      'aeroporto internacional de sao paulo',
      'guarulhos gru',
      'gru'
    ],
    coordenadas: [-46.4731, -23.4356],
    nome: 'Aeroporto Internacional de São Paulo/Guarulhos (GRU), Guarulhos - SP'
  },
  {
    termos: [
      'aeroporto do galeao',
      'aeroporto galeao',
      'galeao gig',
      'gig'
    ],
    coordenadas: [-43.2505, -22.8090],
    nome: 'Aeroporto Internacional do Rio de Janeiro/Galeão (GIG), Rio de Janeiro - RJ'
  },
  {
    termos: [
      'aeroporto santos dumont',
      'santos dumont sdu',
      'sdu'
    ],
    coordenadas: [-43.1631, -22.9105],
    nome: 'Aeroporto Santos Dumont (SDU), Rio de Janeiro - RJ'
  },
  {
    termos: [
      'aeroporto de brasilia',
      'aeroporto brasilia',
      'brasilia bsb',
      'bsb'
    ],
    coordenadas: [-47.9186, -15.8697],
    nome: 'Aeroporto Internacional de Brasília (BSB), Brasília - DF'
  },
  {
    termos: [
      'aeroporto salgado filho',
      'aeroporto de porto alegre',
      'porto alegre poa',
      'poa'
    ],
    coordenadas: [-51.1754, -29.9944],
    nome: 'Aeroporto Internacional Salgado Filho (POA), Porto Alegre - RS'
  }
];


function normalizarBusca(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}


function localizarAeroportoConhecido(texto) {
  const busca = normalizarBusca(texto);
  const palavras = new Set(busca.split(' '));

  return AEROPORTOS_CONHECIDOS.find((aeroporto) =>
    aeroporto.termos.some((termo) => {
      if (termo.length === 3) {
        return palavras.has(termo);
      }

      return busca.includes(termo);
    })
  );
}


/* =========================================
   GEOCODIFICAR DESTINO

   O destino é um endereço conhecido do site.
========================================= */

async function geocodificarDestino(texto) {

  const url =
    new URL(
      'https://api.heigit.org/pelias/v1/search'
    );


  url.searchParams.set(
    'api_key',
    ORS_API_KEY
  );


  url.searchParams.set(
    'text',
    texto
  );


  url.searchParams.set(
    'size',
    '1'
  );


  url.searchParams.set(
    'boundary.country',
    'BR'
  );


  const resposta =
    await fetch(
      url,
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );


  if (!resposta.ok) {

    const detalhe =
      await resposta.text();


    console.error(
      'Erro destino:',
      resposta.status,
      detalhe
    );


    throw new Error(
      `Falha ao localizar destino (${resposta.status})`
    );

  }


  const dados =
    await resposta.json();


  const resultado =
    dados?.features?.[0];


  if (
    !resultado
      ?.geometry
      ?.coordinates
  ) {

    throw new Error(
      `Destino não encontrado: ${texto}`
    );

  }


  return {

    coordenadas:
      resultado.geometry.coordinates,

    nome:
      resultado.properties?.label ||
      texto

  };

}


/* =========================================
   GEOCODIFICAR ORIGEM

   Usa o resultado mais relevante para o
   texto informado pelo visitante.
========================================= */

async function geocodificarOrigem(texto) {

  const aeroportoConhecido =
    localizarAeroportoConhecido(texto);


  if (aeroportoConhecido) {

    console.log(
      'Origem reconhecida:',
      aeroportoConhecido.nome
    );


    return {
      coordenadas:
        aeroportoConhecido.coordenadas,
      nome:
        aeroportoConhecido.nome
    };

  }

  const url =
    new URL(
      'https://api.heigit.org/pelias/v1/search'
    );


  url.searchParams.set(
    'api_key',
    ORS_API_KEY
  );


  url.searchParams.set(
    'text',
    texto
  );


  url.searchParams.set(
    'size',
    '1'
  );


  url.searchParams.set(
    'boundary.country',
    'BR'
  );

  const resposta =
    await fetch(
      url,
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );


  if (!resposta.ok) {

    const detalhe =
      await resposta.text();


    console.error(
      'Erro origem:',
      resposta.status,
      detalhe
    );


    throw new Error(
      `Falha ao localizar origem (${resposta.status})`
    );

  }


  const dados =
    await resposta.json();


  const resultados =
    dados?.features || [];


  if (
    resultados.length === 0
  ) {

    throw new Error(
      `Ponto de partida não encontrado: ${texto}`
    );

  }


  const melhor =
    resultados[0];


  console.log(
    'Origem interpretada:',
    melhor.properties?.label
  );

  return {

    coordenadas:
      melhor.geometry.coordinates,

    nome:
      melhor.properties?.label ||
      texto

  };

}


/* =========================================
   CALCULAR ROTA
========================================= */

async function obterRota(
  origemCoords,
  destinoCoords
) {

  const url =
    new URL(
      'https://api.openrouteservice.org/v2/directions/driving-car'
    );

  url.searchParams.set(
    'start',
    `${origemCoords[0]},${origemCoords[1]}`
  );


  url.searchParams.set(
    'end',
    `${destinoCoords[0]},${destinoCoords[1]}`
  );


  const resposta =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            ORS_API_KEY,
          Accept:
            'application/geo+json'
        }
      }
    );


  if (!resposta.ok) {

    const detalhe =
      await resposta.text();


    console.error(
      'Erro rota:',
      resposta.status,
      detalhe
    );


    throw new Error(
      `Falha ao calcular a rota (${resposta.status})`
    );

  }


  const dados =
    await resposta.json();


  const resumo =
    dados
      ?.features
      ?.[0]
      ?.properties
      ?.summary;


  if (!resumo) {

    throw new Error(
      'Não foi possível obter distância e duração.'
    );

  }


  return {

    distance:
      resumo.distance,

    duration:
      resumo.duration

  };

}


/* =========================================
   API DO SITE
========================================= */

app.post(
  '/api/route',

  async (req, res) => {

    try {


      if (!ORS_API_KEY) {

        return res
          .status(500)
          .json({

            error:
              'A chave ORS_API_KEY não foi configurada.'

          });

      }


      const {
        origin,
        destination
      } =
        req.body || {};


      if (
        !validarTexto(origin) ||
        !validarTexto(destination)
      ) {

        return res
          .status(400)
          .json({

            error:
              'Informe origem e destino válidos.'

          });

      }



      /*
      PRIMEIRO:
      encontra o hotel.
      */

      const destino =
        await geocodificarDestino(
          destination.trim()
        );



      /*
      DEPOIS:
      procura a origem dando preferência
      à região do hotel.
      */

      const origem =
        await geocodificarOrigem(
          origin.trim()
        );



      /*
      Agora sim calcula a rota.
      */

      const rota =
        await obterRota(

          origem.coordenadas,

          destino.coordenadas

        );



      console.log(
        'Origem escolhida:',
        origem.nome
      );


      console.log(
        'Destino:',
        destino.nome
      );


      console.log(
        'Distância:',
        rota.distance / 1000,
        'km'
      );


      console.log(
        'Tempo:',
        rota.duration / 60,
        'min'
      );



      return res.json({

        distance_m:
          rota.distance,

        duration_s:
          rota.duration,

        origin:
          origem.nome,

        destination:
          destino.nome

      });


    }

    catch (erro) {


      console.error(
        'Erro /api/route:',
        erro
      );


      return res
        .status(502)
        .json({

          error:
            erro.message ||
            'Erro ao calcular a rota.'

        });

    }

  }
);


/* =========================================
   SITE
========================================= */

app.get(
  '*',

  (req, res) => {

    res.sendFile(

      path.join(
        __dirname,
        'public',
        'index.html'
      )

    );

  }
);


/* =========================================
   INICIAR
========================================= */

app.listen(
  PORT,

  () => {

    console.log(
      `Araujo Seg disponível em http://localhost:${PORT}`
    );

  }
);
