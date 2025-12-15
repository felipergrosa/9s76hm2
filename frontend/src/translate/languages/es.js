const messages = {
  es: {
    translations: {

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
          greetingMessage: "Mensaje de bienvenida",
          complationMessage: "Mensaje de conclusión",
          outOfHoursMessage: "Mensaje de fuera de horario de atención",
          token: "Token",
          integrationId: "Integración",
          fileListId: "Lista de archivos",
          closeTicket: "Cerrar ticket",
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
          allowConnections: "Permitir acciones en las conexiones"
        },
        tabs: {
          general: "General",
          permissions: "Permisos"
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
          management: "Gerencia"
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
          geral: "Permitir editar",
          add: "Agregar",
          edit: "Editar",
          visao: "Permitir visión"
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
        }
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
        toasts: {
          success: "Operación realizada con éxito",
          cancel: "Campaña cancelada",
          restart: "Campaña reiniciada",
          deleted: "Registro excluido"
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
            DirectTicketsToWallets: "Mover automáticamente cliente para cartera",
            showNotificationPending: "Mostrar notificación para tickets pendientes"
          },
          customMessages: {
            sendQueuePositionMessage: "Mensaje de posición en la cola",
            AcceptCallWhatsappMessage: "Mensaje para informar que no acepta llamadas",
            greetingAcceptedMessage: "Mensaje de Saludo al aceptar ticket",
            transferMessage: "Mensaje de transferencia fila destino"
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
        ERR_OUT_OF_HOURS: "¡Fuera del Horario de Expediente!"
      }
    }
  }
};

export { messages };
