export const nav = {
  links: [
    { label: "Que hace", href: "#que-cambia" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: "Agendar demo",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  descriptor: "Para peluquerias y salones de belleza",
};

export const hero = {
  badge: "Para peluquerias y salones de belleza",
  headline: {
    before: "Tu WhatsApp puede ",
    highlight: "llenar tu agenda",
    after: " aunque nadie lo atienda.",
  },
  subheadline:
    "Talora agenda turnos, reactiva clientas y vende mas por WhatsApp sin sumar trabajo manual.",
  ctaPrimary: "Agendar demo",
  ctaPrimaryHref: "https://calendly.com/giorgettibenjamin/30min",
  ctaSecondary: "Ver una demo real",
  ctaSecondaryHref: "#como-funciona",
  microcopy: [
    "Funciona con varios profesionales",
    "Se adapta a tus servicios y horarios",
    "Usa WhatsApp como ya trabaja tu negocio",
  ],
  paraQuien: "Ideal para negocios de belleza con 2 a 10 profesionales que hoy ya manejan su agenda por WhatsApp.",
};

export const problem = {
  badge: "El problema",
  badgeColor: "text-rose-600" as const,
  title: "Tu agenda no se vacia solo por falta de demanda.",
  painPoints: [
    {
      title: "Clientas que preguntan y no reservan",
      description: "Las conversaciones quedan abiertas y el turno no se cierra.",
      color: "lilac" as const,
    },
    {
      title: "Clientas que deberian volver y nadie contacta",
      description: "Se enfria la relacion y la agenda pierde recurrencia.",
      color: "sand" as const,
    },
    {
      title: "Tiempo perdido respondiendo lo mismo una y otra vez",
      description: "Tu equipo dedica horas a tareas repetitivas que no suman valor.",
      color: "sky" as const,
    },
  ],
};

export const queCambia = {
  badge: "Que hace Talora",
  badgeColor: "text-sky-600" as const,
  title: "Tres formas en que Talora hace crecer tu agenda",
  items: [
    {
      eyebrow: "Agenda automatica",
      title: "Mas turnos confirmados, menos tiempo coordinando",
      description: "Responde consultas, muestra horarios y reserva turnos por WhatsApp sin depender del equipo.",
      icon: "CalendarCheck" as const,
      color: "mint" as const,
    },
    {
      eyebrow: "Reactivacion",
      title: "Recuperas clientas sin seguimiento manual",
      description: "Detecta clientas inactivas y las vuelve a contactar por WhatsApp en el momento correcto.",
      icon: "UserPlus" as const,
      color: "lilac" as const,
    },
    {
      eyebrow: "Upsell inteligente",
      title: "Mas ticket promedio por visita",
      description: "Sugiere servicios complementarios cuando la clienta ya esta por cerrar su turno.",
      icon: "Sparkles" as const,
      color: "sand" as const,
    },
  ],
};

export const howItWorks = {
  badge: "Como funciona",
  badgeColor: "text-violet-600" as const,
  title: "Empezar es simple",
  subtitle: "Tres pasos para llenar tu agenda por WhatsApp.",
  steps: [
    {
      number: "1",
      title: "Conectas tu WhatsApp",
      description:
        "Usas tu numero y tu forma de trabajar.",
    },
    {
      number: "2",
      title: "Definis tu agenda",
      description:
        "Configuras servicios, horarios, profesionales y disponibilidad.",
    },
    {
      number: "3",
      title: "Talora empieza a responder",
      description:
        "Agenda turnos, reactiva clientas y manda recordatorios desde el mismo chat.",
    },
  ],
};

export const faq = {
  title: "Preguntas que seguro te estas haciendo",
  items: [
    {
      question: "Talora sirve si tengo varios profesionales?",
      answer:
        "Si. Podes definir agendas, servicios y disponibilidad por cada profesional.",
    },
    {
      question: "Puedo definir que hace cada profesional?",
      answer:
        "Si. Talora muestra solo los servicios y horarios que correspondan a cada persona.",
    },
    {
      question: "Que pasa si una clienta pide algo fuera de lo normal?",
      answer:
        "Talora resuelve lo repetitivo y te deja intervenir cuando hace falta revision humana.",
    },
    {
      question: "Sigue funcionando si ya uso WhatsApp todos los dias?",
      answer:
        "Si. La idea es que no cambies tu forma de trabajar, sino que dejes de responder manualmente lo que se repite.",
    },
  ],
};

export const finalCta = {
  headline:
    "Si hoy tus turnos dependen de responder mensajes, estas perdiendo agenda.",
  subheadline:
    "Talora responde, agenda y reactiva por WhatsApp sin sumar trabajo manual ni cambiar tu forma de trabajar.",
  cta: "Agendar demo",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  trust: [
    "Te mostramos como se adaptaria a tu negocio",
    "Funciona con tu WhatsApp actual",
  ],
};

export const idealPara = {
  badge: "Para quien es Talora",
  badgeColor: "text-sky-600" as const,
  title: "Ideal para negocios como el tuyo",
  items: [
    "Peluquerias con varios profesionales",
    "Centros de estetica",
    "Salones que ya viven en WhatsApp",
    "Negocios que hoy coordinan turnos a mano",
  ],
};

export const footer = {
  tagline: "Automatiza turnos por WhatsApp con inteligencia artificial.",
  microcopy: "Hecho con amor en Buenos Aires.",
  columns: [
    {
      title: "Producto",
      links: [
        { label: "Que hace", href: "#que-cambia" },
        { label: "Como funciona", href: "#como-funciona" },
        { label: "FAQ", href: "#faq" },
      ],
    },
  ],
};
