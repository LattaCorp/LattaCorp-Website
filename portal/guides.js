/* Info tab guides for the LattaCorp client portal.
   To add a guide, copy one block below and change the text. Each guide has:
     id       short name with no spaces (used for links)
     topic    the group it appears under on the Info tab
     title    the heading clients see
     intro    one or two sentences under the title
     sections a list of { heading, steps: [...] } or { heading, text }; "steps" show as a numbered list
   Every bit of text has an English (en) and Spanish (es) version. */
window.PORTAL_GUIDES = [
  {
    id: "app",
    topic: { en: "Using your portal", es: "Cómo usar su portal" },
    title: { en: "Add the portal to your phone as an app", es: "Agregue el portal a su teléfono como una app" },
    intro: {
      en: "Save the portal to your home screen and it opens like an app, with our tree icon. You stay signed in, so there's no need for a new code each time.",
      es: "Guarde el portal en su pantalla de inicio y se abrirá como una app, con nuestro ícono del árbol. Su sesión queda iniciada, así que no necesita un código nuevo cada vez."
    },
    sections: [
      {
        device: "ios",
        heading: { en: "iPhone or iPad", es: "iPhone o iPad" },
        steps: {
          en: [
            "Open lattacorpfl.com/portal in Safari.",
            "Tap the Share button (the square with an arrow pointing up). On iPhone it's at the bottom of the screen; on iPad it's at the top.",
            "Scroll down and tap Add to Home Screen.",
            "Tap Add. The LattaCorp icon appears on your home screen."
          ],
          es: [
            "Abra lattacorpfl.com/portal en Safari.",
            "Toque el botón Compartir (el cuadro con una flecha hacia arriba). En iPhone está abajo; en iPad está arriba.",
            "Baje y toque Agregar a pantalla de inicio.",
            "Toque Agregar. El ícono de LattaCorp aparece en su pantalla de inicio."
          ]
        }
      },
      {
        device: "android",
        heading: { en: "Android phone", es: "Teléfono Android" },
        steps: {
          en: [
            "Open lattacorpfl.com/portal in Chrome.",
            "Tap the menu button (three dots) in the top right corner.",
            "Tap Add to Home screen or Install app.",
            "Tap Install (or Add). The LattaCorp icon appears with your other apps."
          ],
          es: [
            "Abra lattacorpfl.com/portal en Chrome.",
            "Toque el botón de menú (tres puntos) arriba a la derecha.",
            "Toque Agregar a pantalla principal o Instalar app.",
            "Toque Instalar (o Agregar). El ícono de LattaCorp aparece con sus otras apps."
          ]
        }
      },
      {
        device: "desktop",
        heading: { en: "Computer", es: "Computadora" },
        steps: {
          en: [
            "Open lattacorpfl.com/portal in Chrome or Microsoft Edge.",
            "Click the install icon at the right end of the address bar (a small screen with a down arrow), or open the browser menu and choose Install.",
            "Click Install. The portal opens in its own window and gets a shortcut on your computer."
          ],
          es: [
            "Abra lattacorpfl.com/portal en Chrome o Microsoft Edge.",
            "Haga clic en el ícono de instalar al final de la barra de direcciones (una pantalla pequeña con una flecha), o abra el menú del navegador y elija Instalar.",
            "Haga clic en Instalar. El portal se abre en su propia ventana y queda un acceso directo en su computadora."
          ]
        }
      },
      {
        heading: { en: "Good to know", es: "Bueno saberlo" },
        text: {
          en: "The app is free and doesn't come from an app store; it's this same secure portal. To remove it, press and hold the icon and choose Remove (or Delete).",
          es: "La app es gratis y no viene de una tienda de apps; es este mismo portal seguro. Para quitarla, mantenga presionado el ícono y elija Eliminar."
        }
      }
    ]
  },
  {
    id: "autopay",
    topic: { en: "Billing and payments", es: "Facturación y pagos" },
    title: { en: "Automatic payment concerns", es: "Dudas sobre pagos automáticos" },
    intro: {
      en: "How automatic payments and invoices work with LattaCorp.",
      es: "Cómo funcionan los pagos automáticos y las facturas con LattaCorp."
    },
    sections: [
      {
        heading: { en: "We never charge without your approval", es: "Nunca cobramos sin su aprobación" },
        text: {
          en: "We do not charge automatic payments without your prior approval.",
          es: "No cobramos pagos automáticos sin su aprobación previa."
        }
      },
      {
        heading: { en: "See a charge you don't recognize?", es: "¿Ve un cargo que no reconoce?" },
        text: {
          en: "Let us know immediately. Call or text 407-470-5309, or email Support@lattacorpfl.com.",
          es: "Avísenos de inmediato. Llame o envíe un texto al 407-470-5309, o escriba a Support@lattacorpfl.com."
        }
      },
      {
        heading: { en: "Setting up automatic payments", es: "Cómo activar los pagos automáticos" },
        text: {
          en: "Automatic payments and invoicing are available on request. Just ask us and we'll set it up for you.",
          es: "Los pagos y facturas automáticos están disponibles a pedido. Solo pídanoslo y lo configuramos."
        }
      },
      {
        heading: { en: "When invoices are sent", es: "Cuándo enviamos las facturas" },
        text: {
          en: "Invoices are sent at the beginning of every month.",
          es: "Enviamos las facturas al comienzo de cada mes."
        }
      }
    ]
  }
];
