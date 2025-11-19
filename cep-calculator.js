const cepForm = document.getElementById("cep-form");
const resultBox = document.getElementById("cep-resultado");
const errorBox = document.getElementById("cep-erro");
const distanceSpan = document.getElementById("resultado-km");
const priceSpan = document.getElementById("resultado-preco");
const callButton = document.getElementById("btn-chamado");
const sanitizeCep = (value = "") => value.replace(/\D/g, "");
let lastResultData = null;
updateCallButtonState();

if (cepForm) {
  cepForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cepVeiculo = sanitizeCep(document.getElementById("cep-veiculo")?.value || "");
    const cepDestino = sanitizeCep(document.getElementById("cep-destino")?.value || "");
    const tipoVeiculo = document.querySelector('input[name="tipoVeiculo"]:checked')?.value;

    if (cepVeiculo.length !== 8 || cepDestino.length !== 8 || !tipoVeiculo) {
      showError("Informe dois CEPs validos (8 digitos) e escolha o tipo de veiculo.");
      return;
    }

    toggleLoading(true);

    try {
      const response = await fetch("/.netlify/functions/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleCep: cepVeiculo,
          destinationCep: cepDestino,
          vehicleType: tipoVeiculo,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel calcular a distancia.");
      }

      const { distanceKm, price } = payload;
      if (typeof distanceKm !== "number" || typeof price !== "number") {
        throw new Error("Resposta invalida do servidor.");
      }

      lastResultData = {
        vehicleCep: cepVeiculo,
        destinationCep: cepDestino,
        vehicleType: tipoVeiculo,
        distanceKm,
        price,
      };

      distanceSpan.textContent = `${distanceKm.toFixed(2)} km`;
      priceSpan.textContent = price.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      });
      showResult();
      updateCallButtonState();
    } catch (error) {
      lastResultData = null;
      showError(error.message || "Falha ao processar o calculo.");
      updateCallButtonState();
    } finally {
      toggleLoading(false);
    }
  });
}

function showResult() {
  if (resultBox) resultBox.classList.remove("hidden");
  if (errorBox) errorBox.classList.add("hidden");
}

function showError(message) {
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }
  if (resultBox) {
    resultBox.classList.add("hidden");
  }
}

function toggleLoading(isLoading) {
  const button = cepForm?.querySelector("button");
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Calculando..." : "Calcular percurso";
}

function updateCallButtonState() {
  if (!callButton) return;
  callButton.disabled = !lastResultData;
}

if (callButton) {
  callButton.addEventListener("click", () => {
    if (!lastResultData) return;
    const message = buildWhatsappMessage(lastResultData);
    const url = `https://wa.me/5531990831992?text=${encodeURIComponent(
      message
    )}`;
    window.open(url, "_blank");
  });
}

function buildWhatsappMessage(data) {
  const vehicleNames = {
    moto: "Moto",
    carro: "Carro de passeio",
    utilitario: "Pick-up leve / furgão",
    semipesado: "Veículo grande / comercial",
  };

  const formatCep = (value) =>
    value.slice(0, 5) + "-" + value.slice(5, 8);

  const priceFormatted = data.price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  return (
    "*Chamado de Guincho*\n" +
    `CEP do veículo: ${formatCep(data.vehicleCep)}\n` +
    `CEP do destino: ${formatCep(data.destinationCep)}\n` +
    `Tipo do veículo: ${vehicleNames[data.vehicleType] || data.vehicleType}\n` +
    `Distância total: ${data.distanceKm.toFixed(2)} km\n` +
    `Preço estimado: ${priceFormatted}`
  );
}
