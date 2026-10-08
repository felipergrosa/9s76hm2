const messages = {
  es: {
    translations: {

      accountSwitch: {
        title: "Cambiar de cuenta",
        switching: "Cambiando...",
        error: "No se pudo cambiar de cuenta.",
      },
      signup: {
        title: "Registrarse",
        toasts: {
          success: "¡Usuario creado con éxito! ¡Inicia sesión!.",
          fail: "Error al crear el usuario. Comprueba los datos introducidos."
        },
        form: {
          name: "Nombre",
          email: "Correo electrónico",
          password: "Contraseña",
          company: "Nombre de la Organización",
          phone: "Whatsapp (Código de área + NÚMERO)"
        },
        buttons: {
          submit: "Registrarse",
          login: "¿Ya tienes una cuenta? ¡Inicia sesión!"
        },
        verification: {
          title: "Verifica tu correo",
          subtitle: "Enviamos un código de 6 dígitos a",
          codeLabel: "Código de verificación",
          codePlaceholder: "000000",
          verify: "Verificar y completar el registro",
          resend: "Reenviar código",
          resendIn: "Reenviar en {{seconds}}s",
          back: "Volver y editar datos",
          codeSent: "¡Código enviado! Revisa tu correo.",
          codeResent: "Nuevo código enviado.",
          errors: {
            ERR_VERIFICATION_INVALID_EMAIL: "Introduce un correo válido.",
            ERR_VERIFICATION_CODE_INVALID:
              "Código inválido. Compruébalo e inténtalo de nuevo.",
            ERR_VERIFICATION_CODE_EXPIRED:
              "Código expirado. Solicita un nuevo código.",
            ERR_VERIFICATION_MAX_ATTEMPTS:
              "Número máximo de intentos superado. Solicita un nuevo código.",
            ERR_VERIFICATION_COOLDOWN:
              "Espera unos segundos antes de reenviar el código.",
            ERR_VERIFICATION_SEND_LIMIT:
              "Límite de envíos alcanzado. Inténtalo más tarde.",
            ERR_EMAIL_SEND_FAILED:
              "No se pudo enviar el correo. Inténtalo de nuevo.",
            ERR_EMAIL_VERIFICATION_REQUIRED:
              "Verificación de correo obligatoria. Solicita un nuevo código."
          }
        }
      },
      login: {
        title: "Iniciar Sesión",
        form: {
          email: "Correo electrónico",
          password: "Contraseña",
          button: "Acceder"
        },
        buttons: {
          submit: "Iniciar Sesión",
          register: "¿No tienes una cuenta? ¡Regístrate!"
        }
      },
      companies: {
        title: "Registrar Empresa",
        form: {
          name: "Nombre de la Empresa",
          plan: "Plan",
          token: "Token",
          submit: "Registrar",
          success: "¡Empresa creada con éxito!"
        }
      },
      auth: {
        toasts: {
          success: "¡Inicio de sesión realizado con éxito!"
        },
        dueDate: {
          expiration: "Tu suscripción vence en",
          days: "¡días!",
          day: "¡día!",
          expirationToday: "¡Tu suscripción vence hoy!"
        },
        token: "Token"
      },
      dashboard: {
        title: "Panel de Control",
        tabs: {
          indicators: "Indicadores",
          assessments: "NPS",
          attendants: "Agentes",
          performance: "Rendimiento"
        },
        charts: {
          performance: "Gráficos",
          userPerformance: "Gráfico de Usuarios",
          perDay: {
            title: "Atendimientos hoy: "
          }
        },
        cards: {
          inAttendance: "En Atención",
          waiting: "En Espera",
          activeAttendants: "Agentes Activos",
          finalized: "Finalizados",
          newContacts: "Nuevos Contactos",
          totalReceivedMessages: "Mensajes Recibidos",
          totalSentMessages: "Mensajes Enviados",
          averageServiceTime: "T.M. de Atención",
          averageWaitingTime: "T.M. de Espera",
          status: "Estado (Actual)",
          activeTickets: "Tickets Activos",
          passiveTickets: "Tickets Pasivos",
          groups: "Grupos"
        },
        users: {
          name: "Nombre",
          numberAppointments: "Cantidad de Atendimientos",
          statusNow: "Actual",
          totalCallsUser: "Total de atendimientos por usuario",
          totalAttendances: "Total de atendimientos",
          queues: "Colas",
          defaultQueue: "Conexión Predeterminada",
          workingHours: "Horario Laboral",
          startWork: "Inicio de Trabajo",
          endWork: "Fin de Trabajo",
          farewellMessage: "Mensaje de Despedida",
          theme: "Tema Predeterminado",
          menu: "Menú Predeterminado",
        },
        date: {
          initialDate: "Fecha Inicial",
          finalDate: "Fecha Final"
        },
        licence: {
          available: "Disponible hasta"
        },
        assessments: {
          totalCalls: "Total de Atendimientos",
          callsWaitRating: "Atendimientos esperando evaluación",
          callsWithoutRating: "Atendimientos sin evaluación",
          ratedCalls: "Atendimientos evaluados",
          evaluationIndex: "Índice de evaluación",
          score: "Puntuación",
          prosecutors: "Promotores",
          neutral: "Neutros",
          detractors: "Detractores"
        }
      },
      reports: {
        title: "Informe de Encuestas Realizadas",
        operator: "Operador",
        period: "Período",
        until: "Hasta",
        date: "Fecha",
        reportTitle: "Informes",
        calls: "Atendimientos",
        search: "Encuestas",
        durationCalls: "Duración de los Atendimientos",
        grupoSessions: "Atendimientos en Grupos",
        groupTicketsReports: {
          timezone: "America/Sao_Paulo",
          msgToast: "Generando informe comprimido, por favor espere.",
          errorToast: "Error al generar el informe",
          back: "Volver",
          groupServiceReport: "Informe de Atendimientos en Grupos",
          loading: "Cargando...",
          contact: "Contacto",
          dateOpen: "Fecha de Apertura",
          dateLastUpdated: "Fecha de Última Actualización",
          agent: "Quién Atendió",
          agentClosed: "Quién Cerró",
          waitingAssistance: "Esperando Atención",
          process: "En Atención"
        },
        researchReports: {
          response: "respuesta",
          active: "(Activa)",
          inactive: "(Inactiva)",
          quantity: "Cantidad",
          percentage: "porcentaje",
          title: "Informe de Encuestas Realizadas",
          activeSearch: "Encuesta activa",
          inactiveSearch: "Encuesta inactiva"
        },
        ticketDurationDetail: {
          msgToast: "Generando informe comprimido, por favor espere.",
          title: "Informe de Duración del Atendimiento",
          startService: "Inicio del Atendimiento",
          lastUpdated: "Última Actualización",
          lastAgent: "Último Agente",
          durationFinished: "Duración después de finalizado"
        },
        ticketDuration: {
          title: "Informe de Duración de los Atendimientos",
          contact: "Contacto",
          open: "Abiertos",
          pending: "Pendientes",
          finished: "Finalizados",
          durationFinished: "Duración de los finalizados",
          durationAfterFinished: "Duración después de finalizado",
          actions: "Acciones"
        },
        ticketReports: {
          msgToast: "Generando informe comprimido, por favor espere.",
          title: "Informe de Atendimientos"
        },
        pdf: {
          title: "Relación de Atendimientos Realizados",
          exportTitle: "Relación de Atendimientos en Grupos Realizados"
        }
      },
      todo: {
        newTask: "Nueva Tarea",
        add: "Agregar",
        task: "Tareas"
      },
      contactImportWpModal: {
        title: "Exportar Contactos para el Excel",
        buttons: {
          downloadModel: "Descargar modelo de excel para importación",
          closed: "Cerrar",
          import: "Seleccione el archivo de excel para importar Contactos"
        }
      },
      connections: {
        title: "Conexiones",
        waitConnection: "Espera... ¡Tus conexiones se reiniciarán!",
        newConnection: "Nueva Conexión",
        restartConnections: "Reiniciar Conexiones",
        callSupport: "Llamar Soporte",
        toasts: {
          deleted: "¡Conexión eliminada con éxito!",
          closedimported: "Estamos cerrando los tickets importados, por favor espere unos instantes"
        },
        confirmationModal: {
          closedImportedTitle: "Cerrar tickets importados",
          closedImportedMessage: "Si confirmas, todos los tickets importados serán cerrados",
          deleteTitle: "Eliminar",
          deleteMessage: "¿Estás seguro? Esta acción no se puede revertir.",
          disconnectTitle: "Desconectar",
          disconnectMessage: "¿Estás seguro? Deberás leer el código QR de nuevo."
        },
        transferTickets: "Transferir Tickets",
        transferModal: {
          title: "Transferencia de Tickets",
          description:
            "Selecciona la conexión de origen y la de destino. Todos los tickets activos serán movidos.",
          beforeDeleteDesc:
            "Esta conexión tiene {{count}} ticket(s) activo(s). Transfiérelos a otra conexión antes de eliminar.",
          source: "Origen",
          target: "Destino",
          activeCount: "{{count}} ticket(s) activo(s) en la conexión de origen.",
          deleteWarning:
            "Si elimina sin transferir, los tickets quedarán sin conexión vinculada y no aparecerán en los filtros por conexión.",
          cancel: "Cancelar",
          transfer: "Transferir",
          transferAndDelete: "Transferir y Eliminar",
          deleteWithoutTransfer: "Eliminar sin transferir",
          transferredSuccess: "¡{{count}} ticket(s) transferido(s) con éxito!"
        },
        buttons: {
          add: "Agregar Conexión",
          disconnect: "Desconectar",
          tryAgain: "Intentar de nuevo",
          qrcode: "CÓDIGO QR",
          newQr: "Nuevo CÓDIGO QR",
          closedImported: "Cerrar todos los tickets importados",
          preparing: "Preparando mensajes para importación",
          importing: "Importando Mensajes de WhatsApp",
          newQr: "Nuevo CÓDIGO QR",
          processed: "Procesado",
          in: "de",
          connecting: "Conectando"
        },
        typography: {
          processed: "Procesado",
          in: "de",
          date: "Fecha del mensaje"
        },
        toolTips: {
          disconnected: {
            title: "Error al iniciar sesión de WhatsApp",
            content: "Asegúrate de que tu celular esté conectado a internet y intenta de nuevo, o solicita un nuevo Código QR"
          },
          qrcode: {
            title: "Esperando lectura del Código QR",
            content: "Haz clic en el botón 'CÓDIGO QR' y lee el Código QR con tu celular para iniciar la sesión"
          },
          connected: {
            title: "¡Conexión establecida!"
          },
          timeout: {
            title: "La conexión con el celular fue perdida",
            content: "Asegúrate de que tu celular esté conectado a internet y el WhatsApp esté abierto, o haz clic en el botón 'Desconectar' para obtener un nuevo Código QR"
          }
        },
        table: {
          name: "Nombre",
          status: "Estado",
          lastUpdate: "Última actualización",
          "default": "Predeterminado",
          actions: "Acciones",
          session: "Sesión",
          number: "Número de Whatsapp"
        },
        metaSelect: {
          title: "Seleccionar cuentas para conectar",
          subtitle: "Marque las páginas y cuentas que desea conectar:",
          loading: "Cargando páginas...",
          empty: "No se encontraron páginas o cuentas para conectar.",
          alreadyConnected: "Ya conectada",
          selectAll: "Seleccionar todas",
          connect: "Conectar seleccionadas",
          connecting: "Conectando...",
          cancel: "Cancelar",
          success: "{{created}} conexión(es) creada(s), {{updated}} actualizada(s)",
          expired: "Sesión de conexión expirada — inicie la conexión nuevamente"
        }
      },
      showTicketOpenModal: {
        title: {
          header: "Atendimiento Existente"
        },
        form: {
          message: "Este contacto ya está en atendimiento:",
          user: "Agente",
          queue: "Cola",
          messageWait: "Este contacto ya está esperando atendimiento. ¡Ve en la pestaña Esperando!"
        }
      },
      showTicketLogModal: {
        title: {
          header: "Registros"
        },
        options: {
          create: "Ticket creado.",
          chatBot: "ChatBot iniciado.",
          queue: " - Cola definida.",
          open: " inició el atendimiento.",
          access: "accedió al ticket.",
          transfered: "transfirió el ticket.",
          receivedTransfer: "recibió el ticket transferido.",
          pending: "devolvió la cola.",
          closed: "cerró el ticket",
          reopen: "reabrió el ticket",
          redirect: "- redirigido"
        }
      },
      whatsappModal: {
        title: {
          add: "Agregar Conexión",
          edit: "Editar Conexión"
        },
        tabs: {
          general: "General",
          messages: "Mensajes",
          assessments: "NPS",
          integrations: "Integraciones",
          schedules: "Horario de atención"
        },
        form: {
          importOldMessagesEnable: "Importar mensajes del dispositivo",
          importOldMessages: "Fecha de inicio de la importación",
          importRecentMessages: "Fecha de finalización de la importación",
          importOldMessagesGroups: "Importar mensajes de grupo",
          closedTicketsPostImported: "Cerrar tickets después de la importación",
          name: "Nombre",
          queueRedirection: "Redirección de Cola",
          queueRedirectionDesc: "Selecciona una cola para que los contactos que no tienen cola sean redirigidos",
          "default": "Predeterminado",
          group: "Permitir grupos",
          timeSendQueue: "Tiempo en minutos para redirigir a la cola",
          importAlert: "ATENCIÓN: Al guardar, tu conexión se cerrará, será necesario leer de nuevo el Código QR para importar los mensajes",
          groupAsTicket: "Grupos como ticket",
          timeCreateNewTicket: "Crear nuevo ticket en x minutos",
          maxUseBotQueues: "Enviar bot x veces",
          timeUseBotQueues: "Enviar bot en x minutos",
          expiresTicket: "Cerrar chats abiertos después de x minutos",
          expiresTicketNPS: "Cerrar chats esperando evaluación después de x minutos",
          maxUseBotQueuesNPS: "Cantidad máxima de veces que la evaluación va a ser enviada",
          closeLastMessageOptions1: "Del agente/Cliente",
          closeLastMessageOptions2: "Del agente",
          outOfHoursMessage: "Mensaje de fuera de horario de atención",
          greetingMessage: "Mensaje de bienvenida",
          complationMessage: "Mensaje de conclusión",
          lgpdLinkPrivacy: "Link para política de privacidad",
          lgpdMessage: "Mensaje de bienvenida LGPD",
          lgpdDeletedMessages: "Ofuscar mensaje borrado por el contacto",
          lgpdSendMessage: "Siempre solicitar confirmación del contacto",
          ratingMessage: "Mensaje de evaluación - La escala debe ser de 0 a 10",
          token: "Token para integración externa",
          sendIdQueue: "Cola",
          inactiveMessage: "Mensaje de inactividad",
          timeInactiveMessage: "Tiempo en minutos para envío del aviso de inactividad",
          whenExpiresTicket: "Cerrar chats abiertos cuando la última mensaje sea",
          expiresInactiveMessage: "Mensaje de cierre por inactividad",
          prompt: "Prompt",
          collectiveVacationEnd: "Fecha final",
          collectiveVacationStart: "Fecha inicial",
          collectiveVacationMessage: "Mensaje de vacaciones colectivas",
          queueIdImportMessages: "Cola para importar los mensajes"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar"
        },
        menuItem: {
          enabled: "Habilitado",
          disabled: "Deshabilitado",
          minutes: "minutos"
        },
        success: "Conexión guardada con éxito.",
        errorSendQueue: "Se informó tiempo para redirigir cola, pero no se seleccionó fila para redirigir. Ambos campos deben estar llenos",
        errorExpiresNPS: "Es obligatorio informar un tiempo para evaluación cuando se utiliza el NPS.",
        errorRatingMessage: "Es obligatorio informar un mensaje de evaluación cuando se utiliza el NPS."
      },
      qrCode: {
        message: "Lee el QrCode para iniciar la sesión"
      },
      contacts: {
        title: "Contactos",
        toasts: {
          deleted: "¡Contacto eliminado con éxito!"
        },
        searchPlaceholder: "Buscar...",
        confirmationModal: {
          deleteTitle: "Eliminar ",
          importTitlte: "Importar contactos",
          exportContact: "Exportar contactos",
          deleteMessage: "¿Estás seguro de que deseas eliminar este contacto? Todos los atendimientos relacionados se perderán.",
          blockContact: "¿Estás seguro de que deseas bloquear este contacto?",
          unblockContact: "¿Estás seguro de que deseas desbloquear este contacto?",
          importMessage: "¿Desea importar todos los contactos del teléfono?",
          importChat: "Importar Conversaciones",
          wantImport: "¿Desea importar todas las conversaciones del teléfono?"
        },
        buttons: {
          import: "Importar Contactos",
          add: "Agregar Contacto",
          export: "Exportar Contacto"
        },
        table: {
          name: "Nombre",
          whatsapp: "Conexión",
          email: "Correo electrónico",
          actions: "Acciones",
          lastMessage: "Última Mensaje"
        },
        menu: {
          importYourPhone: "Importar del dispositivo predeterminado",
          importToExcel: "Importar / Exportar del Excel"
        }
      },
      forwardMessage: {
        text: "Reenviada"
      },
      forwardMessageModal: {
        title: "Reenviar mensaje",
        buttons: {
          ok: "Reenviar"
        }
      },
      promptModal: {
        form: {
          name: "Nombre",
          prompt: "Prompt",
          voice: "Voz",
          max_tokens: "Máximo de Tokens en la respuesta",
          temperature: "Temperatura",
          apikey: "API Key",
          max_messages: "Máximo de mensajes en el Historial",
          voiceKey: "Clave de la API de Voz",
          voiceRegion: "Región de Voz"
        },
        success: "¡Prompt guardado con éxito!",
        title: {
          add: "Agregar Prompt",
          edit: "Editar Prompt"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar"
        }
      },
      prompts: {
        title: "Prompts",
        table: {
          name: "Nombre",
          queue: "Sector/Cola",
          max_tokens: "Máximo Tokens Respuesta",
          actions: "Acciones"
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "¿Estás seguro? ¡Esta acción no se puede revertir!"
        },
        buttons: {
          add: "Agregar Prompt"
        }
      },
      contactModal: {
        title: {
          add: "Agregar contacto",
          edit: "Editar contacto"
        },
        form: {
          mainInfo: "Datos del contacto",
          extraInfo: "Información adicional",
          name: "Nombre",
          number: "Número de Whatsapp",
          email: "Correo electrónico",
          verificationCode: "Código de verificación",
          extraName: "Nombre del campo",
          extraValue: "Valor",
          chatBotContact: "Deshabilitar chatbot",
          termsLGDP: "Términos LGPD aceptados en:",
          whatsapp: "Conexión Origen: "
        },
        buttons: {
          addExtraInfo: "Agregar información",
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar"
        },
        success: "Contacto guardado con éxito."
      },
      flowbuilder: {
        title: "Flowbuilder",
        subMenus: {
          campaign: "Flujo de Campaña",
          conversation: "Flujo de Conversación"
        }
      },
      flowbuilderModal: {
        flowNotIdPhrase: "Flujo predeterminado"
      },
      flowbuilderNodes: {
        asaasCharge: {
          name: "2ª vía Asaas",
          docFromContact: "CPF/CNPJ del contacto",
          modalAdd: "Agregar 2ª vía Asaas al flujo",
          modalEdit: "Editar 2ª vía Asaas",
          btnAdd: "Agregar",
          btnEdit: "Guardar",
          campoDocumento: "Variable con CPF/CNPJ (opcional)",
          campoDocumentoHint:
            "Nombre de la variable capturada por un bloque Pregunta/Esperar respuesta (ej.: cpf). Vacío usa el CPF/CNPJ del contacto.",
          mensagem: "Mensaje de introducción (opcional)",
          mensagemHint: "Enviado antes de las facturas. Acepta {{variables}} del flujo.",
          mensagemNaoEncontrado: "Mensaje cuando no se encuentran cobros (opcional)",
          mensagemNaoEncontradoHint:
            "También se usa para CPF/CNPJ inválido o error de consulta — luego el flujo sigue por la salida de fallo.",
          sectionEnvio: "Qué enviar por factura",
          incluirBoletoUrl: "Enlace del boleto/factura",
          incluirBoletoPdf: "PDF del boleto",
          incluirLinhaDigitavel: "Línea digitale",
          incluirPix: "PIX copia y pega",
          incluirPixQr: "Código QR PIX (imagen)",
        },
      },
      queueModal: {
        title: {
          queueData: "Datos de la cola",
          text: "Horarios de atención",
          add: "Agregar cola",
          edit: "Editar cola",
          confirmationDelete: "Tem certeza? Todas as opções de integrações serão deletadas."
        },
        form: {
          name: "Nombre",
          color: "Color",
          orderQueue: "Orden de la cola (Bot)",
          rotate: "Rotación",
          timeRotate: "Tiempo de Rotación",
          slaMinutes: "SLA (minutos)",
          slaMinutesHint: "Tiempo máximo de espera antes de que el ticket se marque como SLA atrasado en el Kanban",
          greetingMessage: "Mensaje de bienvenida",
          complationMessage: "Mensaje de conclusión",
          outOfHoursMessage: "Mensaje de fuera de horario de atención",
          token: "Token",
          integrationId: "Integración",
          fileListId: "Lista de archivos",
          closeTicket: "Cerrar ticket",
          sttEnabled: "Transcribir audio",
          queueType: "Tipo de menú",
          message: "Mensaje de retorno",
          queue: "Cola para transferencia",
          integration: "Integración",
          file: "Archivo"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar"
        },
        bot: {
          title: "Opciones",
          toolTipTitle: "Agregue opciones para construir un chatbot",
          toolTip: "Si hay solo una opción, se elegirá automáticamente, haciendo que el bot responda con el mensaje de la opción y siga adelante",
          selectOption: "Seleccione una opción",
          text: "Texto",
          attendent: "Agente",
          queue: "Cola",
          integration: "Integración",
          file: "Archivo",
          toolTipMessageTitle: "El mensaje es obligatorio para seguir al siguiente nivel",
          toolTipMessageContent: "El mensaje es obligatorio para seguir al siguiente nivel",
          selectUser: "Seleccione un Usuario",
          selectQueue: "Seleccione una Cola",
          selectIntegration: "Seleccione una Integración",
          addOptions: "Agregar opciones"
        },
        serviceHours: {
          dayWeek: "Día de la semana",
          startTimeA: "Hora Inicial - Turno A",
          endTimeA: "Hora Final - Turno A",
          startTimeB: "Hora Inicial - Turno B",
          endTimeB: "Hora Final - Turno B",
          monday: "Lunes",
          tuesday: "Martes",
          wednesday: "Miércoles",
          thursday: "Jueves",
          friday: "Viernes",
          saturday: "Sábado",
          sunday: "Domingo"
        }
      },
      queueIntegrationModal: {
        title: {
          add: "Agregar proyecto",
          edit: "Editar proyecto"
        },
        form: {
          id: "ID",
          type: "Tipo",
          name: "Nombre",
          projectName: "Nombre del Proyecto",
          language: "Idioma",
          jsonContent: "Contenido Json",
          urlN8N: "URL",
          typebotSlug: "Typebot - Slug",
          typebotExpires: "Tiempo en minutos para expirar una conversación",
          typebotKeywordFinish: "Palabra para finalizar el ticket",
          typebotKeywordRestart: "Palabra para reiniciar el flujo",
          typebotRestartMessage: "Mensaje al reiniciar la conversación",
          typebotUnknownMessage: "Mensaje de opción inválida",
          typebotDelayMessage: "Intervalo (ms) entre mensajes"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
          test: "Probar Bot"
        },
        messages: {
          testSuccess: "¡Integración probada con éxito!",
          addSuccess: "Integración agregada con éxito.",
          editSuccess: "Integración editada con éxito."
        }
      },
      userModal: {
        warning: "¡Para hacer la importación de los mensajes es necesario leer el qrCode nuevamente !!!",
        title: {
          add: "Agregar usuario",
          edit: "Editar usuario",
          updateImage: "Actualizar imagen",
          removeImage: "Eliminar imagen"
        },
        form: {
          name: "Nombre",
          none: "Ninguna",
          email: "Correo electrónico",
          password: "Contraseña",
          farewellMessage: "Mensaje de despedida",
          profile: "Perfil",
          startWork: "Inicio de trabajo",
          endWork: "Fin de trabajo",
          whatsapp: "Conexión Predeterminada",
          ramal: "Extensión interna",
          allTicketEnable: "Habilitado",
          allTicketDisable: "Deshabilitado",
          allTicket: "Visualizar llamadas sin cola",
          allowGroup: "Permitir Grupos",
          defaultMenuOpen: "Abierto",
          defaultMenuClosed: "Cerrado",
          defaultMenu: "Menú predeterminado",
          defaultTheme: "Tema Predeterminado",
          defaultThemeDark: "Oscuro",
          defaultThemeLight: "Claro",
          allHistoric: "Ver conversaciones de otras colas",
          allHistoricEnabled: "Habilitado",
          allHistoricDisabled: "Deshabilitado",
          allUserChat: "Ver conversaciones de otros usuarios",
          userClosePendingTicket: "Permitir cerrar tickets pendientes",
          showDashboard: "Ver Dashboard",
          allowRealTime: "Ver Panel de Atendimientos",
          allowConnections: "Permitir acciones en las conexiones",
          managedUsers: "Usuarios gestionados (Supervisor)",
          managedUsersHelp: "Selecciona los usuarios cuyas carteras podrá visualizar este usuario. Déjalo vacío para ver solo su propia cartera.",
          managedUsersLabel: "Usuarios que puedo ver"
        },
        tabs: {
          general: "General",
          permissions: "Permisos",
          access: "Acceso a datos"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
          addImage: "Agregar Imagen",
          editImage: "Editar Imagen"
        },
        success: "Usuario guardado con éxito."
      },
      companyModal: {
        title: {
          add: "Agregar empresa",
          edit: "Editar empresa"
        },
        form: {
          name: "Nombre",
          email: "Correo electrónico",
          passwordDefault: "Contraseña",
          numberAttendants: "Usuarios",
          numberConections: "Conexiones"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar"
        },
        success: "Empresa guardada con éxito."
      },
      scheduleModal: {
        title: {
          add: "Nueva Programación",
          edit: "Editar Programación"
        },
        form: {
          body: "Mensaje",
          contact: "Contacto",
          sendAt: "Fecha de Programación",
          sentAt: "Fecha de Envío",
          assinar: "Enviar Firma"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
          addSchedule: "Agregar programación"
        },
        success: "Programación guardada con éxito."
      },
      tagModal: {
        title: {
          add: "Nueva Etiqueta",
          edit: "Editar Etiqueta",
          addKanban: "Nueva Columna",
          editKanban: "Editar Columna"
        },
        form: {
          name: "Nombre",
          color: "Color",
          timeLane: "Tiempo en horas para redirigir a la columna",
          nextLaneId: "Columna",
          greetingMessageLane: "Mensaje de bienvenida de la columna",
          rollbackLaneId: "Volver a la Columna después de retomar el atendimiento"
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar"
        },
        success: "Etiqueta guardada con éxito.",
        successKanban: "Columna guardada con éxito."
      },
      fileModal: {
        title: {
          add: "Agregar lista de archivos",
          edit: "Editar lista de archivos"
        },
        buttons: {
          okAdd: "Guardar",
          okEdit: "Editar",
          cancel: "Cancelar",
          fileOptions: "Agregar archivo"
        },
        form: {
          name: "Nombre de la lista de archivos",
          message: "Detalles de la lista",
          fileOptions: "Lista de archivos",
          extraName: "Mensaje para enviar con archivo",
          extraValue: "Valor de la opción"
        },
        success: "¡Lista de archivos guardada con éxito!"
      },
      chat: {
        noTicketMessage: "Selecciona un ticket para comenzar a conversar."
      },
      uploads: {
        titles: {
          titleUploadMsgDragDrop: "⬇️ ARRASTRA Y SUELTA ARCHIVOS EN EL CAMPO ABAJO ⬇️",
          titleFileList: "Lista de archivo(s)"
        }
      },
      chatInternal: {
        new: "Nueva",
        modal: {
          conversation: "Conversación",
          title: "Título",
          filterUsers: "Filtrar por Usuarios",
          cancel: "Cerrar",
          save: "Guardar"
        },
        modalDelete: {
          title: "Eliminar Conversación",
          message: "Esta acción no se puede revertir, ¿confirmar?"
        }
      },
      ticketsManager: {
        questionCloseTicket: "¿DESEAS CERRAR TODOS LOS TICKETS?",
        yes: "SÍ",
        not: "NO",
        buttons: {
          newTicket: "Nuevo",
          resolveAll: "Resolver Todos",
          close: "Cerrar",
          new: "Nuevo"
        }
      },
      ticketsQueueSelect: {
        placeholder: "Colas"
      },
      tickets: {
        inbox: {
          closedAllTickets: "¿Cerrar todos los tickets?",
          closedAll: "Cerrar Todos",
          newTicket: "Nuevo Ticket",
          yes: "SÍ",
          no: "NO",
          open: "Abiertos",
          resolverd: "Resueltos"
        },
        toasts: {
          deleted: "El atendimiento que estabas fue eliminado."
        },
        notification: {
          message: "Mensaje de"
        },
        tabs: {
          open: {
            title: "Abiertas"
          },
          closed: {
            title: "Resueltos"
          },
          search: {
            title: "Búsqueda"
          }
        },
        search: {
          placeholder: "Buscar atendimiento y mensajes",
          filterConections: "Filtrar por Conexión",
          filterConectionsOptions: {
            open: "Abierto",
            closed: "Cerrado",
            pending: "Pendiente"
          },
          filterUsers: "Filtrar por Usuarios",
          filterContacts: "Filtrar por Contactos",
          filterWallet: "Filtrar por Cartera",
          ticketsPerPage: "Tickets por página"
        },
        buttons: {
          showAll: "Todos",
          returnQueue: "Devolver a la Cola",
          scredule: "Programación",
          deleteTicket: "Eliminar Ticket"
        },
        closedTicket: {
          closedMessage: "Cerrar Ticket Con Mensaje de Despedida",
          closedNotMessage: "Cerrar Ticket Sin Mensaje de Despedida"
        },
        closing: {
          title: "Finalizar atención",
          subject: "Asunto de la atención",
          subjectRequired: "Ingrese el asunto de la atención para finalizar",
          summary: "Resumen / observaciones",
          sendFarewell: "Enviar mensaje de despedida",
          confirm: "Finalizar atención",
          cancel: "Cancelar"
        }
      },
      transferTicketModal: {
        title: "Transferir Ticket",
        fieldLabel: "Escribe para buscar usuarios",
        fieldQueueLabel: "Transferir a cola",
        fieldQueuePlaceholder: "Selecciona una cola",
        fieldWhatsapp: "Selecciona un whatsapp",
        noOptions: "Ningún usuario encontrado con ese nombre",
        msgTransfer: "Observaciones - mensaje interno, no va para el cliente",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar"
        }
      },
      ticketsList: {
        called: "Llamado",
        today: "Hoy",
        missedCall: "Llamada de voz/video perdida a las",
        pendingHeader: "Esperando",
        assignedHeader: "Atendiendo",
        groupingHeader: "Grupos",
        noTicketsTitle: "¡Nada aquí!",
        noTicketsMessage: "Ningún atendimiento encontrado con este estado o término buscado",
        noQueue: "Sin Cola",
        buttons: {
          accept: "Aceptar",
          cancel: "Cancelar",
          start: "Iniciar",
          closed: "Cerrar",
          reopen: "Reabrir",
          transfer: "Transferir",
          ignore: "Ignorar",
          exportAsPDF: "Exportar para PDF",
          kanbanActions: "Opciones de Kanban"
        },
        acceptModal: {
          title: "Aceptar Chat",
          queue: "Seleccionar sector"
        }
      },
      newTicketModal: {
        title: "Crear Ticket",
        fieldLabel: "Escribe para buscar el contacto",
        add: "Agregar",
        buttons: {
          ok: "Guardar",
          cancel: "Cancelar"
        }
      },
      SendContactModal: {
        title: "Enviar contacto",
        fieldLabel: "Escribe para buscar el contacto",
        add: "Agregar",
        buttons: {
          ok: "Enviar",
          cancel: "Cancelar"
        }
      },
      mainDrawer: {
        listItems: {
          dashboard: "Dashboard",
          connections: "Conexiones",
          chatsTempoReal: "Panel",
          tickets: "Atendimientos",
          quickMessages: "Respuestas rápidas",
          contacts: "Contactos",
          queues: "Colas & Chatbot",
          flowbuilder: "Flowbuilder",
          tags: "Etiquetas",
          administration: "Administración",
          companies: "Empresas",
          users: "Usuarios",
          settings: "Configuraciones",
          files: "Lista de archivos",
          helps: "Ayuda",
          messagesAPI: "API",
          schedules: "Programaciones",
          campaigns: "Campañas",
          annoucements: "Informativos",
          chats: "Chat Interno",
          financeiro: "Financiero",
          queueIntegration: "Integraciones",
          version: "Versión",
          kanban: "Kanban",
          prompts: "Talk.Ai",
          allConnections: "Administrar conexiones",
          reports: "Informes",
          management: "Gerencia",
          metaTemplates: "Plantillas Meta",
          whatsappHealth: "Salud de los Números"
        },
        appBar: {
          user: {
            profile: "Perfil",
            logout: "Salir",
            message: "Hola",
            messageEnd: "bienvenido a",
            active: "Activo hasta",
            goodMorning: "Hola,",
            myName: "mi nombre es",
            continuity: "y daré continuidad en tu atendimiento.",
            virtualAssistant: "Asistente Virtual",
            token: "Token inválido, por favor entra en contacto con el administrador de la plataforma."
          },
          message: {
            location: "Ubicación",
            contact: "Contacto"
          },
          notRegister: "Ningún registro",
          refresh: "Actualizar"
        }
      },
      languages: {
        undefined: "Idioma",
        "pt-BR": "Portugués",
        es: "Español",
        en: "English",
        tr: "Türkçe"
      },
      messagesAPI: {
        title: "API",
        textMessage: {
          number: "Número",
          body: "Mensaje",
          token: "Token registrado",
          userId: "ID del usuario/agente",
          queueId: "ID de la Cola"
        },
        mediaMessage: {
          number: "Número",
          body: "Nombre del archivo",
          media: "Archivo",
          token: "Token registrado"
        },
        API: {
          title: "Documentación para envío de mensajes",
          methods: {
            title: "Métodos de Envío",
            messagesText: "Mensajes de Texto",
            messagesMidia: "Mensajes de Media"
          },
          instructions: {
            title: "Instrucciones",
            comments: "Observaciones Importantes",
            comments1: "Antes de enviar mensajes, es necesario el registro del token vinculado a la conexión que enviará los mensajes. <br />Para realizar el registro acceda al menú 'Conexiones', haga clic en el botón editar de la conexión e inserte el token en el debido campo.",
            comments2: "El número para envío no debe tener máscara o caracteres especiales y debe ser compuesto por:",
            codeCountry: "Código del País",
            code: "DDD",
            number: "Número"
          },
          text: {
            title: "1. Mensajes de Texto",
            instructions: "Siguen abajo la lista de informaciones necesarias para envío de los mensajes de texto:"
          },
          media: {
            title: "2. Mensajes de Media",
            instructions: "Siguen abajo la lista de informaciones necesarias para envío de los mensajes de texto:"
          }
        }
      },
      notifications: {
        noTickets: "Ninguna notificación."
      },
      quickMessages: {
        title: "Respuestas Rápidas",
        searchPlaceholder: "Buscar...",
        noAttachment: "Sin anexo",
        confirmationModal: {
          deleteTitle: "Exclusión",
          deleteMessage: "¡Esta acción es irreversible! ¿Desea proseguir?"
        },
        buttons: {
          add: "Agregar",
          attach: "Anexar Archivo",
          cancel: "Cancelar",
          edit: "Editar"
        },
        toasts: {
          success: "¡Atajo agregado con éxito!",
          deleted: "¡Atajo removido con éxito!"
        },
        dialog: {
          title: "Mensaje Rápida",
          shortcode: "Atajo",
          message: "Respuesta",
          save: "Guardar",
          cancel: "Cancelar",
          geral: "Permitir edición por otros",
          add: "Agregar",
          edit: "Editar",
          visao: "Visible para todos"
        },
        scope: {
          personal: "Personal",
          global: "Global",
          sharedEdit: "Edición abierta",
          personalTip: "Visible solo para ti",
          globalTip: "Visible para todos los usuarios",
          sharedEditTip: "Cualquier usuario puede editar esta respuesta"
        },
        table: {
          shortcode: "Atajo",
          message: "Mensaje",
          actions: "Acciones",
          mediaName: "Nombre del Archivo",
          status: "Estado"
        }
      },
      contactLists: {
        title: "Listas de Contactos",
        table: {
          name: "Nombre",
          contacts: "Contactos",
          actions: "Acciones"
        },
        buttons: {
          add: "Nueva Lista"
        },
        dialog: {
          name: "Nombre",
          company: "Empresa",
          okEdit: "Editar",
          okAdd: "Agregar",
          add: "Agregar",
          edit: "Editar",
          cancel: "Cancelar"
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta acción no se puede revertir."
        },
        toasts: {
          deleted: "Registro excluido"
        }
      },
      contactListItems: {
        title: "Contactos",
        searchPlaceholder: "Búsqueda",
        buttons: {
          add: "Nuevo",
          lists: "Listas",
          import: "Importar"
        },
        dialog: {
          name: "Nombre",
          number: "Número",
          whatsapp: "Whatsapp",
          email: "E-mail",
          okEdit: "Editar",
          okAdd: "Agregar",
          add: "Agregar",
          edit: "Editar",
          cancel: "Cancelar"
        },
        table: {
          name: "Nombre",
          number: "Número",
          whatsapp: "Whatsapp",
          email: "E-mail",
          actions: "Acciones"
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta acción no se puede revertir.",
          importMessage: "¿Desea importar los contactos de esta planilla? ",
          importTitlte: "Importar"
        },
        toasts: {
          deleted: "Registro excluido"
        }
      },
      kanban: {
        title: "Kanban",
        searchPlaceholder: "Búsqueda",
        subMenus: {
          list: "Panel",
          tags: "Lanes"
        },
        slaFilter: "SLA vencido",
        slaFilterTooltip: "Mostrar solo tarjetas con SLA vencido",
        slaBadge: "SLA",
        slaOverdueTooltip: "SLA vencido",
        compactMode: "Modo compacto",
        shortcutsHint: "← → columnas · ↑ ↓ tarjetas · Enter abre · C compacto · / buscar",
      },
      campaigns: {
        title: "Campañas",
        searchPlaceholder: "Búsqueda",
        subMenus: {
          list: "Listado",
          listContacts: "Lista de contactos",
          settings: "Configuraciones"
        },
        settings: {
          randomInterval: "Intervalo Aleatorio de Disparo",
          noBreak: "Sin Intervalo",
          intervalGapAfter: "Intervalo mayor después de",
          undefined: "No definido",
          messages: "mensajes",
          laggerTriggerRange: "Intervalo de disparo mayor",
          addVar: "Agregar variable",
          save: "Guardar",
          close: "Cerrar",
          add: "Agregar",
          shortcut: "Atajo",
          content: "Contenido"
        },
        buttons: {
          add: "Nueva Campaña",
          contactLists: "Listas de Contactos"
        },
        table: {
          name: "Nombre",
          whatsapp: "Conexión",
          contactList: "Lista de Contactos",
          option: "Ninguna",
          disabled: "Deshabilitada",
          enabled: "Habilitada",
          status: "Estado",
          scheduledAt: "Programación",
          completedAt: "Concluída",
          confirmation: "Confirmación",
          actions: "Acciones"
        },
        recurrence: {
          label: "Recurrencia",
          none: "Ninguna",
          daily: "Diaria",
          weekly: "Semanal",
          monthly: "Mensual",
          endAt: "Repetir hasta",
          endAtHelper: "Opcional — sin fecha, se repite indefinidamente",
          help: "Repite el envío automáticamente al final de cada ciclo (diario, semanal o mensual)."
        },
        dialog: {
          new: "Nueva Campaña",
          update: "Editar Campaña",
          readonly: "Apenas Visualización",
          help: "Utiliza variables como {nome}, {numero}, {email} o define variables personalizadas.",
          form: {
            name: "Nombre",
            message1: "Mensaje 1",
            message2: "Mensaje 2",
            message3: "Mensaje 3",
            message4: "Mensaje 4",
            message5: "Mensaje 5",
            confirmationMessage1: "Mensaje de Confirmación 1",
            confirmationMessage2: "Mensaje de Confirmación 2",
            confirmationMessage3: "Mensaje de Confirmación 3",
            confirmationMessage4: "Mensaje de Confirmación 4",
            confirmationMessage5: "Mensaje de Confirmación 5",
            messagePlaceholder: "Contenido del mensaje",
            whatsapp: "Conexión",
            status: "Estado",
            scheduledAt: "Programación",
            confirmation: "Confirmación",
            contactList: "Lista de Contacto",
            tagList: "Etiquetas",
            statusTicket: "Estado del Ticket",
            openTicketStatus: "Abierto",
            pendingTicketStatus: "Pendiente",
            closedTicketStatus: "Cerrado",
            enabledOpenTicket: "Habilitado",
            disabledOpenTicket: "Deshabilitado",
            openTicket: "Abrir ticket"
          },
          buttons: {
            add: "Agregar",
            edit: "Actualizar",
            okadd: "Ok",
            cancel: "Cancelar Disparos",
            restart: "Reiniciar Disparos",
            close: "Cerrar",
            attach: "Anexar Archivo"
          }
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta acción no se puede revertir."
        },
        bulk: {
          selected: "{{count}} seleccionada(s)",
          cancel: "Cancelar",
          restart: "Reiniciar",
          delete: "Eliminar",
          confirmTitle: "Confirmar acción masiva",
          confirmMessage: '¿Aplicar "{{action}}" a {{count}} campaña(s)?'
        },
        toasts: {
          success: "Operación realizada con éxito",
          cancel: "Campaña cancelada",
          restart: "Campaña reiniciada",
          deleted: "Registro excluido",
          duplicated: "¡Campaña duplicada con éxito!",
          bulkProcessed: "{{processed}} campaña(s) procesada(s)",
          bulkErrors: "{{count}} campaña(s) con error"
        }
      },
      campaignReport: {
        title: "Informe de",
        inactive: "Inactiva",
        scheduled: "Programada",
        process: "En Andamento",
        cancelled: "Cancelada",
        finished: "Finalizada",
        campaign: "Campaña",
        validContacts: "Contactos Válidos",
        confirmationsRequested: "Confirmaciones Solicitadas",
        confirmations: "Confirmaciones",
        deliver: "Entregues",
        connection: "Conexión",
        contactLists: "Lista de Contactos",
        schedule: "Programación",
        conclusion: "Conclusión"
      },
      announcements: {
        title: "Informativos",
        searchPlaceholder: "Búsqueda",
        active: "Activo",
        inactive: "Inactivo",
        buttons: {
          add: "Nuevo Informativo",
          contactLists: "Listas de Informativos"
        },
        table: {
          priority: "Prioridad",
          title: "Título",
          text: "Texto",
          mediaName: "Archivo",
          status: "Estado",
          actions: "Acciones"
        },
        dialog: {
          edit: "Edición de Informativo",
          add: "Nuevo Informativo",
          update: "Editar Informativo",
          readonly: "Apenas Visualización",
          form: {
            priority: "Prioridad",
            title: "Título",
            text: "Texto",
            mediaPath: "Archivo",
            status: "Estado",
            high: "Alta",
            medium: "Media",
            low: "Baja",
            active: "Activo",
            inactive: "Inactivo"
          },
          buttons: {
            add: "Agregar",
            edit: "Actualizar",
            okadd: "Ok",
            cancel: "Cancelar",
            close: "Cerrar",
            attach: "Anexar Archivo"
          }
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta acción no se puede revertir."
        },
        toasts: {
          success: "Operación realizada con éxito",
          deleted: "Registro excluido"
        }
      },
      campaignsConfig: {
        title: "Configuraciones de Campañas"
      },
      queues: {
        title: "Colas & Chatbot",
        table: {
          name: "Nombre",
          color: "Color",
          greeting: "Mensaje de bienvenida",
          orderQueue: "Ordenación de la cola (bot)",
          sla: "SLA",
          actions: "Acciones",
          ID: "ID"
        },
        buttons: {
          add: "Agregar cola"
        },
        toasts: {
          success: "Cola guardada con éxito",
          deleted: "Cola excluida con éxito"
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida! Os atendimentos dessa fila continuarão existindo, mas não terão mais nenhuma fila atribuída."
        }
      },
      queue: {
        queueData: "Datos"
      },
      queueSelect: {
        inputLabel: "Colas",
        inputLabelRO: "Colas de solo lectura",
        withoutQueue: "Sin cola",
        undefined: "Cola no encontrada",
      },
      reports: {
        title: "Informes de Atendimientos",
        table: {
          id: "Ticket",
          user: "Usuario",
          dateOpen: "Fecha Apertura",
          dateClose: "Fecha Cierre",
          NPS: "NPS",
          status: "Estado",
          whatsapp: "Conexión",
          queue: "Cola",
          actions: "Acciones",
          lastMessage: "Últ. Mensaje",
          contact: "Cliente",
          supportTime: "Tiempo de Atendimiento"
        },
        buttons: {
          filter: "Aplicar Filtro",
          onlyRated: "Apenas Evaluados"
        },
        searchPlaceholder: "Buscar..."
      },
      closingReport: {
        title: "Informe de Cierre",
        subtitle: "Seleccione los filtros y genere el informe de cierre",
        foundSuffix: "atenciones cerradas encontradas",
        empty: "Ningún ticket cerrado en el período",
        filters: {
          startDate: "Fecha Inicial",
          endDate: "Fecha Final",
          user: "Agente",
          queue: "Cola",
          subject: "Asunto",
          all: "Todos",
        },
        cards: {
          total: "Total en el período",
          closed: "Cerrados",
          pending: "Pendientes",
          avgTime: "Tiempo promedio",
        },
        table: {
          protocol: "Protocolo",
          contact: "Contacto",
          user: "Agente",
          queue: "Cola",
          status: "Estado",
          subject: "Asunto",
          summary: "Resumen",
          dateOpen: "Apertura",
          dateClose: "Cierre",
          duration: "Duración",
        },
        buttons: {
          filter: "Aplicar Filtro",
          exportCsv: "Exportar CSV",
        },
      },
      adsReport: {
        title: "Informe de Anuncios",
        subtitle: "Embudo de leads de anuncios Click-to-WhatsApp en el período",
        foundSuffix: "anuncios con leads en el período",
        empty: "Ningún lead de anuncio en el período",
        filters: {
          startDate: "Fecha Inicial",
          endDate: "Fecha Final",
        },
        cards: {
          leads: "Leads de anuncio",
          converted: "Convertidos",
          conversionRate: "Tasa de conversión",
          ads: "Anuncios",
        },
        table: {
          ad: "Anuncio",
          adId: "ID del Anuncio",
          leads: "Leads",
          converted: "Convertidos",
          conversionRate: "Conversión",
          firstContact: "Primer Contacto",
          noAdId: "Sin ID",
        },
        buttons: {
          filter: "Aplicar Filtro",
        },
      },
      callReport: {
        title: "Informe de Llamadas",
        subtitle: "Seleccione los filtros y genere el informe de llamadas",
        foundSuffix: "llamadas encontradas",
        empty: "Ninguna llamada en el período",
        filters: {
          startDate: "Fecha Inicial",
          endDate: "Fecha Final",
          user: "Agente",
          direction: "Dirección",
          status: "Estado",
          all: "Todos",
        },
        directionLabels: {
          in: "Recibida",
          out: "Realizada",
        },
        statusLabels: {
          answered: "Atendida",
          missed: "Perdida",
          rejected: "Rechazada",
          failed: "Fallida",
        },
        cards: {
          total: "Total en el período",
          answered: "Atendidas",
          missed: "Perdidas",
          avgTime: "Duración promedio",
        },
        table: {
          number: "Número",
          contact: "Contacto",
          direction: "Dirección",
          status: "Estado",
          user: "Agente",
          whatsapp: "Conexión",
          start: "Inicio",
          end: "Fin",
          duration: "Duración",
          provider: "Proveedor",
        },
        buttons: {
          filter: "Aplicar Filtro",
          exportCsv: "Exportar CSV",
        },
      },
      metaWebhook: {
        title: "Webhook Unificado Meta",
        subtitle:
          "Configure el webhook de su app Meta apuntando a este servidor",
        toasts: {
          copied: "Copiado al portapapeles",
          copyError: "No se pudo copiar",
        },
        status: {
          configured: "Configurado",
          missing: "No configurado",
        },
        cards: {
          verifyToken: "Verify token",
          appSecret: "Firma (App Secret)",
          perConnection: "Conexiones c/ token propio",
          fields: "Campos suscritos",
        },
        sections: {
          endpoints: "Endpoints y verify token",
          fields: "Campos de suscripción",
          fieldsHint:
            "Campos que este backend realmente consume. Los marcados con * deben habilitarse manualmente en la suscripción de webhook de la app en el panel de Meta; los demás se suscriben automáticamente al conectar la página/cuenta.",
          steps: "Cómo configurar en la app Meta",
        },
        labels: {
          unifiedUrl: "URL del webhook (Facebook + Instagram)",
          verifyToken: "Verify token (global)",
          verifyTokenHint:
            "Valor enmascarado por seguridad. Si no está configurado, defina VERIFY_TOKEN en el backend o un token por conexión.",
          wabaUrl: "URL del webhook (WhatsApp Business API)",
          wabaVerifyToken: "Verify token (WhatsApp Business)",
        },
        fields: {
          autoHint: "Suscrito automáticamente en la conexión (subscribed_apps)",
          dashboardHint:
            "Habilítelo en la suscripción de webhook de la app en el panel de Meta",
          legend:
            "* debe habilitarse manualmente en el panel de Meta. Los demás se suscriben automáticamente al conectar.",
        },
        steps: {
          1: "Acceda a developers.facebook.com, abra su app y vaya a Configuración de Webhooks (producto Messenger para Facebook/Instagram o WhatsApp para la API Oficial).",
          2: "Haga clic en \"Editar suscripción\" y pegue la URL del webhook mostrada arriba en el campo Callback URL.",
          3: "En el campo Verify token, ingrese el mismo token configurado en el backend (VERIFY_TOKEN / WABA_WEBHOOK_VERIFY_TOKEN o el token de la conexión).",
          4: "Guarde y verifique — Meta envía un GET de validación que este backend responde automáticamente.",
          5: "En la lista de campos de suscripción, marque los campos indicados con * arriba (los demás se suscriben por API al conectar).",
          6: "Confirme que el App Secret está configurado (META_APP_SECRET o por conexión) para validar la firma X-Hub-Signature-256.",
        },
        buttons: {
          copy: "Copiar",
        },
        token: {
          notSet: "no configurado",
        },
      },
      queueIntegration: {
        title: "Integraciones",
        table: {
          id: "ID",
          type: "Tipo",
          name: "Nombre",
          projectName: "Nombre del Proyecto",
          language: "Idioma",
          lastUpdate: "Última actualización",
          actions: "Acciones"
        },
        buttons: {
          add: "Agregar Proyecto"
        },
        searchPlaceholder: "Buscar...",
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida! e será removida das filas e conexões vinculadas"
        }
      },
      users: {
        title: "Usuarios",
        table: {
          status: "Estado",
          name: "Nombre",
          email: "Correo electrónico",
          profile: "Perfil",
          startWork: "Inicio de trabajo",
          endWork: "Fin de trabajo",
          actions: "Acciones",
          ID: "ID"
        },
        buttons: {
          add: "Agregar usuario"
        },
        toasts: {
          deleted: "Usuario excluido con éxito."
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Todos los datos del usuario se perderán. Los atendimientos abiertos de este usuario se moverán para la cola."
        }
      },
      compaies: {
        title: "Empresas",
        table: {
          ID: "ID",
          status: "Activo",
          name: "Nombre",
          email: "Correo electrónico",
          password: "Contraseña",
          phone: "Teléfono",
          plan: "Plan",
          active: "Activo",
          numberAttendants: "Atendentes",
          numberConections: "Conexiones",
          value: "Valor",
          namePlan: "Nombre Plan",
          numberQueues: "Filas",
          useCampaigns: "Campañas",
          useExternalApi: "Rest API",
          useFacebook: "Facebook",
          useInstagram: "Instagram",
          useWhatsapp: "Whatsapp",
          useInternalChat: "Chat Interno",
          useSchedules: "Agendamento",
          createdAt: "Creada En",
          dueDate: "Vencimiento",
          lastLogin: "Últ. Login",
          actions: "Acciones",
          money: "€",
          yes: "Sí",
          no: "No",
          document: "CNPJ/CPF",
          recurrence: "Recurrencia",
          monthly: "Mensual",
          bimonthly: "Bimestral",
          quarterly: "Trimestral",
          semester: "Semestral",
          yearly: "Anual",
          clear: "Limpiar",
          delete: "Excluir",
          user: "Usuario",
          save: "Guardar"
        },
        buttons: {
          add: "Agregar empresa"
        },
        toasts: {
          deleted: "Empresa excluida con éxito."
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Todos los datos de la empresa se perderán. Los tickets abiertos de este usuario se moverán para la cola."
        }
      },
      plans: {
        form: {
          name: "Nombre",
          users: "Usuarios",
          connections: "Conexiones",
          campaigns: "Campañas",
          schedules: "Programaciones",
          enabled: "Habilitadas",
          disabled: "Desabilitadas",
          clear: "Cancelar",
          delete: "Excluir",
          save: "Guardar",
          yes: "Sí",
          no: "No",
          money: "€",
          public: "Público"
        }
      },
      helps: {
        title: "Central de Ayuda",
        settings: {
          codeVideo: "Código del Video",
          description: "Descripción",
          clear: "Limpiar",
          delete: "Excluir",
          save: "Guardar"
        }
      },
      schedules: {
        title: "Programaciones",
        confirmationModal: {
          deleteTitle: "¿Estás seguro de que quieres excluir este Agendamento?",
          deleteMessage: "Esta acción no se puede revertir."
        },
        table: {
          contact: "Contacto",
          body: "Mensaje",
          sendAt: "Fecha de Programación",
          sentAt: "Fecha de Envío",
          status: "Estado",
          actions: "Acciones"
        },
        buttons: {
          add: "Nueva Programación"
        },
        toasts: {
          deleted: "Programación excluida con éxito."
        }
      },
      tags: {
        title: "Tags",
        confirmationModal: {
          deleteTitle: "¿Estás seguro de que quieres excluir esta Tag?",
          deleteMessage: "Esta acción no se puede revertir."
        },
        table: {
          id: "ID",
          name: "Nombre",
          kanban: "Kanban",
          color: "Color",
          tickets: "Registros Tags",
          contacts: "Contactos",
          actions: "Acciones"
        },
        buttons: {
          add: "Nueva Tag"
        },
        toasts: {
          deleted: "Tag excluido con éxito."
        }
      },
      wallets: {
        title: "Carteras de Contactos",
        subtitle:
          "Contactos asignados a usuarios mediante etiqueta personal (#). La cartera define quién ve y atiende cada contacto.",
        searchPlaceholder: "Buscar por nombre, número o email...",
        empty: "No se encontraron contactos con cartera.",
        stats: {
          contacts: "Contactos con cartera",
          users: "Usuarios con cartera",
          queues: "Colas involucradas",
          withEmail: "Con e-mail"
        },
        filters: {
          allUsers: "Todos los usuarios",
          allQueues: "Todas las colas"
        },
        table: {
          contact: "Contacto",
          user: "Usuario",
          queue: "Cola",
          phone: "Teléfono",
          email: "Email",
          actions: "Acciones"
        },
        buttons: {
          view: "Ver contacto"
        }
      },
      whatsappHealth: {
        title: "Salud de los Números",
        subtitle:
          "Calidad, límite de envío y estado de las conexiones WhatsApp API Oficial (WABA), consultadas en tiempo real en Meta.",
        updatedAt: "Actualizado en",
        empty: "No se encontró ninguna conexión WhatsApp API Oficial (WABA).",
        stats: {
          total: "Números oficiales",
          green: "Calidad verde",
          attention: "Requiere atención",
          errors: "Fallo en la consulta"
        },
        labels: {
          queryError: "Error en la consulta"
        },
        quality: {
          GREEN: "Verde",
          YELLOW: "Amarillo",
          RED: "Rojo"
        },
        status: {
          connected: "Conectado"
        },
        tiers: {
          TIER_50: "50 clientes/24h",
          TIER_250: "250 clientes/24h",
          TIER_1K: "1 mil clientes/24h",
          TIER_10K: "10 mil clientes/24h",
          TIER_100K: "100 mil clientes/24h",
          TIER_UNLIMITED: "Ilimitado",
          TIER_NOT_SET: "No definido"
        },
        nameStatus: {
          APPROVED: "Aprobado",
          AVAILABLE_WITHOUT_REVIEW: "Disponible sin revisión",
          DECLINED: "Rechazado",
          EXPIRED: "Expirado",
          PENDING_REVIEW: "En revisión",
          NONE: "Ninguno"
        },
        table: {
          connection: "Conexión",
          number: "Número",
          status: "Estado",
          quality: "Calidad",
          messagingLimit: "Límite de envío",
          nameStatus: "Nombre visible",
          lastSync: "Última sync"
        },
        buttons: {
          refresh: "Actualizar",
          syncing: "Actualizando..."
        },
        toasts: {
          synced: "Salud de los números actualizada."
        }
      },
      tagsKanban: {
        title: "Lanes",
        laneDefault: "En abierto",
        confirmationModal: {
          deleteTitle: "¿Estás seguro de que quieres excluir esta Lane?",
          deleteMessage: "Esta acción no se puede revertir."
        },
        table: {
          name: "Nombre",
          color: "Color",
          tickets: "Tickets",
          actions: "Acciones"
        },
        buttons: {
          add: "Nueva Lane"
        },
        toasts: {
          deleted: "Lane excluida con éxito."
        }
      },
      files: {
        title: "Lista de archivos",
        table: {
          name: "Nombre",
          contacts: "Contactos",
          actions: "Acción"
        },
        toasts: {
          deleted: "¡Lista excluida con éxito!",
          deletedAll: "¡Todas las listas fueron excluidas con éxito!"
        },
        buttons: {
          add: "Agregar",
          deleteAll: "Eliminar Todos"
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteAllTitle: "Eliminar Todos",
          deleteMessage: "¿Estás seguro de que deseas eliminar esta lista?",
          deleteAllMessage: "¿Estás seguro de que deseas eliminar todas las listas?"
        }
      },
      settings: {
        success: "Configuraciones guardadas con éxito.",
        title: "Configuraciones",
        tabs: {
          options: "Opciones",
          plans: "Planes",
          helps: "Ayuda"
        },
        settings: {
          userCreation: {
            name: "Creação de usuário",
            options: {
              enabled: "Activado",
              disabled: "Desactivado"
            }
          },
          tabs: {
            options: "Opciones",
            schedules: "Horarios",
            plans: "Planes",
            help: "Ayuda"
          },
          options: {
            disabled: "Deshabilitado",
            enabled: "Habilitado",
            updating: "Actualizando...",
            creationCompanyUser: "Creación de Company/Usuario",
            evaluations: "Evaluaciones",
            officeScheduling: "Agendamento de Expediente",
            queueManagement: "Gerenciamiento por Cola",
            companyManagement: "Gerenciamiento por Empresa",
            connectionManagement: "Gerenciamiento por Conexión",
            sendGreetingAccepted: "Enviar saludo al aceptar el ticket",
            sendMsgTransfTicket: "Enviar mensaje transferencia de sector/agente",
            checkMsgIsGroup: "Ignorar Mensajes de Grupos",
            chatBotType: "Tipo del Bot",
            userRandom: "Escolher atendente aleatório",
            buttons: "Botones",
            acceptCallWhatsapp: "Informar que no acepta llamadas en whatsapp?",
            sendSignMessage: "Permite atendente escolher ENVIAR Assinatura",
            sendGreetingMessageOneQueues: "Enviar saludo cuando haya solamente 1 fila",
            sendQueuePosition: "Enviar mensaje con la posición de la cola",
            sendFarewellWaitingTicket: "Enviar mensaje de despedida en el Aguardando",
            acceptAudioMessageContact: "Aceita receber audio de todos contatos?",
            enableLGPD: "Habilitar tratamiento LGPD",
            requiredTag: "Tag obligatoria para cerrar ticket",
            closeTicketOnTransfer: "Cerrar ticket al transferir para otra cola",
            enableClosingForm: "Pantalla de cierre (asunto y resumen al finalizar)",
            DirectTicketsToWallets: "Mover automáticamente cliente para cartera",
            showNotificationPending: "Mostrar notificación para tickets pendientes"
          },
          customMessages: {
            sendQueuePositionMessage: "Mensaje de posición en la cola",
            AcceptCallWhatsappMessage: "Mensaje para informar que no acepta llamadas",
            greetingAcceptedMessage: "Mensaje de Saludo al aceptar ticket",
            transferMessage: "Mensaje de transferencia fila destino"
          },
          birthday: {
            sectionTitle: "Cumpleaños",
            enabled: "Enviar mensaje de cumpleaños automático",
            connection: "Conexión de envío",
            defaultConnection: "Conexión predeterminada",
            message: "Mensaje de cumpleaños",
            variablesHint: "Variables: {name} (nombre), {firstName} (primer nombre), {ms} (saludo del día), {date} (fecha actual)",
            preview: "Vista previa",
            previewEmpty: "Configure el mensaje para ver el ejemplo aquí"
          },
          sip: {
            sectionTitle: "Troncal SIP",
            enabled: "Habilitar troncal SIP (softphone)",
            host: "Host SIP",
            port: "Puerto WebSocket",
            domain: "Dominio (realm)",
            user: "Usuario SIP",
            password: "Contraseña SIP",
            passwordKeep: "Contraseña ya registrada — deje en blanco para mantener",
            transport: "Transporte",
            transportHint: "El navegador usa WebSocket: WSS recomendado (udp/tcp resuelven a ws://)",
            callerId: "Caller ID",
            statusDisconnected: "SIP desconectado",
            statusIncomplete: "Configuración SIP incompleta",
            wsPortHint: "Puerto WebSocket del servidor SIP (ej.: 8089 en Asterisk)"
          },
          LGPD: {
            title: "LGPD",
            welcome: "Mensaje de bienvenida(LGPD)",
            linkLGPD: "Link de la política de privacidad",
            obfuscateMessageDelete: "Ofuscar mensaje apagada",
            alwaysConsent: "Siempre solicitar consentimiento",
            obfuscatePhoneUser: "Ofuscar número teléfono para usuarios",
            enabled: "Habilitado",
            disabled: "Deshabilitado"
          }
        }
      },
      messages: {
        interactive: {
          title: "Enviar mensaje interactivo",
          menuItem: "Mensaje Interactivo",
          typeLabel: "Tipo",
          types: {
            buttons: "Botones",
            list: "Lista",
            ctaUrl: "Botón de URL",
            pix: "PIX (copia y pega)",
          },
          headerLabel: "Título (encabezado)",
          bodyLabel: "Texto del mensaje",
          bodyPlaceholder: "Escribe el texto del mensaje",
          footerLabel: "Pie de página (opcional)",
          buttonsTitle: "Botones (máx. 3)",
          buttonLabel: "Botón",
          addButton: "Añadir botón",
          listButtonLabel: "Texto del botón de la lista",
          listButtonDefault: "Ver opciones",
          sectionLabel: "Sección",
          rowLabel: "Elemento",
          rowDescriptionLabel: "Descripción (opcional)",
          addRow: "Añadir elemento",
          addSection: "Añadir sección",
          urlButtonText: "Texto del botón",
          urlLabel: "URL",
          pixKeyLabel: "Clave / código PIX",
          pixHint:
            "La API Oficial no tiene botón de copiar — la clave se enviará en el texto del mensaje para que el cliente la copie.",
          preview: "Vista previa",
          cancel: "Cancelar",
          send: "Enviar",
          success: "¡Mensaje interactivo enviado con éxito!",
          errors: {
            bodyRequired: "Ingresa el texto del mensaje.",
            buttonsRequired: "Ingresa al menos 1 botón.",
            sectionsRequired: "Ingresa al menos 1 elemento en la lista.",
            urlInvalid: "Ingresa el texto del botón y una URL válida (http/https).",
            pixKeyRequired: "Ingresa la clave PIX.",
          },
        },
      },
      messagesList: {
        header: {
          assignedTo: "Atribuído a:",
          dialogRatingTitle: "¿Desea dejar una evaluación de atendimiento para el cliente?",
          dialogClosingTitle: "¡Finalizando el atendimiento con el cliente!",
          dialogRatingCancel: "Resolver CON Mensaje de Despedida",
          dialogRatingSuccess: "Resolver y Enviar Evaluación",
          dialogRatingWithoutFarewellMsg: "Resolver SIN Mensaje de Despedida",
          ratingTitle: "Elige un menú de evaluación",
          notMessage: "Ningún mensaje seleccionado",
          amount: "Valor de prospecção",
          buttons: {
            return: "Retornar",
            resolve: "Resolver",
            reopen: "Reabrir",
            accept: "Aceptar",
            rating: "Enviar Evaluación",
            enableIntegration: "Habilitar integración",
            disableIntegration: "Deshabilitar integración",
            logTicket: "Logs del Ticket",
            requiredTag: "Debes asignar una etiqueta antes de cerrar el ticket."
          }
        }
      },
      messagesInput: {
        placeholderPrivateMessage: "Escribe un mensaje o aprieta / para respuestas rápidas",
        placeholderOpen: "Escribe un mensaje o aprieta / para respuestas rápidas",
        placeholderClosed: "Reabra o acepte este ticket para enviar un mensaje.",
        signMessage: "Assinar",
        privateMessage: "Mensaje Privado"
      },
      contactDrawer: {
        header: "Datos del contacto",
        buttons: {
          edit: "Editar contacto",
          block: "Bloquear",
          unblock: "Desbloquear"
        },
        extraInfo: "Otras informaciones"
      },
      messageVariablesPicker: {
        label: "Variavéis disponibles",
        vars: {
          contactFirstName: "Primer Nombre",
          contactName: "Nombre",
          user: "Agente",
          greeting: "Saludo",
          protocolNumber: "Protocolo",
          date: "Fecha",
          hour: "Hora",
          ticket_id: "Nº de Llamada",
          queue: "Sector",
          connection: "Conexión"
        }
      },
      ticketOptionsMenu: {
        schedule: "Agendamento",
        delete: "Deletar",
        transfer: "Transferir",
        registerAppointment: "Observaciones del Contacto",
        resolveWithNoFarewell: "Finalizar sin despedida",
        acceptAudioMessage: "¿Aceptar audios del contacto?",
        appointmentsModal: {
          title: "Observaciones del Ticket",
          textarea: "Observación",
          placeholder: "Inserta aquí la información que deseas registrar"
        },
        confirmationModal: {
          title: "Deletar el ticket del contacto",
          titleFrom: "del contacto ",
          message: "¡Atención! Todas las mensajes relacionadas con el ticket se perderán."
        },
        buttons: {
          delete: "Excluir",
          cancel: "Cancelar"
        }
      },
      triggerFlowModal: {
        menuItem: "Disparar Flujo",
        title: "Disparar flujo en esta atención",
        selectLabel: "Flujo",
        selectRequired: "Seleccione un flujo para disparar",
        empty: "No hay flujos activos registrados para esta empresa.",
        alreadyInFlow:
          "Este ticket ya está ejecutando el flujo {{flow}}. Confirme para reemplazarlo por el flujo seleccionado.",
        draft: "borrador",
        confirm: "Disparar",
        confirmOverwrite: "Reemplazar y disparar",
        cancel: "Cancelar",
        success: "Flujo disparado con éxito"
      },
      confirmationModal: {
        buttons: {
          confirm: "Ok",
          cancel: "Cancelar"
        }
      },
      messageInput: {
        tooltip: {
          signature: "Habilitar/Deshabilitar Firma",
          privateMessage: "Habilitar/Deshabilitar Mensaje Privada",
          meet: "Enviar link para videoconferencia"
        },
        type: {
          imageVideo: "Fotos y vídeos",
          cam: "Cámara",
          contact: "Contacto",
          meet: "Vídeo llamada"
        }
      },
      messageOptionsMenu: {
        delete: "Deletar",
        reply: "Responder",
        edit: "Editar",
        forward: "Reenviar",
        toForward: "Reenviar",
        talkTo: "Conversar Con",
        react: "Reaccionar",
        confirmationModal: {
          title: "¿Apagar mensaje?",
          message: "Esta acción no se puede revertir."
        }
      },
      invoices: {
        table: {
          invoices: "Facturas",
          details: "Detalles",
          users: "Usuarios",
          connections: "Conexiones",
          queue: "Colas",
          value: "Valor",
          expirationDate: "Fecha Venc.",
          action: "Acción"
        }
      },
      metaTemplates: {
        title: "Plantillas Meta",
        subtitle: "Gestiona las plantillas de mensajes de la API Oficial de WhatsApp",
        searchPlaceholder: "Buscar plantilla...",
        selectConnection: "Conexión",
        buttons: {
          add: "Nueva Plantilla",
          sync: "Sincronizar",
          cancel: "Cancelar",
          save: "Guardar",
          edit: "Editar",
          delete: "Eliminar",
          newButton: "Agregar botón",
          addButton: "Agregar botón"
        },
        table: {
          name: "Nombre",
          language: "Idioma",
          category: "Categoría",
          status: "Estado",
          quality: "Calidad",
          reason: "Motivo",
          actions: "Acciones"
        },
        status: {
          APPROVED: "Aprobada",
          PENDING: "Pendiente",
          IN_REVIEW: "En revisión",
          REJECTED: "Rechazada",
          PAUSED: "Pausada",
          DISABLED: "Deshabilitada",
          FLAGGED: "Marcada",
          ARCHIVED: "Archivada",
          DELETED: "Eliminada",
          PENDING_DELETION: "Eliminación pendiente",
          IN_APPEAL: "En apelación",
          REINSTATED: "Restablecida",
          LOCKED: "Bloqueada",
          LIMIT_EXCEEDED: "Límite excedido"
        },
        category: {
          MARKETING: "Marketing",
          UTILITY: "Utilidad",
          AUTHENTICATION: "Autenticación"
        },
        form: {
          name: "Nombre de la plantilla",
          nameHelper: "Solo letras minúsculas, números y guiones bajos",
          category: "Categoría",
          language: "Idioma",
          parameterFormat: "Formato de parámetros",
          positional: "Posicional",
          named: "Nombrado",
          headerType: "Tipo de encabezado",
          headerNone: "Ninguno",
          headerText: "Texto",
          headerImage: "Imagen",
          headerVideo: "Video",
          headerDocument: "Documento",
          headerFile: "Archivo",
          body: "Cuerpo del mensaje",
          bodyHelper: "Usa {{1}}, {{2}}... para variables posicionales",
          footer: "Pie de página",
          variables: "Variables",
          exampleFor: "Ejemplo para",
          buttons: "Botones",
          buttonType: "Tipo de botón",
          quickReply: "Respuesta rápida",
          urlButton: "Botón de URL",
          url: "URL",
          urlExample: "Ejemplo de URL",
          phoneButton: "Botón de teléfono",
          phoneNumber: "Número de teléfono",
          copyCode: "Copiar código",
          copyExample: "Ejemplo de código",
          buttonText: "Texto del botón",
          ttl: "TTL (tiempo de vida)",
          ttlHelper: "Tiempo en segundos para que el mensaje expire",
          preview: "Vista previa",
          submitting: "Enviando..."
        },
        modal: {
          createTitle: "Crear Plantilla",
          editTitle: "Editar Plantilla"
        },
        toasts: {
          created: "¡Plantilla creada con éxito!",
          updated: "¡Plantilla actualizada con éxito!",
          deleted: "¡Plantilla eliminada con éxito!",
          synced: "¡Plantillas sincronizadas con éxito!"
        },
        confirm: {
          deleteTitle: "Eliminar plantilla",
          deleteMessage:
            "¿Estás seguro de que deseas eliminar esta plantilla? Esta acción no se puede revertir.",
          deleteWarning30d:
            "Atención: las plantillas eliminadas no pueden recrearse con el mismo nombre durante 30 días."
        },
        errors: {
          noOfficialConnection:
            "No se encontró ninguna conexión oficial. Configura una conexión con la API Oficial de Meta.",
          staleCache:
            "Los datos mostrados pueden estar desactualizados. Haz clic en Sincronizar para actualizar."
        },
        empty: "No se encontraron plantillas."
      },
      metaAutomations: {
        title: "Automatizaciones Meta",
        subtitle:
          "Reglas automáticas para comentarios, menciones y DMs de Facebook/Instagram",
        newRule: "Nueva regla",
        searchPlaceholder: "Buscar regla...",
        stats: {
          rules: "Reglas",
          active: "Activas",
          inactive: "Inactivas",
          dispatches: "Disparos",
        },
        filters: {
          status: "Estado",
          channel: "Canal",
          all: "Todos",
          active: "Activas",
          inactive: "Inactivas",
        },
        channels: {
          facebook: "Facebook",
          instagram: "Instagram",
          both: "Facebook + Instagram",
        },
        triggers: {
          comment_keyword: "Comentario con palabra clave",
          comment_any: "Cualquier comentario",
          story_mention: "Mención en story",
          referral_ref: "Enlace m.me con ref",
          dm_keyword: "DM con palabra clave",
        },
        table: {
          name: "Nombre",
          channel: "Canal",
          trigger: "Disparador",
          target: "Objetivo",
          action: "Acción",
          dispatches: "Disparos",
          active: "Activa",
          actions: "Acciones",
        },
        actionParts: {
          publicReply: "Respuesta pública",
          autoLike: "Me gusta al comentario",
          followerCheck: "Solo seguidores",
          reward: "Recompensa",
          flow: "Flujo",
          flowNamed: "Flujo: {{name}}",
        },
        empty: {
          filtered: "No se encontraron reglas con estos filtros",
          none: "Aún no se creó ninguna regla de automatización",
          hint: "Crea una regla para responder comentarios y menciones automáticamente.",
        },
        toasts: {
          created: "Regla de automatización creada",
          updated: "Regla de automatización actualizada",
          deleted: "Regla de automatización eliminada",
          activated: "Regla activada",
          deactivated: "Regla desactivada",
        },
        confirm: {
          deleteTitle: '¿Eliminar la regla "{{name}}"?',
          deleteMessage: "Esta acción no se puede deshacer.",
        },
        actions: {
          edit: "Editar",
          delete: "Eliminar",
        },
        modal: {
          createTitle: "Nueva regla de automatización",
          editTitle: "Editar regla de automatización",
          name: "Nombre de la regla",
          connection: "Conexión",
          connectionEmpty: "No se encontró ninguna conexión de Facebook/Instagram.",
          selectConnection: "Selecciona una conexión",
          channel: "Canal",
          trigger: "Disparador",
          required: "Obligatorio",
          matchValueLabels: {
            comment_keyword: "Palabra clave",
            dm_keyword: "Palabra clave",
            referral_ref: "Ref del enlace",
            story_mention: "ID del post/media (opcional)",
          },
          actionsSection: "Acciones",
          dmMessage: "Mensaje de DM",
          dmHint: "Variables disponibles: {{contact.name}} — opcional si hay un flujo seleccionado.",
          rewardUrl: "URL del medio de recompensa",
          rewardType: "Tipo de medio",
          rewardTypes: {
            image: "Imagen",
            video: "Video",
            audio: "Audio",
            file: "Archivo",
          },
          rewardHint:
            "Recompensa enviada por DM (imagen/video/archivo). En respuestas a comentarios, Meta solo permite un mensaje de texto — el medio se envía como enlace.",
          publicReply: "Respuesta pública al comentario",
          flow: "Flujo (FlowBuilder)",
          flowNone: "Ninguno",
          autoLike: "Dar me gusta al comentario automáticamente",
          autoLikeHint:
            "El me gusta requiere el permiso instagram_manage_engagement (IG) o pages_manage_engagement (FB).",
          requireFollower: "Exigir que el remitente siga la cuenta",
          requireFollowerHint:
            "La verificación de seguidor solo existe en Instagram. En Facebook no es posible verificar y la regla continúa normalmente.",
          nonFollowerAction: "Si no es seguidor",
          nonFollowerSkip: "No enviar nada",
          nonFollowerAsk: "Pedir que siga la cuenta",
          nonFollowerText: "Mensaje pidiendo el follow",
          active: "Regla activa",
          cancel: "Cancelar",
          save: "Guardar",
          create: "Crear regla",
          validationAction:
            "Define al menos una acción: mensaje de DM, medio, respuesta pública o flujo.",
        },
      },
      apiDocs: {
        title: "API Externa",
        subtitle:
          "Documentación y playground de los endpoints expuestos por la API externa (autenticación por token Bearer).",
        instructionsTitle: "Instrucciones",
        instructionsBody:
          "Utilice el token de la empresa (COMPANY_TOKEN) como Bearer en todas las llamadas. En desarrollo, registre el mismo token en la conexión en 'Conexiones' > editar. El número no debe tener máscara ni caracteres especiales: Código de País + DDD + Número (ej.: 5511999999999).",
        tokenLabel: "Token de la API (COMPANY_TOKEN)",
        copyToken: "Copiar token",
        copied: "¡Copiado!",
        tabs: {
          messages: "Mensajes",
          contacts: "Contactos",
          admin: "Administración",
          history: "Historial",
        },
        labels: {
          requestExample: "Ejemplo de Solicitud",
          testRequest: "Probar",
          sending: "Enviando...",
          response: "Respuesta",
          status: "Estado",
          duration: "Tiempo",
          required: "obligatorio",
          bodyJson: "Body (JSON)",
          invalidJson: "JSON del body inválido",
          chooseFile: "Elegir archivo",
          emptyHistory: "Ninguna solicitud ejecutada en esta sesión.",
          clearHistory: "Limpiar historial",
          adminWarning:
            "Endpoints administrativos globales (mismo COMPANY_TOKEN). Úselos con precaución: las acciones de escritura afectan a todas las empresas.",
        },
        history: {
          time: "Hora",
          method: "Método",
          path: "Ruta",
          status: "Estado",
          duration: "Duración",
        },
        actions: {
          list: "Listar {{resource}}",
          show: "Detallar {{resource}}",
          create: "Crear {{resource}}",
          update: "Actualizar {{resource}}",
          delete: "Eliminar {{resource}}",
        },
        resources: {
          plans: "planes",
          companies: "empresas",
          helps: "ayuda",
          partners: "socios",
          invoices: "facturas",
          users: "usuarios",
        },
        endpoints: {
          sendText: {
            title: "Enviar mensaje de texto",
            description:
              "Crea/actualiza el contacto, abre o reutiliza el ticket y envía texto. Flags: sendSignature (prefija nombre del usuario), closeTicket (cierra tras enviar), noRegister (envía sin crear ticket).",
          },
          sendMedia: {
            title: "Enviar mensaje con multimedia",
            description:
              "Mismo endpoint de texto, en multipart/form-data. Campo de archivo: 'medias'. 'body' se convierte en la leyenda.",
          },
          sendLinkImage: {
            title: "Enviar imagen por URL",
            description:
              "Envía imagen desde una URL pública ('url' + 'caption') y cierra el ticket al final.",
          },
          checkNumber: {
            title: "Verificar número en WhatsApp",
            description:
              "Devuelve existsInWhatsapp, number y numberFormatted (JID) si el número existe en WhatsApp.",
          },
          whatsapps: {
            title: "Listar conexiones",
            description:
              "Devuelve las conexiones WhatsApp de la empresa: id, nombre, estado, número y si es la conexión predeterminada.",
          },
          syncContact: {
            title: "Sincronizar contacto",
            description:
              "Crea o actualiza contacto (companyId obligatorio en el body). Acepta 'tagIds' (array) o 'tags' (nombres separados por coma) y 'silentMode'.",
          },
          deleteContact: {
            title: "Eliminar contacto",
            description:
              "Elimina el contacto por ID. companyId obligatorio (query o body).",
          },
        },
        toasts: {
          success: "¡Solicitud ejecutada con éxito!",
          error: "Error en la solicitud. Verifique la respuesta abajo.",
        },
      },
      backendErrors: {
        ERR_NO_OTHER_WHATSAPP: "Debe haber al menos un WhatsApp predeterminado.",
        ERR_NO_DEF_WAPP_FOUND: "Ningún WhatsApp predeterminado encontrado. Verifique la página de conexiones.",
        ERR_WAPP_NOT_INITIALIZED: "Esta sesión de WhatsApp no fue inicializada. Verifique la página de conexiones.",
        ERR_WAPP_CHECK_CONTACT: "No fue posible verificar el contacto de WhatsApp. Verifique la página de conexiones",
        ERR_WAPP_INVALID_CONTACT: "Este no es un número de Whatsapp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA: "No fue posible descargar medios de WhatsApp. Verifique la página de conexiones.",
        ERR_INVALID_CREDENTIALS: "Error de autenticación. Por favor, intente nuevamente.",
        ERR_SENDING_WAPP_MSG: "Error al enviar mensaje de WhatsApp. Verifique la página de conexiones.",
        ERR_DELETE_WAPP_MSG: "No fue posible eliminar el mensaje de WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Ya existe un tíquete abierto para este contacto.",
        ERR_SESSION_EXPIRED: "Sesión expirada. Por favor, inicie sesión.",
        ERR_USER_CREATION_DISABLED: "La creación de usuario fue deshabilitada por el administrador.",
        ERR_NO_PERMISSION: "No tiene permiso para acceder a este recurso.",
        ERR_DUPLICATED_CONTACT: "Ya existe un contacto con este número.",
        ERR_NO_SETTING_FOUND: "Ninguna configuración encontrada con este ID.",
        ERR_NO_CONTACT_FOUND: "Ningún contacto encontrado con este ID.",
        ERR_NO_TICKET_FOUND: "Ningún tíquete encontrado con este ID.",
        ERR_NO_USER_FOUND: "Ningún usuario encontrado con este ID.",
        ERR_NO_WAPP_FOUND: "Ningún WhatsApp encontrado con este ID.",
        ERR_CREATING_MESSAGE: "Error al crear mensaje en la base de datos.",
        ERR_CREATING_TICKET: "Error al crear tíquete en la base de datos.",
        ERR_FETCH_WAPP_MSG: "Error al buscar el mensaje en WhatsApp, tal vez sea demasiado antiguo.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS: "Esta color ya está en uso, elija otra.",
        ERR_WAPP_GREETING_REQUIRED: "El mensaje de bienvenida es obligatorio cuando hay más de una cola.",
        ERR_OUT_OF_HOURS: "¡Fuera del Horario de Expediente! ",
        ERR_TICKET_CLOSED: "Este ticket ya está cerrado.",
        ERR_FLOW_INVALID_ID: "Flujo inválido.",
        ERR_FLOW_NOT_FOUND: "Flujo no encontrado.",
        ERR_FLOW_INACTIVE: "Este flujo está inactivo.",
        ERR_FLOW_EMPTY: "Este flujo no tiene bloques.",
        ERR_TICKET_ALREADY_IN_FLOW:
          "Este ticket ya está ejecutando un flujo.",
        ERR_FLOW_NOT_ALLOWED_FOR_GROUP:
          "No es posible disparar un flujo en grupos.",
        ERR_FLOW_CHANNEL_NOT_SUPPORTED:
          "El canal de este ticket no admite disparo de flujo.",
        ERR_FLOW_TRIGGER_FAILED: "Error al ejecutar el flujo en este ticket.",
        ERR_TELEGRAM_INVALID_TOKEN:
          "Token de bot de Telegram inválido. Verifique el token generado por @BotFather.",
        ERR_TELEGRAM_SETUP_FAILED:
          "No se pudo registrar el webhook en Telegram. Inténtelo de nuevo.",
        ERR_TELEGRAM_SEND_FAILED:
          "Error al enviar el mensaje por Telegram.",
        ERR_TELEGRAM_NOT_CONFIGURED:
          "Esta conexión de Telegram no tiene token de bot configurado.",
        ERR_TELEGRAM_INVALID_CONTACT:
          "Contacto del ticket sin chat_id de Telegram válido.",
        ERR_TELEGRAM_NO_BACKEND_URL:
          "BACKEND_URL no configurado en el servidor — necesario para el webhook.",
        ERR_WAPP_NOT_TELEGRAM: "Esta conexión no es del canal Telegram."
      }
    },
    // WhatsApp Embedded Signup — alta del número oficial vía popup de Meta
    embeddedSignup: {
      button: "Registrar número (Meta)",
      hint: "Registro oficial guiado por Meta — el número queda listo sin salir del CRM.",
      loading: "Conectando con Meta…",
      success: "¡Número registrado con éxito!",
      configMissing:
        "Registro vía Meta no disponible: configure REACT_APP_META_EMBEDDED_SIGNUP_CONFIG_ID en el frontend.",
      appIdMissing:
        "Registro vía Meta no disponible: configure REACT_APP_FACEBOOK_APP_ID en el frontend.",
      sdkError: "No se pudo cargar el SDK de Facebook. Verifique su conexión.",
      cancelled: "Registro cancelado o no completado en Meta.",
      noSessionInfo:
        "Meta no devolvió los datos del número (waba_id/phone_number_id). Intente de nuevo.",
    },
    // Webchat público (/webchat/:token) — página sin login para visitantes
    publicWebchat: {
      title: "Atención en línea",
      subtitle: "Hable con nosotros en tiempo real",
      askName: "Para comenzar, ingrese su nombre:",
      nameLabel: "Su nombre",
      start: "Iniciar conversación",
      inputPlaceholder: "Escriba su mensaje...",
      invalidLink: "Enlace de atención inválido o expirado.",
      copyLink: "Copiar enlace del WebChat",
      linkCopied: "¡Enlace del WebChat copiado!",
    },
    // Canal Telegram Bot — conexión vía webhook registrado en la Bot API
    telegram: {
      title: "Bot de Telegram",
      botTokenLabel: "Token del bot",
      botTokenHelper:
        "Pegue el token generado por @BotFather. Al guardar, el webhook se registra automáticamente en Telegram.",
      botTokenHelperEdit:
        "Déjelo en blanco para mantener el token actual. Para cambiar de bot, pegue el nuevo token — el webhook se registrará de nuevo.",
      botTokenRequired:
        "Ingrese el token del bot de Telegram (generado por @BotFather).",
      setupSuccess: "¡Bot de Telegram conectado con éxito!",
    },
    // Nodo "Google Agenda" del FlowBuilder — crea evento en Google Calendar
    googleCalendarModal: {
      titleAdd: "Agregar evento de Google Calendar al flujo",
      titleEdit: "Editar evento de Google Calendar",
      add: "Agregar",
      save: "Guardar",
      fields: {
        summary: "Título del evento",
        startAt: "Fecha/hora de inicio (opcional)",
        startOffsetMinutes: "Anticipación en minutos",
        durationMinutes: "Duración (minutos)",
        description: "Descripción",
        location: "Ubicación (opcional)",
        attendees: "Participantes (e-mails, opcional)",
      },
      helpers: {
        variables: "Use {{variables}} para interpolar datos del contacto (ej.: {{name}})",
        startAt: "Formatos aceptados: ISO (2025-01-30T14:00) o DD/MM/AAAA HH:mm. Vacío usa la anticipación de abajo",
        startOffset: "Se usa cuando la fecha/hora de inicio está vacía — minutos a partir de ahora",
        attendees: "Separe por comas. Vacío usa el e-mail del contacto",
      },
      errors: {
        summaryRequired: "Ingrese el título del evento",
      },
    },
  }
};

export { messages };
