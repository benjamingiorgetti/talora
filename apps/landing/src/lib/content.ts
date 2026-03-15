export const nav = {
  links: [
    { label: "Beneficios", href: "#beneficios" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: "Agenda una reunion",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  descriptor: "Turnos automaticos por WhatsApp",
};

export const hero = {
  badge: "Turnos automaticos por WhatsApp",
  headline: {
    before: "Mientras vos trabajas, los turnos ",
    highlight: "se siguen agendando",
    after: ".",
  },
  subheadline: "Talora responde y agenda turnos en tu WhatsApp automaticamente.",
  ctaPrimary: "Ver como funciona",
  ctaPrimaryHref: "#como-funciona",
  ctaSecondary: "Agenda una reunion",
  ctaSecondaryHref: "https://calendly.com/giorgettibenjamin/30min",
};

export const metrics = {
  badge: "Resultados",
  badgeColor: "text-emerald-600" as const,
  title: "Nunca pierdas un turno por WhatsApp",
  stats: [
    { value: "<5s", label: "Tiempo de respuesta" },
    { value: "24/7", label: "Sin pausas ni feriados" },
    { value: "3hs", label: "Ahorradas por semana" },
    { value: "0", label: "Mensajes sin responder" },
  ],
  niches: [
    { name: "Peluqueria", icon: "Scissors" as const },
    { name: "Tatuaje", icon: "Pen" as const },
    { name: "Odontologia", icon: "Stethoscope" as const },
    { name: "Estetica", icon: "Sparkles" as const },
    { name: "Manicuria", icon: "Hand" as const },
    { name: "Kinesiologia", icon: "Heart" as const },
    { name: "Psicologia", icon: "Brain" as const },
    { name: "Y mas...", icon: "Plus" as const },
  ],
};

export const benefits = {
  badge: "Beneficios",
  badgeColor: "text-sky-600" as const,
  title: "Todo lo que Talora hace por vos",
  subtitle:
    "Responde los mensajes, ofrece horarios disponibles y confirma turnos automaticamente.",
  items: [
    {
      title: "WhatsApp",
      description:
        "Tus clientes escriben como siempre. El agente responde, consulta disponibilidad y confirma turnos automaticamente.",
      icon: "MessageCircle" as const,
      color: "mint" as const,
    },
    {
      title: "Tu agente personalizado",
      description:
        "Atiende consultas las 24 horas, maneja reprogramaciones y responde preguntas frecuentes sin intervencion humana.",
      icon: "Bot" as const,
      color: "sky" as const,
    },
    {
      title: "Calendario con recordatorios",
      description:
        "Cada turno se crea directo en Google Calendar. Recordatorios automaticos para que nadie falte.",
      icon: "CalendarDays" as const,
      color: "sand" as const,
    },
    {
      title: "Cada profesional con su agenda",
      description:
        "Cada profesional tiene su propio calendario, servicios y horarios. Sin pisarse turnos.",
      icon: "Users" as const,
      color: "lilac" as const,
    },
  ],
};

export const howItWorks = {
  badge: "Como funciona",
  badgeColor: "text-violet-600" as const,
  title: "Como empezas",
  subtitle: "Tres pasos para automatizar tus turnos.",
  steps: [
    {
      number: "1",
      title: "Conecta tu WhatsApp",
      description: "Escanea un QR y tu numero queda vinculado. Sin APIs complejas, sin configuraciones tecnicas.",
    },
    {
      number: "2",
      title: "Configura servicios y horarios",
      description: "Define que servicios ofreces, cuanto duran, quienes los hacen y en que horarios.",
    },
    {
      number: "3",
      title: "Tus clientes agendan solos",
      description: "El agente responde mensajes, consulta disponibilidad y agenda turnos. Vos solo trabajas.",
    },
  ],
};

export const faq = {
  title: "Preguntas frecuentes",
  items: [
    {
      question: "Necesito instalar algo?",
      answer:
        "No. Talora funciona desde la nube. Solo necesitas escanear un QR con tu WhatsApp Business y configurar tus servicios desde el panel web.",
    },
    {
      question: "Funciona con WhatsApp Business?",
      answer:
        "Si, funciona con WhatsApp Business. Conectas tu numero existente y el agente responde desde ahi. Tus clientes no notan diferencia.",
    },
    {
      question: "Puedo tener varios profesionales?",
      answer:
        "Si. Cada profesional tiene sus propios servicios, horarios y calendario de Google. Los clientes eligen con quien agendar.",
    },
    {
      question: "Que pasa si un cliente quiere reprogramar?",
      answer:
        "El agente maneja reprogramaciones y cancelaciones automaticamente. El cliente lo pide por WhatsApp y el turno se actualiza en Calendar.",
    },
    {
      question: "Cuanto tarda la configuracion inicial?",
      answer:
        "Menos de 10 minutos. Conectas WhatsApp, agregas tus servicios y profesionales, y el agente ya esta listo para atender.",
    },
    {
      question: "Puedo personalizar las respuestas del agente?",
      answer:
        "Si. Desde el panel podes editar el tono, las instrucciones y las respuestas frecuentes del agente para que suene como tu negocio.",
    },
    {
      question: "Que pasa si el agente no sabe responder algo?",
      answer:
        "El agente deriva la conversacion a un humano cuando detecta que no puede resolver el pedido. Nunca deja colgado al cliente.",
    },
  ],
};

export const waitlist = {
  title: "Sumate a la lista de espera",
  subtitle:
    "Estamos abriendo acceso de a poco. Agenda una reunion y te mostramos como funciona.",
  cta: "Quiero probar Talora",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  trust: ["Sin compromiso", "Setup en 5 minutos", "Soporte incluido"],
  counter: "+30 negocios ya se anotaron",
};

export const finalCta = {
  headline: "Empieza a automatizar tus turnos hoy",
  subheadline:
    "Conecta WhatsApp, configura tus servicios y deja que la IA haga el resto.",
  cta: "Agenda una reunion",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  trust: ["Setup en 5 minutos", "Soporte incluido", "Funciona con tu WhatsApp actual"],
};

export const footer = {
  columns: [
    {
      title: "Producto",
      links: [
        { label: "Beneficios", href: "#beneficios" },
        { label: "Como funciona", href: "#como-funciona" },
        { label: "FAQ", href: "#faq" },
      ],
    },
  ],
};
