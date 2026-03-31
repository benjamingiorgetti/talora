export const nav = {
  links: [
    { label: "Qué hace", href: "#que-cambia" },
    { label: "Cómo funciona", href: "#como-funciona" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: "Agendar demo",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  descriptor: "Para peluquerías, salones y centros de estética",
};

export const hero = {
  badge: "Para peluquerías, salones y centros de estética",
  headline: {
    before: "Tu WhatsApp puede ",
    highlight: "llenar tu agenda",
    after: " aunque nadie lo atienda.",
  },
  subheadline:
    "Talora agenda turnos, reactiva clientas y vende más por WhatsApp sin sumar trabajo manual.",
  ctaPrimary: "Agendar demo",
  ctaPrimaryHref: "https://calendly.com/giorgettibenjamin/30min",
  ctaSecondary: "Ver cómo funciona",
  ctaSecondaryHref: "#como-funciona",
  supportLine:
    "Usa tu WhatsApp actual. Se adapta a cómo ya vende y agenda tu negocio.",
};

export const queCambia = {
  badge: "Qué hace Talora",
  badgeColor: "text-sky-600" as const,
  title: "Lo que cambia cuando WhatsApp deja de ser un cuello de botella",
  subtitle: "Menos coordinación manual. Más turnos cerrados. Más clientas que vuelven.",
  items: [
    {
      eyebrow: "Agenda automática",
      title: "Responde consultas, ofrece horarios y confirma turnos sin depender del equipo.",
      previewTitle: "Color con Ana",
      previewMeta: "Jueves 15:00",
      previewStatus: "Confirmado",
      color: "mint" as const,
    },
    {
      eyebrow: "Reactivación",
      title: "Vuelve a abrir conversaciones con clientas que ya deberían regresar.",
      previewTitle: "Hace 6 semanas que no venís.",
      previewMeta: "¿Querés que te muestre horarios?",
      previewStatus: "Reactivación lista",
      color: "lilac" as const,
    },
    {
      eyebrow: "Upsell inteligente",
      title: "Sugiere servicios complementarios cuando la clienta ya está por cerrar.",
      previewTitle: "Ya que venís por brushing,",
      previewMeta: "¿querés sumar cejas?",
      previewStatus: "Sugerencia enviada",
      color: "sand" as const,
    },
  ],
};

export const howItWorks = {
  badge: "Cómo funciona",
  badgeColor: "text-violet-600" as const,
  title: "Empezar es simple",
  subtitle: "Tres pasos para ordenar tu agenda desde WhatsApp.",
  steps: [
    {
      number: "1",
      title: "Conectás tu WhatsApp",
      description:
        "Usás tu número y tu forma de trabajar.",
    },
    {
      number: "2",
      title: "Definís tu agenda",
      description:
        "Configurás servicios, horarios y profesionales.",
    },
    {
      number: "3",
      title: "Talora empieza a responder",
      description:
        "Agenda, reactiva y sigue clientas desde el mismo chat.",
    },
  ],
};

export const faq = {
  eyebrow: "FAQ",
  title: "Lo que conviene saber antes de agendar",
  items: [
    {
      question: "¿Sirve si tengo varios profesionales?",
      answer:
        "Sí. Podés definir agendas, servicios y disponibilidad por cada profesional.",
    },
    {
      question: "¿Tengo que cambiar de número o de forma de trabajar?",
      answer:
        "No. La idea es que Talora se adapte a cómo ya vende y agenda tu negocio.",
    },
    {
      question: "¿Qué pasa cuando hace falta intervención humana?",
      answer:
        "Talora resuelve lo repetitivo y te deja entrar cuando la conversación lo necesita.",
    },
    {
      question: "¿También ayuda a que vuelvan clientas que se perdieron?",
      answer:
        "Sí. Puede reactivar clientas inactivas y volver a abrir la conversación.",
    },
  ],
};

export const finalCta = {
  headline: "Te mostramos cómo se vería Talora en tu negocio.",
  subheadline:
    "En una demo corta te mostramos cómo responder, agendar y reactivar desde tu WhatsApp actual.",
  cta: "Agendar demo",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  supportLine: "Sin cambiar de número. Sin cambiar tu forma de trabajar.",
};

export const idealPara = {
  badge: "Para quién es Talora",
  badgeColor: "text-sky-600" as const,
  title: "Talora encaja mejor en negocios donde WhatsApp ya mueve la agenda",
  items: [
    "Entran consultas y reservas por chat todos los días.",
    "Hay varios profesionales con horarios y servicios distintos.",
    "El equipo pierde tiempo respondiendo y coordinando manualmente.",
    "Quieren vender más sin sumar trabajo operativo.",
  ],
  closing: "Especialmente útil para peluquerías, salones, cejas, uñas y estética.",
};

export const footer = {
  tagline: "Turnos por WhatsApp con criterio de negocio.",
  microcopy: "Hecho en Buenos Aires.",
  columns: [
    {
      title: "Producto",
      links: [
        { label: "Qué hace", href: "#que-cambia" },
        { label: "Cómo funciona", href: "#como-funciona" },
        { label: "FAQ", href: "#faq" },
      ],
    },
  ],
};
