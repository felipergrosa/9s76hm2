const messages = {
  tr: {
    translations: {
      signup: {
        title: "Kaydol",
        toasts: {
          success: "Kullanıcı başarıyla oluşturuldu! Giriş yapın!!!",
          fail: "Kullanıcı oluşturulurken hata oluştu. Lütfen girilen verileri kontrol edin.",
        },
        form: {
          name: "Ad",
          email: "E-posta",
          password: "Şifre",
          company: "Organizasyon Adı",
          phone: "Whatsapp (Alan Kodu + Numara)",
        },
        buttons: {
          submit: "Kaydol",
          login: "Zaten bir hesabınız var mı? Giriş yapın!",
        },
      },
      login: {
        title: "Giriş",
        form: {
          email: "E-posta",
          password: "Şifre",
          button: "Erişim",
        },
        buttons: {
          submit: "Giriş Yap",
          register: "Hesabınız yok mu? Kaydolun!",
        },
      },
      companies: {
        title: "Şirket Kaydet",
        form: {
          name: "Şirket Adı",
          plan: "Plan",
          token: "Token",
          submit: "Kaydet",
          success: "Şirket başarıyla oluşturuldu!",
        },
      },
      auth: {
        toasts: {
          success: "Başarılı giriş!",
        },
        dueDate: {
          expiration: "Aboneliğiniz sona eriyor",
          days: "gün!",
          day: "gün!",
          expirationToday: "Aboneliğiniz bugün sona eriyor!",
        },
        token: "Token",
      },
      dashboard: {
        title: "Kontrol Paneli",
        tabs: {
          indicators: "Göstergeler",
          assessments: "NPS",
          attendants: "Katılımcılar",
          performance: "Performanslar"
        },
        charts: {
          performance: "Grafikler",
          userPerformance: "Kullanıcı Grafikleri",
          perDay: {
            title: "Bugünkü Görüşmeler: ",
          },
        },
        cards: {
          inAttendance: "Görüşmede",
          waiting: "Bekliyor",
          activeAttendants: "Aktif Katılımcılar",
          finalized: "Tamamlandı",
          newContacts: "Yeni Kişiler",
          totalReceivedMessages: "Alınan Mesajlar",
          totalSentMessages: "Gönderilen Mesajlar",
          averageServiceTime: "Ort. Hizmet Süresi",
          averageWaitingTime: "Ort. Bekleme Süresi",
          status: "Durum (Güncel)",
          activeTickets: "Aktif Ticketlar",
          passiveTickets: "Pasif Ticketlar",
          groups: "Gruplar",
        },
        users: {
          name: "Ad",
          numberAppointments: "Görüşme Sayısı",
          statusNow: "Şu Anki Durum",
          totalCallsUser: "Kullanıcı Başına Toplam Görüşme",
          totalAttendances: "Toplam Görüşme",
          queues: "Sıralar",
          defaultQueue: "Varsayılan Bağlantı",
          workingHours: "Çalışma Saatleri",
          startWork: "Çalışma Başlangıcı",
          endWork: "Çalışma Sonu",
          farewellMessage: "Veda Mesajı",
          theme: "Varsayılan Tema",
          menu: "Varsayılan Menü"
        },
        date: {
          initialDate: "Başlangıç Tarihi",
          finalDate: "Bitiş Tarihi",
        },
        licence: {
          available: "Şuna Kadar Mevcut",
        },
        assessments: {
          totalCalls: "Toplam Görüşme",
          callsWaitRating: "Değerlendirme Bekleyen Görüşmeler",
          callsWithoutRating: "Değerlendirilmemiş Görüşmeler",
          ratedCalls: "Değerlendirilen Görüşmeler",
          evaluationIndex: "Değerlendirme Endeksi",
          score: "Puan",
          prosecutors: "Destekleyiciler",
          neutral: "Tarafsızlar",
          detractors: "Kötüleyenler",
        },
      },
      reports: {
        title: "Yapılan Anket Raporu",
        operator: "Operatör",
        period: "Dönem",
        until: "Şu Ana Kadar",
        date: "Tarih",
        reportTitle: "Raporlar",
        calls: "Görüşmeler",
        search: "Aramalar",
        durationCalls: "Görüşme Süreleri",
        grupoSessions: "Grup Görüşmeleri",
        groupTicketsReports: {
          timezone: "America/Sao_Paulo",
          msgToast: "Sıkıştırılmış rapor oluşturuluyor, lütfen bekleyin.",
          errorToast: "Rapor oluşturulurken hata oluştu",
          back: "Geri",
          groupServiceReport: "Grup Hizmet Raporu",
          loading: "Yükleniyor...",
          contact: "Kişi",
          dateOpen: "Açılış Tarihi",
          dateLastUpdated: "Son Güncelleme Tarihi",
          agent: "Kim Görüşme Yaptı",
          agentClosed: "Kim Kapattı",
          waitingAssistance: "Yardım Bekliyor",
          process: "Görüşmede",
        },
        researchReports: {
          response: "cevap",
          active: "(Aktif)",
          inactive: "(Pasif)",
          quantity: "Miktar",
          percentage: "yüzde",
          title: "Yapılan Anket Raporu",
          activeSearch: "Aktif Arama",
          inactiveSearch: "Pasif Arama",
        },
        ticketDurationDetail: {
          msgToast: "Sıkıştırılmış rapor oluşturuluyor, lütfen bekleyin.",
          title: "Görüşme Süresi Raporu",
          startService: "Hizmet Başlangıcı",
          lastUpdated: "Son Güncelleme",
          lastAgent: "Son Katılımcı",
          durationFinished: "Tamamlandıktan Sonraki Süre",
        },
        ticketDuration: {
          title: "Görüşme Süresi Raporu",
          contact: "Kişi",
          open: "Açık",
          pending: "Beklemede",
          finished: "Tamamlandı",
          durationFinished: "Tamamlananların Süresi",
          durationAfterFinished: "Tamamlandıktan Sonraki Süre",
          actions: "Eylemler",
        },
        ticketReports: {
          msgToast: "Sıkıştırılmış rapor oluşturuluyor, lütfen bekleyin.",
          title: "Hizmet Raporu",
        },
        pdf: {
          title: "Yapılan Görüşmeler Listesi",
          exportTitle: "Yapılan Grup Görüşmeleri Listesi",
        },
      },
      todo: {
        newTask: "Yeni Görev",
        add: "Ekle",
        task: "Görevler",
      },
      contactImportWpModal: {
        title: "Kişileri Excel'e Aktar",
        buttons: {
          downloadModel: "Kişi içe aktarma için excel modelini indir",
          closed: "Kapat",
          import: "Kişileri içe aktarmak için excel dosyasını seçin",
        },
      },
      connections: {
        title: "Bağlantılar",
        waitConnection: "Bekleyin... Bağlantılarınız yeniden başlatılıyor!",
        newConnection: "Yeni Bağlantı",
        restartConnections: "Bağlantıları Yeniden Başlat",
        callSupport: "Destek Çağır",
        toasts: {
          deleted: "Bağlantı başarıyla silindi!",
          closedimported:
            "İçe aktarılan ticketlar kapatılıyor, lütfen birkaç dakika bekleyin",
        },
        confirmationModal: {
          closedImportedTitle: "İçe aktarılan ticketları kapat",
          closedImportedMessage:
            "Onaylarsanız içe aktarılan tüm ticketlar kapatılacaktır",
          deleteTitle: "Sil",
          deleteMessage: "Emin misiniz? Bu işlem geri alınamaz.",
          disconnectTitle: "Bağlantıyı Kes",
          disconnectMessage:
            "Emin misiniz? QR Kodu tekrar okutmanız gerekecek.",
        },
        buttons: {
          add: "Bağlantı Ekle",
          disconnect: "Bağlantıyı Kes",
          tryAgain: "Tekrar Dene",
          qrcode: "QR KODU",
          newQr: "Yeni QR KODU",
          closedImported: "Tüm İçe Aktarılan Ticketları Kapat",
          preparing: "İçe aktarma için mesajlar hazırlanıyor",
          importing: "WhatsApp Mesajları İçe Aktarılıyor",
          processed: "İşlendi",
          in: "içinde",
          connecting: "Bağlanıyor",
        },
        typography: {
          processed: "İşlendi",
          in: "içinde",
          date: "Mesaj Tarihi",
        },
        toolTips: {
          disconnected: {
            title: "WhatsApp oturumu başlatılamadı",
            content:
              "Cep telefonunuzun internete bağlı olduğundan emin olun ve tekrar deneyin veya yeni bir QR Kodu isteyin",
          },
          qrcode: {
            title: "QR Kod okuması bekleniyor",
            content:
              "Oturumu başlatmak için 'QR KODU' düğmesine tıklayın ve QR Kodu cep telefonunuzla okutun",
          },
          connected: {
            title: "Bağlantı kuruldu!",
          },
          timeout: {
            title: "Cep telefonuyla bağlantı kesildi",
            content:
              "Cep telefonunuzun internete bağlı olduğundan ve WhatsApp'ın açık olduğundan emin olun veya yeni bir QR Kodu almak için 'Bağlantıyı Kes' düğmesine tıklayın",
          },
        },
        table: {
          name: "Ad",
          status: "Durum",
          lastUpdate: "Son Güncelleme",
          default: "Varsayılan",
          actions: "Eylemler",
          session: "Oturum",
          number: "WhatsApp Numarası",
        },
      },
      showTicketOpenModal: {
        title: {
          header: "Mevcut Görüşme",
        },
        form: {
          message: "Bu kişi zaten görüşmede:",
          user: "Katılımcı",
          queue: "Sıra",
          messageWait:
            "Bu kişi zaten görüşme bekliyor. Beklemede sekmesine bakın!",
        },
      },
      showTicketLogModal: {
        title: {
          header: "Loglar",
        },
        options: {
          create: "Ticket oluşturuldu.",
          chatBot: "ChatBot başlatıldı.",
          queue: " - Sıra tanımlandı.",
          open: " görüşmeyi başlattı.",
          access: "ticketa erişti.",
          transfered: "ticketi transfer etti.",
          receivedTransfer: "transfer edilen ticketi aldı.",
          pending: "sırayı geri verdi.",
          closed: "ticketi kapattı",
          reopen: "ticketi yeniden açtı",
          redirect: "- yeniden yönlendirildi"
        },
      },
      whatsappModal: {
        title: {
          add: "Bağlantı Ekle",
          edit: "Bağlantıyı Düzenle",
        },
        tabs: {
          general: "Genel",
          messages: "Mesajlar",
          assessments: "NPS",
          integrations: "Entegrasyonlar",
          schedules: "Çalışma Saatleri",
        },
        form: {
          importOldMessagesEnable: "Cihazdan mesajları içe aktar",
          importOldMessages: "İçe Aktarma Başlangıç Tarihi",
          importRecentMessages: "İçe Aktarma Bitiş Tarihi",
          importOldMessagesGroups: "Grup mesajlarını içe aktar",
          closedTicketsPostImported: "İçe aktarıldıktan sonra ticketları kapat",
          name: "Ad",
          queueRedirection: "Sıra Yönlendirme",
          queueRedirectionDesc:
            "Sırası olmayan kişilerin yönlendirileceği bir sıra seçin",
          default: "Varsayılan",
          group: "Gruplara İzin Ver",
          timeSendQueue: "Sıraya yönlendirmek için dakika cinsinden süre",
          importAlert:
            "DİKKAT: Kaydedildiğinde bağlantınız sonlandırılacak, mesajları içe aktarmak için QR Kodu tekrar okumanız gerekecektir",
          groupAsTicket: "Grupları ticket olarak ele al",
          timeCreateNewTicket: "Yeni ticketı x dakika içinde oluştur",
          maxUseBotQueues: "Botu x kez gönder",
          timeUseBotQueues: "Botu x dakika içinde gönder",
          expiresTicket: "Açık sohbetleri x dakika sonra kapat",
          expiresTicketNPS:
            "Değerlendirme bekleyen sohbetleri x dakika sonra kapat",
          maxUseBotQueuesNPS:
            "Değerlendirme gönderme sayısı maksimum",
          closeLastMessageOptions1: "Katılımcı/Müşteri",
          closeLastMessageOptions2: "Katılımcı",
          outOfHoursMessage: "Çalışma Saati Dışı Mesajı",
          greetingMessage: "Karşılama Mesajı",
          complationMessage: "Tamamlama Mesajı",
          lgpdLinkPrivacy: "Gizlilik Politikası Bağlantısı",
          lgpdMessage: "LGPD Karşılama Mesajı",
          lgpdDeletedMessages: "Kişi tarafından silinen mesajları karart",
          lgpdSendMessage: "Her zaman kişiden onay iste",
          ratingMessage: "Değerlendirme Mesajı - Ölçek 0-10 olmalıdır",
          token: "Harici entegrasyon için Token",
          sendIdQueue: "Sıra",
          inactiveMessage: "Etkin Olmayan Mesaj",
          timeInactiveMessage:
            "Etkin olmama uyarısı göndermek için dakika cinsinden süre",
          whenExpiresTicket:
            "Son mesaj olduğunda açık sohbetleri kapat",
          expiresInactiveMessage: "Etkin olmama nedeniyle kapatma mesajı",
          prompt: "Komut",
          collectiveVacationEnd: "Bitiş Tarihi",
          collectiveVacationStart: "Başlangıç Tarihi",
          collectiveVacationMessage: "Toplu Tatil Mesajı",
          queueIdImportMessages: "Mesajları içe aktarmak için sıra"
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
        },
        menuItem: {
          enabled: "Etkin",
          disabled: "Devre Dışı",
          minutes: "dakika",
        },
        success: "Bağlantı başarıyla kaydedildi.",
        errorSendQueue:
          "Sırayı yönlendirmek için süre belirtildi, ancak yönlendirilecek bir sıra seçilmedi. Her iki alan da doldurulmalıdır",
        errorExpiresNPS:
          "NPS kullanırken değerlendirme süresi bildirmek zorunludur.",
        errorRatingMessage:
          "NPS kullanırken değerlendirme mesajı bildirmek zorunludur.",
      },
      qrCode: {
        message: "Oturumu başlatmak için QR Kodu okutun",
      },
      contacts: {
        title: "Kişiler",
        toasts: {
          deleted: "Kişi başarıyla silindi!",
        },
        searchPlaceholder: "Ara...",
        confirmationModal: {
          deleteTitle: "Sil ",
          importTitlte: "Kişileri içe aktar",
          exportContact: "Kişileri dışa aktar",
          deleteMessage:
            "Bu kişiyi silmek istediğinizden emin misiniz? İlgili tüm görüşmeler kaybolacaktır.",
          blockContact: "Bu kişiyi engellemek istediğinizden emin misiniz?",
          unblockContact: "Bu kişinin engellemesini kaldırmak istediğinizden emin misiniz?",
          importMessage: "Telefondaki tüm kişileri içe aktarmak ister misiniz?",
          importChat: "Sohbetleri İçe Aktar",
          wantImport: "Telefondaki tüm sohbetleri içe aktarmak ister misiniz?",
        },
        buttons: {
          import: "Kişileri İçe Aktar",
          add: "Kişi Ekle",
          export: "Kişiyi Dışa Aktar",
        },
        table: {
          name: "Ad",
          whatsapp: "Bağlantı",
          email: "E-posta",
          actions: "Eylemler",
          lastMessage: "Son Mesaj",
        },
        menu: {
          importYourPhone: "Varsayılan telefondan içe aktar",
          importToExcel: "Excel'den İçe Aktar / Dışa Aktar",
        },
      },
      forwardMessage: {
        text: "İletildi",
      },
      forwardMessageModal: {
        title: "Mesajı ilet",
        buttons: {
          ok: "İlet",
        },
      },
      promptModal: {
        form: {
          name: "Ad",
          prompt: "Komut",
          voice: "Ses",
          max_tokens: "Yanıtlamada Maksimum Token",
          temperature: "Sıcaklık",
          apikey: "API Anahtarı",
          max_messages: "Geçmişteki Maksimum Mesaj",
          voiceKey: "Ses API Anahtarı",
          voiceRegion: "Ses Bölgesi",
        },
        success: "Komut başarıyla kaydedildi!",
        title: {
          add: "Komut Ekle",
          edit: "Komutu Düzenle",
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
        },
      },
      prompts: {
        title: "Komutlar",
        table: {
          name: "Ad",
          queue: "Sektör/Sıra",
          max_tokens: "Maksimum Token Yanıtı",
          actions: "Eylemler",
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage: "Emin misiniz? Bu işlem geri alınamaz!",
        },
        buttons: {
          add: "Komut Ekle",
        },
      },
      contactModal: {
        title: {
          add: "Kişi Ekle",
          edit: "Kişiyi Düzenle",
        },
        form: {
          mainInfo: "Kişi Bilgileri",
          extraInfo: "Ek Bilgiler",
          name: "Ad",
          number: "WhatsApp Numarası",
          email: "E-posta",
          extraName: "Alan Adı",
          extraValue: "Değer",
          chatBotContact: "Chatbot'u devre dışı bırak",
          termsLGDP: "LGPD Şartları kabul edildi:",
          whatsapp: "Kaynak Bağlantı: "
        },
        buttons: {
          addExtraInfo: "Bilgi Ekle",
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
        },
        success: "Kişi başarıyla kaydedildi.",
      },
      flowbuilder: {
        title: "Flowbuilder",
        subMenus: {
          campaign: "Kampanya Akışı",
          conversation: "Sohbet Akışı"
        }
      },
      flowbuilderModal: {
        flowNotIdPhrase: "Varsayılan Akış",
      },
      queueModal: {
        title: {
          queueData: "Sıra Bilgileri",
          text: "Çalışma Saatleri",
          add: "Sıra Ekle",
          edit: "Sırayı Düzenle",
          confirmationDelete:
            "Emin misiniz? Tüm entegrasyon seçenekleri silinecektir.",
        },
        form: {
          name: "Ad",
          color: "Renk",
          orderQueue: "Sıra Sırası (Bot)",
          rotate: "Rotasyon",
          timeRotate: "Rotasyon Süresi",
          greetingMessage: "Karşılama Mesajı",
          complationMessage: "Tamamlama Mesajı",
          outOfHoursMessage: "Çalışma Saati Dışı Mesajı",
          token: "Token",
          integrationId: "Entegrasyon",
          fileListId: "Dosya Listesi",
          closeTicket: "Ticketı Kapat",
          queueType: "Menü Türü",
          message: "Yanıt Mesajı",
          queue: "Transfer Sırası",
          integration: "Entegrasyon",
          file: "Dosya",
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
        },
        bot: {
          title: "Seçenekler",
          toolTipTitle: "Bir chatbot oluşturmak için seçenekler ekleyin",
          toolTip:
            "Yalnızca bir seçenek varsa, otomatik olarak seçilecek, botun seçenek mesajıyla yanıt vermesine ve devam etmesine neden olacaktır",
          selectOption: "Bir Seçenek Seçin",
          text: "Metin",
          attendent: "Katılımcı",
          queue: "Sıra",
          integration: "Entegrasyon",
          file: "Dosya",
          toolTipMessageTitle:
            "Mesaj bir sonraki seviyeye geçmek için zorunludur",
          toolTipMessageContent:
            "Mesaj bir sonraki seviyeye geçmek için zorunludur",
          selectUser: "Bir Kullanıcı Seçin",
          selectQueue: "Bir Sıra Seçin",
          selectIntegration: "Bir Entegrasyon Seçin",
          addOptions: "Seçenekleri Ekle",
        },
        serviceHours: {
          dayWeek: "Haftanın Günü",
          startTimeA: "Başlangıç Saati - Vardiya A",
          endTimeA: "Bitiş Saati - Vardiya A",
          startTimeB: "Başlangıç Saati - Vardiya B",
          endTimeB: "Bitiş Saati - Vardiya B",
          monday: "Pazartesi",
          tuesday: "Salı",
          wednesday: "Çarşamba",
          thursday: "Perşembe",
          friday: "Cuma",
          saturday: "Cumartesi",
          sunday: "Pazar",
        },
      },
      queueIntegrationModal: {
        title: {
          add: "Proje Ekle",
          edit: "Projeyi Düzenle",
        },
        form: {
          id: "ID",
          type: "Tip",
          name: "Ad",
          projectName: "Proje Adı",
          language: "Dil",
          jsonContent: "Json İçeriği",
          urlN8N: "URL",
          typebotSlug: "Typebot - Slug",
          typebotExpires: "Bir konuşmanın sona ermesi için dakika cinsinden süre",
          typebotKeywordFinish: "Akışı sonlandırmak için anahtar kelime",
          typebotKeywordRestart: "Akışı yeniden başlatmak için anahtar kelime",
          typebotRestartMessage: "Konuşma yeniden başlatıldığında mesaj",
          typebotUnknownMessage: "Geçersiz seçenek mesajı",
          typebotDelayMessage: "Mesajlar arası gecikme (ms)",
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
          test: "Botu Test Et",
        },
        messages: {
          testSuccess: "Entegrasyon başarıyla test edildi!",
          addSuccess: "Entegrasyon başarıyla eklendi.",
          editSuccess: "Entegrasyon başarıyla düzenlendi.",
        },
      },
      userModal: {
        warning:
          "Mesajları içe aktarmak için QR kodu tekrar okumanız gerekiyor !!!",
        title: {
          add: "Kullanıcı Ekle",
          edit: "Kullanıcıyı Düzenle",
          updateImage: "Görüntüyü Güncelle",
          removeImage: "Görüntüyü Sil",
        },
        form: {
          name: "Ad",
          none: "Hiçbiri",
          email: "E-posta",
          password: "Şifre",
          farewellMessage: "Veda Mesajı",
          profile: "Profil",
          startWork: "Çalışma Başlangıcı",
          endWork: "Çalışma Sonu",
          whatsapp: "Varsayılan Bağlantı",
          allTicketEnable: "Etkin",
          allTicketDisable: "Devre Dışı",
          allTicket: "Sırasız çağrıları görüntüle",
          allowGroup: "Gruplara İzin Ver",
          defaultMenuOpen: "Açık",
          defaultMenuClosed: "Kapalı",
          defaultMenu: "Varsayılan Menü",
          defaultTheme: "Varsayılan Tema",
          defaultThemeDark: "Koyu",
          defaultThemeLight: "Açık",
          allHistoric: "Diğer sıralardaki konuşmaları gör",
          allHistoricEnabled: "Etkin",
          allHistoricDisabled: "Devre Dışı",
          allUserChat: "Diğer kullanıcıların sohbetlerini gör",
          userClosePendingTicket: "Bekleyen ticketları kapatmaya izin ver",
          showDashboard: "Kontrol Paneli Görüntüle",
          allowRealTime: "Gerçek Zamanlı Panel Görüntüle",
          allowConnections: "Bağlantılarda işlemlere izin ver",
        },
        tabs: {
          general: "Genel",
          permissions: "İzinler",
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
          addImage: "Görüntü Ekle",
          editImage: "Görüntüyü Düzenle",
        },
        success: "Kullanıcı başarıyla kaydedildi.",
      },
      companyModal: {
        title: {
          add: "Şirket Ekle",
          edit: "Şirketi Düzenle",
        },
        form: {
          name: "Ad",
          email: "E-posta",
          passwordDefault: "Şifre",
          numberAttendants: "Kullanıcılar",
          numberConections: "Bağlantılar",
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
        },
        success: "Şirket başarıyla kaydedildi.",
      },
      scheduleModal: {
        title: {
          add: "Yeni Randevu",
          edit: "Randevuyu Düzenle",
        },
        form: {
          body: "Mesaj",
          contact: "Kişi",
          sendAt: "Randevu Tarihi",
          sentAt: "Gönderme Tarihi",
          assinar: "İmza Gönder"
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
          addSchedule: "Randevu Ekle"
        },
        success: "Randevu başarıyla kaydedildi.",
      },
      tagModal: {
        title: {
          add: "Yeni Etiket",
          edit: "Etiketi Düzenle",
          addKanban: "Yeni Şerit",
          editKanban: "Şeridi Düzenle",
        },
        form: {
          name: "Ad",
          color: "Renk",
          timeLane: "Şeride yönlendirmek için saat cinsinden süre",
          nextLaneId: "Şerit",
          greetingMessageLane: "Şerit karşılama mesajı",
          rollbackLaneId: "Görüşmeye devam ettikten sonra şeride geri dön"
        },
        buttons: {
          okAdd: "Ekle",
          okEdit: "Kaydet",
          cancel: "İptal",
        },
        success: "Etiket başarıyla kaydedildi.",
        successKanban: "Şerit başarıyla kaydedildi.",
      },
      fileModal: {
        title: {
          add: "Dosya listesi ekle",
          edit: "Dosya listesini düzenle",
        },
        buttons: {
          okAdd: "Kaydet",
          okEdit: "Düzenle",
          cancel: "İptal",
          fileOptions: "Dosya ekle",
        },
        form: {
          name: "Dosya listesi adı",
          message: "Liste Detayları",
          fileOptions: "Dosya Listesi",
          extraName: "Dosya ile gönderilecek mesaj",
          extraValue: "Seçenek Değeri",
        },
        success: "Dosya listesi başarıyla kaydedildi!",
      },
      chat: {
        noTicketMessage: "Konuşmaya başlamak için bir ticket seçin.",
      },
      uploads: {
        titles: {
          titleUploadMsgDragDrop:
            "⬇️ DOSYALARI AŞAĞIDAKİ ALANA SÜRÜKLEYİN VE BIRAKIN ⬇️",
          titleFileList: "Dosya Listesi",
        },
      },
      chatInternal: {
        new: "Yeni",
        modal: {
          conversation: "Konuşma",
          title: "Başlık",
          filterUsers: "Kullanıcı Filtresi",
          cancel: "Kapat",
          save: "Kaydet",
        },
        modalDelete: {
          title: "Konuşmayı Sil",
          message: "Bu işlem geri alınamaz, onaylayın mı?",
        },
      },
      ticketsManager: {
        questionCloseTicket: "TÜM TICKETLARI KAPATMAK İSTİYOR MUSUNUZ?",
        yes: "EVET",
        not: "HAYIR",
        buttons: {
          newTicket: "Yeni",
          resolveAll: "Tümünü Çöz",
          close: "Kapat",
          new: "Yeni",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Sıralar",
      },
      tickets: {
        inbox: {
          closedAllTickets: "Tüm ticketları kapat?",
          closedAll: "Tümünü Kapat",
          newTicket: "Yeni Ticket",
          yes: "EVET",
          no: "HAYIR",
          open: "Açık",
          resolverd: "Çözüldü",
        },
        toasts: {
          deleted: "Görüşmede olduğunuz ticket silindi.",
        },
        notification: {
          message: "Mesaj",
        },
        tabs: {
          open: { title: "Açık" },
          closed: { title: "Çözüldü" },
          search: { title: "Ara" },
        },
        search: {
          placeholder: "Görüşme ve mesaj ara",
          filterConections: "Bağlantıya Göre Filtrele",
          filterConectionsOptions: {
            open: "Açık",
            closed: "Kapalı",
            pending: "Beklemede",
          },
          filterUsers: "Kullanıcıya Göre Filtrele",
          filterContacts: "Kişiye Göre Filtrele",
          ticketsPerPage: "Sayfa Başına Ticket",
        },
        buttons: {
          showAll: "Tümü",
          returnQueue: "Sıraya Geri Dön",
          scredule: "Randevu",
          deleteTicket: "Ticketı Sil",
        },
        closedTicket: {
          closedMessage: "Veda Mesajı ile Ticketı Kapat",
          closedNotMessage: "Veda Mesajı Olmadan Ticketı Kapat",
        },
      },
      transferTicketModal: {
        title: "Ticketı Transfer Et",
        fieldLabel: "Kullanıcı aramak için yazın",
        fieldQueueLabel: "Sıraya Transfer Et",
        fieldQueuePlaceholder: "Bir sıra seçin",
        fieldWhatsapp: "Bir whatsapp seçin",
        noOptions: "Bu isimle kullanıcı bulunamadı",
        msgTransfer: "Notlar - dahili mesaj, müşteriye gitmez",
        buttons: {
          ok: "Transfer Et",
          cancel: "İptal",
        },
      },
      ticketsList: {
        called: "Çağrıldı",
        today: "Bugün",
        missedCall: "Cevapsız sesli/görüntülü arama",
        pendingHeader: "Beklemede",
        assignedHeader: "Atanmış",
        groupingHeader: "Gruplar",
        noTicketsTitle: "Burada hiçbir şey yok!",
        noTicketsMessage:
          "Bu durum veya arama terimiyle ilgili hiçbir görüşme bulunamadı",
        noQueue: "Sıra Yok",
        buttons: {
          accept: "Kabul Et",
          cancel: "İptal Et",
          start: "başlat",
          closed: "Kapat",
          reopen: "Yeniden Aç",
          transfer: "Transfer Et",
          ignore: "Yoksay",
          exportAsPDF: "PDF olarak dışa aktar",
          kanbanActions: "Kanban Seçenekleri"
        },
        acceptModal: {
          title: "Sohbeti Kabul Et",
          queue: "Sektör Seç",
        },
      },
      newTicketModal: {
        title: "Ticket Oluştur",
        fieldLabel: "Kişiyi aramak için yazın",
        add: "Ekle",
        buttons: {
          ok: "Kaydet",
          cancel: "İptal",
        },
      },
      SendContactModal: {
        title: "Kişi Gönder",
        fieldLabel: "Kişiyi aramak için yazın",
        add: "Ekle",
        buttons: {
          ok: "Gönder",
          cancel: "İptal",
        },
      },
      mainDrawer: {
        listItems: {
          dashboard: "Kontrol Paneli",
          connections: "Bağlantılar",
          chatsTempoReal: "Panel",
          tickets: "Görüşmeler",
          quickMessages: "Hızlı Yanıtlar",
          contacts: "Kişiler",
          queues: "Sıralar ve Chatbot",
          flowbuilder: "Flowbuilder",
          tags: "Etiketler",
          administration: "Yönetim",
          companies: "Şirketler",
          users: "Kullanıcılar",
          settings: "Ayarlar",
          files: "Dosya Listesi",
          helps: "Yardım",
          messagesAPI: "API",
          schedules: "Randevular",
          campaigns: "Kampanyalar",
          annoucements: "Duyurular",
          chats: "Dahili Sohbet",
          financeiro: "Finansal",
          queueIntegration: "Entegrasyonlar",
          version: "Sürüm",
          kanban: "Kanban",
          prompts: "Talk.Ai",
          allConnections: "Bağlantıları yönet",
          reports: "Raporlar",
          management: "Yönetim"
        },
        appBar: {
          user: {
            profile: "Profil",
            logout: "Çıkış",
            message: "Merhaba",
            messageEnd: "hoş geldiniz",
            active: "Şu Tarihe Kadar Aktif",
            goodMorning: "Merhaba,",
            myName: "benim adım",
            continuity: "ve görüşmenizi ben devam ettireceğim.",
            virtualAssistant: "Sanal Asistan",
            token:
              "Geçersiz token, lütfen platform yöneticisiyle iletişime geçin.",
          },
          message: {
            location: "Konum",
            contact: "Kişi",
          },
          notRegister: "Kayıt Yok",
          refresh: "Yenile",
        },
      },
      languages: {
        undefined: "Dil",
        "pt-BR": "Portekizce",
        es: "İspanyolca",
        en: "İngilizce",
        tr: "Türkçe",
      },
      messagesAPI: {
        title: "Mesaj Gönderme için API",
        textMessage: {
          number: "Numara",
          body: "Mesaj",
          token: "Kayıtlı Token",
          userId: "Kullanıcı/Katılımcı ID'si",
          queueId: "Sıra ID'si",
        },
        mediaMessage: {
          number: "Numara",
          body: "Dosya Adı",
          media: "Dosya",
          token: "Kayıtlı Token",
        },
        API: {
          title: "Mesaj Gönderme Dokümantasyonu",
          methods: {
            title: "Gönderme Yöntemleri",
            messagesText: "Metin Mesajları",
            messagesMidia: "Medya Mesajları",
          },
          instructions: {
            title: "Talimatlar",
            comments: "Önemli Notlar",
            comments1:
              "Mesaj göndermeden önce, mesajları gönderecek bağlantıyla ilişkili tokenı kaydetmek gereklidir. <br />Kaydetmek için 'Bağlantılar' menüsüne gidin, bağlantının düzenle düğmesine tıklayın ve tokenı ilgili alana girin.",
            comments2:
              "Gönderilecek numara maske veya özel karakter içermemelidir ve şunlardan oluşmalıdır:",
            codeCountry: "Ülke Kodu",
            code: "Alan Kodu",
            number: "Numara",
          },
          text: {
            title: "1. Metin Mesajları",
            instructions:
              "Metin mesajları göndermek için gerekli bilgiler aşağıdadır:",
          },
          media: {
            title: "2. Medya Mesajları",
            instructions:
              "Metin mesajları göndermek için gerekli bilgiler aşağıdadır:",
          },
        },
      },
      notifications: {
        noTickets: "Bildirim yok.",
      },
      quickMessages: {
        title: "Hızlı Yanıtlar",
        searchPlaceholder: "Ara...",
        noAttachment: "Ek yok",
        confirmationModal: {
          deleteTitle: "Silme",
          deleteMessage: "Bu işlem geri alınamaz! Devam etmek ister misiniz?",
        },
        buttons: {
          add: "Ekle",
          attach: "Dosya Ekle",
          cancel: "İptal",
          edit: "Düzenle",
        },
        toasts: {
          success: "Kısayol başarıyla eklendi!",
          deleted: "Kısayol başarıyla kaldırıldı!",
        },
        dialog: {
          title: "Hızlı Mesaj",
          shortcode: "Kısayol",
          message: "Yanıt",
          save: "Kaydet",
          cancel: "İptal",
          geral: "Düzenlemeye izin ver",
          add: "Ekle",
          edit: "Düzenle",
          visao: "Görünüm izni ver",
        },
        table: {
          shortcode: "Kısayol",
          message: "Mesaj",
          actions: "Eylemler",
          mediaName: "Medya Adı",
          status: "Durum",
        },
      },
      contactLists: {
        title: "Kişi Listeleri",
        table: {
          name: "Ad",
          contacts: "Kişiler",
          actions: "Eylemler",
        },
        buttons: {
          add: "Yeni Liste",
        },
        dialog: {
          name: "Ad",
          company: "Şirket",
          okEdit: "Düzenle",
          okAdd: "Ekle",
          add: "Ekle",
          edit: "Düzenle",
          cancel: "İptal",
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage: "Bu işlem geri alınamaz.",
        },
        toasts: {
          deleted: "Kayıt silindi",
        },
      },
      contactListItems: {
        title: "Kişiler",
        searchPlaceholder: "Ara",
        buttons: {
          add: "Yeni",
          lists: "Listeler",
          import: "İçe Aktar",
        },
        dialog: {
          name: "Ad",
          number: "Numara",
          whatsapp: "Whatsapp",
          email: "E-posta",
          okEdit: "Düzenle",
          okAdd: "Ekle",
          add: "Ekle",
          edit: "Düzenle",
          cancel: "İptal",
        },
        table: {
          name: "Ad",
          number: "Numara",
          whatsapp: "Whatsapp",
          email: "E-posta",
          actions: "Eylemler",
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage: "Bu işlem geri alınamaz.",
          importMessage: "Bu çalışma sayfasındaki kişileri içe aktarmak ister misiniz?",
          importTitlte: "İçe Aktar",
        },
        toasts: {
          deleted: "Kayıt silindi",
        },
      },
      kanban: {
        title: "Kanban",
        searchPlaceholder: "Ara",
        subMenus: {
          list: "Panel",
          tags: "Şeritler",
        },
      },
      campaigns: {
        title: "Kampanyalar",
        searchPlaceholder: "Ara",
        subMenus: {
          list: "Liste",
          listContacts: "Kişi Listesi",
          settings: "Ayarlar",
        },
        settings: {
          randomInterval: "Rastgele Gönderme Aralığı",
          noBreak: "Ara Yok",
          intervalGapAfter: "Sonra Daha Büyük Aralık",
          undefined: "Tanımsız",
          messages: "mesajlar",
          laggerTriggerRange: "Daha büyük tetikleme aralığı",
          addVar: "Değişken Ekle",
          save: "Kaydet",
          close: "Kapat",
          add: "Ekle",
          shortcut: "Kısayol",
          content: "İçerik",
        },
        buttons: {
          add: "Yeni Kampanya",
          contactLists: "Kişi Listeleri",
        },
        table: {
          name: "Ad",
          whatsapp: "Bağlantı",
          contactList: "Kişi Listesi",
          option: "Hiçbiri",
          disabled: "Devre Dışı",
          enabled: "Etkin",
          status: "Durum",
          scheduledAt: "Planlanan Tarih",
          completedAt: "Tamamlandı",
          confirmation: "Onay",
          actions: "Eylemler",
        },
        dialog: {
          new: "Yeni Kampanya",
          update: "Kampanyayı Düzenle",
          readonly: "Salt Okunur",
          help: "Değişkenleri {name}, {number}, {email} olarak kullanın veya özel değişkenler tanımlayın.",
          form: {
            name: "Ad",
            message1: "Mesaj 1",
            message2: "Mesaj 2",
            message3: "Mesaj 3",
            message4: "Mesaj 4",
            message5: "Mesaj 5",
            confirmationMessage1: "Onay Mesajı 1",
            confirmationMessage2: "Onay Mesajı 2",
            confirmationMessage3: "Onay Mesajı 3",
            confirmationMessage4: "Onay Mesajı 4",
            confirmationMessage5: "Onay Mesajı 5",
            messagePlaceholder: "Mesaj İçeriği",
            whatsapp: "Bağlantı",
            status: "Durum",
            scheduledAt: "Planlanan Tarih",
            confirmation: "Onay",
            contactList: "Kişi Listesi",
            tagList: "Etiketler",
            statusTicket: "Ticket Durumu",
            openTicketStatus: "Açık",
            pendingTicketStatus: "Beklemede",
            closedTicketStatus: "Kapalı",
            enabledOpenTicket: "Etkin",
            disabledOpenTicket: "Devre Dışı",
            openTicket: "Ticket Aç",
          },
          buttons: {
            add: "Ekle",
            edit: "Güncelle",
            okadd: "Tamam",
            cancel: "Gönderimi İptal Et",
            restart: "Gönderimi Yeniden Başlat",
            close: "Kapat",
            attach: "Dosya Ekle",
          },
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage: "Bu işlem geri alınamaz.",
        },
        toasts: {
          success: "İşlem başarıyla gerçekleştirildi",
          cancel: "Kampanya iptal edildi",
          restart: "Kampanya yeniden başlatıldı",
          deleted: "Kayıt silindi",
        },
      },
      campaignReport: {
        title: "Rapor",
        inactive: "Etkin Değil",
        scheduled: "Planlandı",
        process: "Devam Ediyor",
        cancelled: "İptal Edildi",
        finished: "Tamamlandı",
        campaign: "Kampanya",
        validContacts: "Geçerli Kişiler",
        confirmationsRequested: "Onay İstenen",
        confirmations: "Onaylar",
        deliver: "Teslim Edildi",
        connection: "Bağlantı",
        contactLists: "Kişi Listeleri",
        schedule: "Randevu",
        conclusion: "Sonuç",
      },
      announcements: {
        title: "Duyurular",
        searchPlaceholder: "Ara",
        active: "Aktif",
        inactive: "Pasif",
        buttons: {
          add: "Yeni Duyuru",
          contactLists: "Duyuru Listeleri",
        },
        table: {
          priority: "Öncelik",
          title: "Başlık",
          text: "Metin",
          mediaName: "Dosya",
          status: "Durum",
          actions: "Eylemler",
        },
        dialog: {
          edit: "Duyuru Düzenleme",
          add: "Yeni Duyuru",
          update: "Duyuruyu Düzenle",
          readonly: "Salt Okunur",
          form: {
            priority: "Öncelik",
            title: "Başlık",
            text: "Metin",
            mediaPath: "Dosya Yolu",
            status: "Durum",
            high: "Yüksek",
            medium: "Orta",
            low: "Düşük",
            active: "Aktif",
            inactive: "Pasif",
          },
          buttons: {
            add: "Ekle",
            edit: "Güncelle",
            okadd: "Tamam",
            cancel: "İptal",
            close: "Kapat",
            attach: "Dosya Ekle",
          },
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage: "Bu işlem geri alınamaz.",
        },
        toasts: {
          success: "İşlem başarıyla gerçekleştirildi",
          deleted: "Kayıt silindi",
        },
      },
      campaignsConfig: {
        title: "Kampanya Ayarları",
      },
      queues: {
        title: "Sıralar ve Chatbot",
        table: {
          name: "Ad",
          color: "Renk",
          greeting: "Karşılama Mesajı",
          orderQueue: "Sıra Sırası (bot)",
          actions: "Eylemler",
          ID: "ID",
        },
        buttons: {
          add: "Sıra Ekle",
        },
        toasts: {
          success: "Sıra başarıyla kaydedildi",
          deleted: "Sıra başarıyla silindi",
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage:
            "Emin misiniz? Bu işlem geri alınamaz! Bu sıradaki görüşmeler devam edecektir ancak artık bir sıraya atanmayacaktır.",
        },
      },
      queue: {
        queueData: "Sıra Verileri",
      },
      queueSelect: {
        inputLabel: "Sıralar",
        inputLabelRO: "Salt okunur sıralar",
        withoutQueue: "Sırasız",
        undefined: "Sıra bulunamadı",
      },
      queueIntegration: {
        title: "Entegrasyonlar",
        table: {
          id: "ID",
          type: "Tip",
          name: "Ad",
          projectName: "Proje Adı",
          language: "Dil",
          lastUpdate: "Son Güncelleme",
          actions: "Eylemler",
        },
        buttons: {
          add: "Proje Ekle",
        },
        searchPlaceholder: "Ara...",
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage:
            "Emin misiniz? Bu işlem geri alınamaz! ve ilişkili sıralardan ve bağlantılardan kaldırılacaktır",
        },
      },
      users: {
        title: "Kullanıcılar",
        table: {
          status: "Durum",
          name: "Ad",
          email: "E-posta",
          profile: "Profil",
          startWork: "Çalışma Başlangıcı",
          endWork: "Çalışma Sonu",
          actions: "Eylemler",
          ID: "ID",
        },
        buttons: {
          add: "Kullanıcı Ekle",
        },
        toasts: {
          deleted: "Kullanıcı başarıyla silindi.",
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteMessage:
            "Tüm kullanıcı verileri kaybolacaktır. Bu kullanıcının açık ticketları sıraya taşınacaktır.",
        },
      },
      plans: {
        form: {
          name: "Ad",
          users: "Kullanıcılar",
          connections: "Bağlantılar",
          campaigns: "Kampanyalar",
          schedules: "Randevular",
          enabled: "Etkin",
          disabled: "Devre Dışı",
          clear: "Temizle",
          delete: "Sil",
          save: "Kaydet",
          yes: "Evet",
          no: "Hayır",
          money: "TL",
          public: "Herkese Açık"
        },
      },
      helps: {
        title: "Yardım Merkezi",
        settings: {
          codeVideo: "Video Kodu",
          description: "Açıklama",
          clear: "Temizle",
          delete: "Sil",
          save: "Kaydet",
        },
      },
      schedules: {
        title: "Randevular",
        confirmationModal: {
          deleteTitle: "Bu Randevuyu silmek istediğinizden emin misiniz?",
          deleteMessage: "Bu işlem geri alınamaz.",
        },
        table: {
          contact: "Kişi",
          body: "Mesaj",
          sendAt: "Randevu Tarihi",
          sentAt: "Gönderme Tarihi",
          status: "Durum",
          actions: "Eylemler",
        },
        buttons: {
          add: "Yeni Randevu",
        },
        toasts: {
          deleted: "Randevu başarıyla silindi.",
        },
      },
      tags: {
        title: "Etiketler",
        confirmationModal: {
          deleteTitle: "Bu Etiketi silmek istediğinizden emin misiniz?",
          deleteMessage: "Bu işlem geri alınamaz.",
        },
        table: {
          id: "ID",
          name: "Ad",
          kanban: "Kanban",
          color: "Renk",
          tickets: "Ticket Kayıtları",
          contacts: "Kişiler",
          actions: "Eylemler",
        },
        buttons: {
          add: "Yeni Etiket",
        },
        toasts: {
          deleted: "Etiket başarıyla silindi.",
        },
      },
      tagsKanban: {
        title: "Şeritler",
        laneDefault: "Açık",
        confirmationModal: {
          deleteTitle: "Bu Şeridi silmek istediğinizden emin misiniz?",
          deleteMessage: "Bu işlem geri alınamaz.",
        },
        table: {
          name: "Ad",
          color: "Renk",
          tickets: "Ticketlar",
          actions: "Eylemler",
        },
        buttons: {
          add: "Yeni Şerit",
        },
        toasts: {
          deleted: "Şerit başarıyla silindi.",
        },
      },
      files: {
        title: "Dosya Listesi",
        table: {
          name: "Ad",
          contacts: "Kişiler",
          actions: "Eylem",
        },
        toasts: {
          deleted: "Liste başarıyla silindi!",
          deletedAll: "Tüm listeler başarıyla silindi!",
        },
        buttons: {
          add: "Ekle",
          deleteAll: "Tümünü Sil",
        },
        confirmationModal: {
          deleteTitle: "Sil",
          deleteAllTitle: "Tümünü Sil",
          deleteMessage: "Bu listeyi silmek istediğinizden emin misiniz?",
          deleteAllMessage: "Tüm listeleri silmek istediğinizden emin misiniz?",
        },
      },
      settings: {
        success: "Ayarlar başarıyla kaydedildi.",
        title: "Ayarlar",
        tabs: {
          options: "Seçenekler",
          plans: "Planlar",
          helps: "Yardım",
        },
        settings: {
          userCreation: {
            name: "Kullanıcı Oluşturma",
            options: {
              enabled: "Etkin",
              disabled: "Devre Dışı",
            },
          },
          tabs: {
            options: "Seçenekler",
            schedules: "Randevular",
            plans: "Planlar",
            help: "Yardım",
          },
          options: {
            disabled: "Devre Dışı",
            enabled: "Etkin",
            updating: "Güncelleniyor...",
            creationCompanyUser: "Şirket/Kullanıcı Oluşturma",
            evaluations: "Değerlendirmeler",
            officeScheduling: "Ofis Randevu",
            queueManagement: "Sıra Yönetimi",
            companyManagement: "Şirket Yönetimi",
            connectionManagement: "Bağlantı Yönetimi",
            sendGreetingAccepted: "Ticket kabul edildiğinde karşılama gönder",
            sendMsgTransfTicket:
              "Sektör/katılımcı transferi mesajı gönder",
            checkMsgIsGroup: "Grup Mesajlarını Yoksay",
            chatBotType: "Bot Türü",
            userRandom: "Rastgele katılımcı seç",
            buttons: "Düğmeler",
            acceptCallWhatsapp: "Whatsapp'ta aramayı kabul etmediğini bildir?",
            sendSignMessage: "Katılımcının İmza Göndermesine izin ver",
            sendGreetingMessageOneQueues:
              "Sadece 1 sıra olduğunda karşılama mesajı gönder",
            sendQueuePosition: "Sıra pozisyonu mesajı gönder",
            sendFarewellWaitingTicket:
              "Bekleyen ticketta veda mesajı gönder",
            acceptAudioMessageContact:
              "Tüm kişilerden sesli mesaj kabul et?",
            enableLGPD: "LGPD işlemi etkinleştir",
            requiredTag: "Ticketı kapatmak için etiket zorunlu",
            closeTicketOnTransfer: "Başka bir sıraya aktarılırken ticketı kapat",
            DirectTicketsToWallets: "Müşteriyi otomatik olarak cüzdanlara taşı",
            showNotificationPending: "Bekleyen ticketlar için bildirim göster"
          },
          customMessages: {
            sendQueuePositionMessage: "Sıra pozisyonu mesajı",
            AcceptCallWhatsappMessage: "Aramaları kabul etmediğini bildirmek için mesaj",
            greetingAcceptedMessage: "Ticket kabul edildiğinde karşılama mesajı",
            transferMessage: "Transfer mesajı hedef sıra",
          },
          LGPD: {
            title: "LGPD",
            welcome: "Hoş Geldiniz Mesajı (LGPD)",
            linkLGPD: "Gizlilik Politikası Bağlantısı",
            obfuscateMessageDelete: "Silinen mesajı karart",
            alwaysConsent: "Her zaman onay iste",
            obfuscatePhoneUser: "Kullanıcılar için telefon numarasını karart",
            enabled: "Etkin",
            disabled: "Devre Dışı",
          },
        },
      },
      messagesList: {
        header: {
          assignedTo: "Atanan Kişi:",
          dialogRatingTitle:
            "Müşteri için bir hizmet değerlendirmesi bırakmak ister misiniz?",
          dialogClosingTitle: "Müşteriyle görüşme sonlandırılıyor!",
          dialogRatingCancel: "Veda Mesajı ile Çöz",
          dialogRatingSuccess: "Çöz ve Değerlendirme Gönder",
          dialogRatingWithoutFarewellMsg: "Veda Mesajı Olmadan Çöz",
          ratingTitle: "Bir değerlendirme menüsü seçin",
          notMessage: "Mesaj seçilmedi",
          amount: "Maliyet değeri",
          buttons: {
            return: "Geri Dön",
            resolve: "Çöz",
            reopen: "Yeniden Aç",
            accept: "Kabul Et",
            rating: "Değerlendirme Gönder",
            enableIntegration: "Entegrasyonu Etkinleştir",
            disableIntegration: "Entegrasyonu Devre Dışı Bırak",
            logTicket: "Ticket Logları",
            requiredTag: "Ticketı kapatmadan önce bir etiket atamanız gerekiyor.",
          },
        },
      },
      messagesInput: {
        placeholderPrivateMessage:
          "Bir mesaj yazın veya hızlı yanıtlar için / tuşuna basın",
        placeholderOpen:
          "Bir mesaj yazın veya hızlı yanıtlar için / tuşuna basın",
        placeholderClosed:
          "Mesaj göndermek için bu ticketı yeniden açın veya kabul edin.",
        signMessage: "İmza",
        privateMessage: "Özel Mesaj",
      },
      contactDrawer: {
        header: "Kişi Bilgileri",
        buttons: {
          edit: "Kişiyi Düzenle",
          block: "Engelle",
          unblock: "Engellemeyi Kaldır",
        },
        extraInfo: "Diğer Bilgiler",
      },
      messageVariablesPicker: {
        label: "Mevcut Değişkenler",
        vars: {
          contactFirstName: "İlk Ad",
          contactName: "Ad",
          user: "Katılımcı",
          greeting: "Selam",
          protocolNumber: "Protokol Numarası",
          date: "Tarih",
          hour: "Saat",
          ticket_id: "Çağrı Numarası",
          queue: "Sektör",
          connection: "Bağlantı",
        },
      },
      ticketOptionsMenu: {
        schedule: "Randevu",
        delete: "Sil",
        transfer: "Transfer Et",
        registerAppointment: "Kişi Notları",
        resolveWithNoFarewell: "Veda etmeden sonlandır",
        acceptAudioMessage: "Kişiden sesli mesajları kabul et?",
        appointmentsModal: {
          title: "Ticket Notları",
          textarea: "Not",
          placeholder: "Kaydetmek istediğiniz bilgiyi buraya girin",
        },
        confirmationModal: {
          title: "Kişinin ticketını sil",
          titleFrom: "kişisinden",
          message:
            "Dikkat! Ticket ile ilgili tüm mesajlar kaybolacaktır.",
        },
        buttons: {
          delete: "Sil",
          cancel: "İptal",
        },
      },
      confirmationModal: {
        buttons: {
          confirm: "Tamam",
          cancel: "İptal",
        },
      },
      messageInput: {
        tooltip: {
          signature: "İmza Etkinleştir/Devre Dışı Bırak",
          privateMessage: "Özel Mesaj Etkinleştir/Devre Dışı Bırak",
          meet: "Video konferans bağlantısı gönder",
        },
        type: {
          imageVideo: "Fotoğraflar ve Videolar",
          cam: "Kamera",
          contact: "Kişi",
          meet: "Görüntülü Arama",
        },
      },
      messageOptionsMenu: {
        delete: "Sil",
        reply: "Yanıtla",
        edit: "Düzenle",
        forward: "İlet",
        toForward: "İlet",
        talkTo: "Konuş",
        react: "Tepki Ver",
        confirmationModal: {
          title: "Mesajı sil?",
          message: "Bu işlem geri alınamaz.",
        },
      },
      invoices: {
        table: {
          invoices: "Faturalar",
          details: "Detaylar",
          users: "Kullanıcılar",
          connections: "Bağlantılar",
          queue: "Sıra",
          value: "Değer",
          expirationDate: "Vade Tarihi",
          action: "Eylem",
        },
      },
      backendErrors: {
        ERR_NO_OTHER_WHATSAPP: "En az bir varsayılan WhatsApp olmalıdır.",
        ERR_NO_DEF_WAPP_FOUND:
          "Varsayılan WhatsApp bulunamadı. Bağlantılar sayfasını kontrol edin.",
        ERR_WAPP_NOT_INITIALIZED:
          "Bu WhatsApp oturumu başlatılmadı. Bağlantılar sayfasını kontrol edin.",
        ERR_WAPP_CHECK_CONTACT:
          "WhatsApp kişisi doğrulanamadı. Bağlantılar sayfasını kontrol edin",
        ERR_WAPP_INVALID_CONTACT: "Bu geçerli bir WhatsApp numarası değil.",
        ERR_WAPP_DOWNLOAD_MEDIA:
          "WhatsApp'tan medya indirilemedi. Bağlantılar sayfasını kontrol edin.",
        ERR_INVALID_CREDENTIALS:
          "Kimlik doğrulama hatası. Lütfen tekrar deneyin.",
        ERR_SENDING_WAPP_MSG:
          "WhatsApp mesajı gönderilirken hata oluştu. Bağlantılar sayfasını kontrol edin.",
        ERR_DELETE_WAPP_MSG: "WhatsApp mesajı silinemedi.",
        ERR_OTHER_OPEN_TICKET: "Bu kişi için zaten açık bir ticket var.",
        ERR_SESSION_EXPIRED: "Oturum süresi doldu. Lütfen giriş yapın.",
        ERR_USER_CREATION_DISABLED:
          "Kullanıcı oluşturma yönetici tarafından devre dışı bırakıldı.",
        ERR_NO_PERMISSION: "Bu kaynağa erişim izniniz yok.",
        ERR_DUPLICATED_CONTACT: "Bu numaraya sahip bir kişi zaten var.",
        ERR_NO_SETTING_FOUND: "Bu ID'ye sahip bir ayar bulunamadı.",
        ERR_NO_CONTACT_FOUND: "Bu ID'ye sahip bir kişi bulunamadı.",
        ERR_NO_TICKET_FOUND: "Bu ID'ye sahip bir ticket bulunamadı.",
        ERR_NO_USER_FOUND: "Bu ID'ye sahip bir kullanıcı bulunamadı.",
        ERR_NO_WAPP_FOUND: "Bu ID'ye sahip bir WhatsApp bulunamadı.",
        ERR_CREATING_MESSAGE: "Veritabanında mesaj oluşturulurken hata oluştu.",
        ERR_CREATING_TICKET: "Veritabanında ticket oluşturulurken hata oluştu.",
        ERR_FETCH_WAPP_MSG:
          "WhatsApp'tan mesaj alınırken hata oluştu, belki çok eski.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
          "Bu renk zaten kullanımda, başka bir renk seçin.",
        ERR_WAPP_GREETING_REQUIRED:
          "Birden fazla sıra olduğunda karşılama mesajı zorunludur.",
        ERR_OUT_OF_HOURS: "Çalışma Saatleri Dışı!",
      },
    },
  },
};

export { messages };