const fetch = require("node-fetch");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DISTANCE_API_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";
const BASE_CEP = "31980540";

const sanitizeCep = (value = "") => value.toString().replace(/\D/g, "");

exports.handler = async (event) => {
  if (!GOOGLE_API_KEY) {
    return respond(500, { error: "GOOGLE_API_KEY nao configurada." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return respond(400, { error: "Corpo da requisicao invalido." });
  }

  const vehicleCep = sanitizeCep(body.vehicleCep);
  const destinationCep = sanitizeCep(body.destinationCep);
  const vehicleType = (body.vehicleType || "carro").toString().toLowerCase();

  if (vehicleCep.length !== 8 || destinationCep.length !== 8) {
    return respond(400, {
      error: "Informe os dois CEPs para calcular a distancia.",
    });
  }

  const legs = [
    { origins: BASE_CEP, destinations: vehicleCep },
    { origins: vehicleCep, destinations: destinationCep },
    { origins: destinationCep, destinations: BASE_CEP },
  ];

  try {
    let totalKm = 0;
    for (const leg of legs) {
      totalKm += await fetchDistanceInKm(leg.origins, leg.destinations);
    }

    return respond(200, {
      distanceKm: totalKm,
      price: calculatePrice(totalKm, vehicleType),
    });
  } catch (error) {
    return respond(500, {
      error: error.message || "Falha ao consultar a API do Google.",
    });
  }
};

async function fetchDistanceInKm(origins, destinations) {
  const params = new URLSearchParams({
    units: "metric",
    mode: "driving",
    origins,
    destinations,
    key: GOOGLE_API_KEY,
  });

  const response = await fetch(`${DISTANCE_API_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Resposta invalida da API do Google.");
  }

  const data = await response.json();
  if (data.status !== "OK") {
    throw new Error(data.error_message || "A API do Google retornou um erro.");
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error(mapElementStatusToMessage(element?.status));
  }

  const distanceMeters = element.distance?.value;
  if (typeof distanceMeters !== "number") {
    throw new Error("Nao foi possivel obter a distancia.");
  }

  return distanceMeters / 1000;
}

function mapElementStatusToMessage(status) {
  switch (status) {
    case "NOT_FOUND":
      return "CEP invalido ou nao encontrado.";
    case "ZERO_RESULTS":
      return "Nenhuma rota foi encontrada entre os CEPs informados.";
    case "MAX_ROUTE_LENGTH_EXCEEDED":
      return "A distancia excede o limite permitido.";
    default:
      return "A API do Google nao conseguiu calcular a rota.";
  }
}

function calculatePrice(distanceKm, vehicleType) {
  const rules = {
    carro: { base: 150, extra: 3.5 },
    moto: { base: 150, extra: 3.5 },
    utilitario: { base: 190, extra: 3.9 },
    semipesado: { base: 250, extra: 4.5 },
  };

  const { base, extra } = rules[vehicleType] || rules.carro;

  if (distanceKm <= 40) {
    return base;
  }

  return base + (distanceKm - 40) * extra;
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
