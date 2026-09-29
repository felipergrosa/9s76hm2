import { messages as ptMessages } from "./pt";

// Fallback para português - traduções em inglês podem ser adicionadas posteriormente
const messages = {
  en: {
    translations: {
      ...ptMessages.pt.translations,
      mainDrawer: {
        ...ptMessages.pt.translations.mainDrawer,
        listItems: {
          ...ptMessages.pt.translations.mainDrawer.listItems,
          metaTemplates: "Meta Templates",
        },
      },
      metaTemplates: {
        title: "Meta Templates",
        subtitle: "Manage WhatsApp Official API message templates",
        searchPlaceholder: "Search template...",
        selectConnection: "Connection",
        buttons: {
          add: "New Template",
          sync: "Sync",
          cancel: "Cancel",
          save: "Save",
          edit: "Edit",
          delete: "Delete",
          newButton: "Add button",
          addButton: "Add button",
        },
        table: {
          name: "Name",
          language: "Language",
          category: "Category",
          status: "Status",
          quality: "Quality",
          reason: "Reason",
          actions: "Actions",
        },
        status: {
          APPROVED: "Approved",
          PENDING: "Pending",
          IN_REVIEW: "In review",
          REJECTED: "Rejected",
          PAUSED: "Paused",
          DISABLED: "Disabled",
          FLAGGED: "Flagged",
          ARCHIVED: "Archived",
          DELETED: "Deleted",
          PENDING_DELETION: "Pending deletion",
          IN_APPEAL: "In appeal",
          REINSTATED: "Reinstated",
          LOCKED: "Locked",
          LIMIT_EXCEEDED: "Limit exceeded",
        },
        category: {
          MARKETING: "Marketing",
          UTILITY: "Utility",
          AUTHENTICATION: "Authentication",
        },
        form: {
          name: "Template name",
          nameHelper: "Only lowercase letters, numbers and underscores",
          category: "Category",
          language: "Language",
          parameterFormat: "Parameter format",
          positional: "Positional",
          named: "Named",
          headerType: "Header type",
          headerNone: "None",
          headerText: "Text",
          headerImage: "Image",
          headerVideo: "Video",
          headerDocument: "Document",
          headerFile: "File",
          body: "Message body",
          bodyHelper: "Use {{1}}, {{2}}... for positional variables",
          footer: "Footer",
          variables: "Variables",
          exampleFor: "Example for",
          buttons: "Buttons",
          buttonType: "Button type",
          quickReply: "Quick reply",
          urlButton: "URL button",
          url: "URL",
          urlExample: "URL example",
          phoneButton: "Phone button",
          phoneNumber: "Phone number",
          copyCode: "Copy code",
          copyExample: "Code example",
          buttonText: "Button text",
          ttl: "TTL (time to live)",
          ttlHelper: "Time in seconds for the message to expire",
          preview: "Preview",
          submitting: "Submitting...",
        },
        modal: {
          createTitle: "Create Template",
          editTitle: "Edit Template",
        },
        toasts: {
          created: "Template created successfully!",
          updated: "Template updated successfully!",
          deleted: "Template deleted successfully!",
          synced: "Templates synced successfully!",
        },
        confirm: {
          deleteTitle: "Delete template",
          deleteMessage:
            "Are you sure you want to delete this template? This action cannot be undone.",
          deleteWarning30d:
            "Warning: deleted templates cannot be recreated with the same name for 30 days.",
        },
        errors: {
          noOfficialConnection:
            "No official connection found. Set up a connection with the Meta Official API.",
          staleCache:
            "The displayed data may be outdated. Click Sync to refresh.",
        },
        empty: "No templates found.",
      },
    },
  },
};

export { messages };
