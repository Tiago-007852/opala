// Dados de contacto do restaurante. Edite aqui — o site usa estes valores.
// Campos vazios ("") não são mostrados no site.
export const restaurant = {
  name: "Opala",
  legalName: "Opala, Lda",
  socialName: "Opala Eventos",
  phones: ["+244 924 717 262", "+244 924 717 292"],
  whatsapp: "244924717262", // só números, com indicativo do país
  instagramUrl: "",   // TODO: link do Instagram
  facebookUrl: "",    // TODO: link do Facebook
  address: "",        // TODO: morada do restaurante
  hours: "",          // TODO: horário de funcionamento
};

export const whatsappLink = (text = "Olá! Gostaria de fazer um pedido / reserva no Opala.") =>
  `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(text)}`;

export const welcomeParagraphs = [
  "É com enorme prazer que recebemos você! Para nós, cada visita é muito mais do que simplesmente servir uma refeição: é uma oportunidade de proporcionar bons momentos, sabores marcantes e uma experiência que merece ser recordada.",
  "Acreditamos que uma boa refeição começa muito antes do primeiro garfo. Começa no cuidado, na atenção a cada detalhe e, sobretudo, no prazer de receber quem escolhe estar connosco.",
  "Sente-se, relaxe, escolha com calma e permita-se desfrutar.",
  "Obrigado por nos escolher e nos permitir fazer parte do seu momento.",
];

export const farewellParagraphs = [
  "Foi um prazer receber você à nossa mesa. Esperamos que cada sabor, cada detalhe e cada momento vivido connosco tenha tornado a sua experiência especial.",
  "A sua preferência é o que nos inspira a continuar a fazer melhor. Por isso, volte sempre, traga a família, os amigos e aqueles com quem gosta de partilhar bons momentos.",
  "Uma boa refeição termina no prato, mas uma boa experiência fica na memória.",
  "Se gostou da experiência, recomende-nos a alguém especial. E se tiver alguma sugestão, teremos todo o gosto em ouvir, porque a sua opinião ajuda-nos a crescer.",
];
