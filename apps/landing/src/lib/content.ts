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
    before: "Converti WhatsApp en el canal que ",
    highlight: "llena tu agenda",
    after: ".",
  },
  subheadline:
    "Talora ayuda a peluquerias y salones de belleza a agendar turnos, reactivar clientas y vender mas sin sumar trabajo manual.",
  ctaPrimary: "Agendar demo",
  ctaPrimaryHref: "https://calendly.com/giorgettibenjamin/30min",
  ctaSecondary: "Ver como funciona",
  ctaSecondaryHref: "#como-funciona",
  microcopy: [
    "Funciona con varios profesionales",
    "Se adapta a tus servicios y horarios",
    "Atiende por WhatsApp 24/7",
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
      description: "Muchas conversaciones quedan sin cierre.",
      color: "lilac" as const,
    },
    {
      title: "Clientas que deberian volver y nadie contacta",
      description: "Pero nadie las reactiva a tiempo.",
      color: "sand" as const,
    },
    {
      title: "Tiempo perdido respondiendo lo mismo una y otra vez",
      description: "Tu equipo repite las mismas respuestas todos los dias.",
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
      title: "Agenda automatica",
      description: "Responde consultas, muestra horarios y reserva turnos sin depender del equipo.",
      benefit: "Mas turnos confirmados, menos tiempo coordinando mensajes.",
      icon: "CalendarCheck" as const,
      color: "mint" as const,
      metric: "24/7",
    },
    {
      title: "Reactivacion",
      description: "Detecta clientas que hace semanas no vuelven y les escribe por WhatsApp.",
      benefit: "Clientas recuperadas sin seguimiento manual.",
      icon: "UserPlus" as const,
      color: "lilac" as const,
      metric: "+30%",
    },
    {
      title: "Upsell inteligente",
      description: "Sugiere tratamientos, brushing, color o servicios complementarios en el momento justo.",
      benefit: "Mas ticket promedio por visita.",
      icon: "Sparkles" as const,
      color: "sand" as const,
      metric: "+23%",
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
        "Talora se adapta a tu numero, tu negocio y tu forma de trabajar.",
    },
    {
      number: "2",
      title: "Configuras servicios, horarios y profesionales",
      description:
        "Definis que ofrece cada persona y cuando tiene disponibilidad.",
    },
    {
      number: "3",
      title: "Talora empieza a responder, agendar y seguir clientas",
      description:
        "Automatiza reservas, recordatorios y reactivacion desde el mismo chat.",
    },
  ],
};

export const faq = {
  title: "Preguntas que seguro te estas haciendo",
  items: [
    {
      question: "Talora sirve si tengo varios profesionales?",
      answer:
        "Si. Podes configurar profesionales, servicios y agendas por separado. Cada una tiene su propio calendario y horarios.",
    },
    {
      question: "Puedo definir que hace cada profesional?",
      answer:
        "Si. Cada profesional puede tener sus propios horarios y servicios: corte, color, brushing, tratamiento, lo que necesites.",
    },
    {
      question: "Que pasa si una clienta pide algo fuera de lo normal?",
      answer:
        "Talora puede derivar la conversacion a un humano cuando detecta que no puede resolver el pedido. Nunca deja colgada a la clienta.",
    },
    {
      question: "Sigue funcionando si ya uso WhatsApp todos los dias?",
      answer:
        "Si. Justamente esta pensado para negocios que ya venden y agendan por WhatsApp, pero hoy lo hacen de forma manual.",
    },
  ],
};

export const finalCta = {
  headline:
    "Si hoy respondes todo a mano, estas perdiendo turnos.",
  subheadline:
    "Talora agenda, reactiva y responde por WhatsApp sin sumar trabajo manual.",
  cta: "Agendar demo",
  ctaHref: "https://calendly.com/giorgettibenjamin/30min",
  trust: [
    "Te mostramos como se adaptaria a tu negocio",
    "Soporte incluido",
    "Funciona con tu WhatsApp actual",
  ],
};

export const footer = {
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
