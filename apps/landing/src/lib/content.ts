export const nav = {
  links: [
    { label: "Beneficios", href: "#beneficios" },
    { label: "Cómo funciona", href: "#como-funciona" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: "Agendá una reunión",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  descriptor: "Turnos automáticos por WhatsApp",
};

export const hero = {
  badge: "Turnos automáticos por WhatsApp",
  headline: {
    before: "Mientras vos trabajás, los turnos ",
    highlight: "se siguen agendando",
    after: ".",
  },
  subheadline: "Talora responde y agenda turnos en tu WhatsApp automáticamente.",
  ctaPrimary: "Ver cómo funciona",
  ctaPrimaryHref: "#como-funciona",
  ctaSecondary: "Agendá una reunión",
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
    { name: "Peluquería", icon: "Scissors" as const },
    { name: "Tatuaje", icon: "Pen" as const },
    { name: "Odontología", icon: "Stethoscope" as const },
    { name: "Estética", icon: "Sparkles" as const },
    { name: "Manicuría", icon: "Hand" as const },
    { name: "Kinesiología", icon: "Heart" as const },
    { name: "Psicología", icon: "Brain" as const },
    { name: "Y más...", icon: "Plus" as const },
  ],
};

export const benefits = {
  badge: "Beneficios",
  badgeColor: "text-sky-600" as const,
  title: "Todo lo que Talora hace por vos",
  subtitle:
    "Responde los mensajes, ofrece horarios disponibles y confirma turnos automáticamente.",
  items: [
    {
      title: "WhatsApp",
      description:
        "Tus clientes escriben como siempre. El agente responde, consulta disponibilidad y confirma turnos automáticamente.",
      icon: "MessageCircle" as const,
      color: "mint" as const,
    },
    {
      title: "Tu agente personalizado",
      description:
        "Atiende consultas las 24 horas, maneja reprogramaciones y responde preguntas frecuentes sin intervención humana.",
      icon: "Bot" as const,
      color: "sky" as const,
    },
    {
      title: "Calendario con recordatorios",
      description:
        "Cada turno se crea directo en Google Calendar. Recordatorios automáticos para que nadie falte.",
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
  badge: "Cómo funciona",
  badgeColor: "text-violet-600" as const,
  title: "Cómo empezás",
  subtitle: "Tres pasos para automatizar tus turnos.",
  steps: [
    {
      number: "1",
      title: "Conectá tu WhatsApp",
      description: "Escaneá un QR y tu número queda vinculado. Sin APIs complejas, sin configuraciones técnicas.",
    },
    {
      number: "2",
      title: "Configurá servicios y horarios",
      description: "Definí qué servicios ofrecés, cuánto duran, quiénes los hacen y en qué horarios.",
    },
    {
      number: "3",
      title: "Tus clientes agendan solos",
      description: "El agente responde mensajes, consulta disponibilidad y agenda turnos. Vos solo trabajás.",
    },
  ],
};

export const faq = {
  title: "Preguntas frecuentes",
  items: [
    {
      question: "¿Necesito instalar algo?",
      answer:
        "No. Talora funciona desde la nube. Solo necesitás escanear un QR con tu WhatsApp Business y configurar tus servicios desde el panel web.",
    },
    {
      question: "¿Funciona con WhatsApp Business?",
      answer:
        "Sí, funciona con WhatsApp Business. Conectás tu número existente y el agente responde desde ahí. Tus clientes no notan diferencia.",
    },
    {
      question: "¿Puedo tener varios profesionales?",
      answer:
        "Sí. Cada profesional tiene sus propios servicios, horarios y calendario de Google. Los clientes eligen con quién agendar.",
    },
    {
      question: "¿Qué pasa si un cliente quiere reprogramar?",
      answer:
        "El agente maneja reprogramaciones y cancelaciones automáticamente. El cliente lo pide por WhatsApp y el turno se actualiza en Calendar.",
    },
    {
      question: "¿Cuánto tarda la configuración inicial?",
      answer:
        "Menos de 10 minutos. Conectás WhatsApp, agregás tus servicios y profesionales, y el agente ya está listo para atender.",
    },
    {
      question: "¿Puedo personalizar las respuestas del agente?",
      answer:
        "Sí. Desde el panel podés editar el tono, las instrucciones y las respuestas frecuentes del agente para que suene como tu negocio.",
    },
    {
      question: "¿Qué pasa si el agente no sabe responder algo?",
      answer:
        "El agente deriva la conversación a un humano cuando detecta que no puede resolver el pedido. Nunca deja colgado al cliente.",
    },
  ],
};

export const waitlist = {
  title: "Sumate a la lista de espera",
  subtitle:
    "Estamos abriendo acceso de a poco. Agendá una reunión y te mostramos cómo funciona.",
  cta: "Quiero probar Talora",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  trust: ["Sin compromiso", "Setup en 5 minutos", "Soporte incluido"],
  counter: "+30 negocios ya se anotaron",
};

export const finalCta = {
  headline: "Empezá a automatizar tus turnos hoy",
  subheadline:
    "Conectá WhatsApp, configurá tus servicios y dejá que la IA haga el resto.",
  cta: "Agendá una reunión",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  trust: ["Setup en 5 minutos", "Soporte incluido", "Funciona con tu WhatsApp actual"],
};

export const footer = {
  columns: [
    {
      title: "Producto",
      links: [
        { label: "Beneficios", href: "#beneficios" },
        { label: "Cómo funciona", href: "#como-funciona" },
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
        { label: "Términos", href: "#" },
      ],
    },
  ],
};
