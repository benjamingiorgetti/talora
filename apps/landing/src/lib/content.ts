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
  headline: "Tus clientes piden turno por WhatsApp.\nTalora los agenda automaticamente.",
  subheadline:
    "Un agente de IA responde, agenda y confirma turnos en tu WhatsApp.\nTodo sincronizado con Google Calendar.",
  ctaPrimary: "Ver como funciona",
  ctaPrimaryHref: "#como-funciona",
  ctaSecondary: "Agenda una reunion",
  ctaSecondaryHref: "https://calendly.com/giorgettibenjamin/30min",
};

export const metrics = {
  title: "Funciona para negocios que reciben turnos por WhatsApp",
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
  title: "Todo lo que necesitas para gestionar turnos",
  subtitle:
    "Una plataforma que conecta WhatsApp, calendario e inteligencia artificial para que tu negocio funcione solo.",
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
  title: "Asi de simple",
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
    {
      title: "Empresa",
      links: [
        { label: "Sobre nosotros", href: "#" },
        { label: "Contacto", href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacidad", href: "#" },
        { label: "Terminos", href: "#" },
      ],
    },
  ],
};
