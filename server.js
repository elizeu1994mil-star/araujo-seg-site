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
   DISTÂNCIA EM LINHA RETA
   Usada apenas para escolher o resultado
   geográfico mais próximo do destino.
========================================= */

function distanciaEntrePontos(coord1, coord2) {

  const lon1 = coord1[0];
  const lat1 = coord1[1];

  const lon2 = coord2[0];
  const lat2 = coord2[1];

  const R = 6371;

  const dLat =
    (lat2 - lat1) *
    Math.PI / 180;

  const dLon =
    (lon2 - lon1) *
    Math.PI / 180;


  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(
      lat1 * Math.PI / 180
    ) *

    Math.cos(
      lat2 * Math.PI / 180
    ) *

    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return R * c;

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

   Busca vários resultados e escolhe
   o mais próximo do destino.
========================================= */

async function geocodificarOrigem(
  texto,
  destinoCoords
) {

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


  /*
  Busca mais resultados.
  Isso evita pegar automaticamente
  uma cidade distante com nome parecido.
  */

  url.searchParams.set(
    'size',
    '10'
  );


  url.searchParams.set(
    'boundary.country',
    'BR'
  );


  /*
  Dá preferência para resultados
  próximos ao hotel escolhido.
  */

  url.searchParams.set(
    'focus.point.lon',
    destinoCoords[0]
  );


  url.searchParams.set(
    'focus.point.lat',
    destinoCoords[1]
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


  /*
  Escolhe o resultado geográfico
  mais próximo do hotel.
  */

  let melhor =
    resultados[0];


  let menorDistancia =
    distanciaEntrePontos(
      melhor.geometry.coordinates,
      destinoCoords
    );


  for (
    const resultado
    of resultados
  ) {

    const distancia =
      distanciaEntrePontos(
        resultado.geometry.coordinates,
        destinoCoords
      );


    if (
      distancia <
      menorDistancia
    ) {

      menorDistancia =
        distancia;

      melhor =
        resultado;

    }

  }


  console.log(
    'Origem interpretada:',
    melhor.properties?.label
  );


  console.log(
    'Distância aproximada da origem ao destino:',
    menorDistancia.toFixed(2),
    'km'
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
      'https://api.heigit.org/openrouteservice/v2/directions/driving-car'
    );


  url.searchParams.set(
    'api_key',
    ORS_API_KEY
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

          origin.trim(),

          destino.coordenadas

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