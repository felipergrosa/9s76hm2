import React, { useEffect, useState } from "react";
import Divider from "@material-ui/core/Divider";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import { ArrowLeftRight, Building2 } from "lucide-react";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";

// Itens de "Trocar de conta" para o dropdown do avatar (referência Fluxoo
// /account-switch). Renderiza uma lista flat dentro do Menu existente —
// sem página nem dialog, porque o Menu do MUI desmonta os filhos ao fechar.
//
// O componente só é montado quando o menu abre (Modal unmount-on-close),
// então a listagem é lazy: não dispara request no boot da aplicação.
// O cache em módulo evita refetch a cada abertura do menu.
let cachedAccounts = null;

const AccountSwitchMenuItems = () => {
  const [accounts, setAccounts] = useState(cachedAccounts || []);
  const [switchingTo, setSwitchingTo] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await api.get("/auth/switchable-accounts");
        if (!mounted) return;
        const list = Array.isArray(data) ? data : [];
        cachedAccounts = list;
        setAccounts(list);
      } catch (err) {
        // Falha silenciosa: se a listagem não carregar, o item some do menu
        // em vez de quebrar a experiência do dropdown.
        if (mounted) setAccounts([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSwitch = async (companyId) => {
    if (switchingTo) return; // evita duplo clique durante a troca
    setSwitchingTo(companyId);

    try {
      const { data } = await api.post("/auth/switch", { companyId });

      // O cookie de refresh (jrt) já foi reemitido pelo backend na resposta;
      // aqui só persistimos o novo access token + usuário serializado.
      localStorage.setItem("token", JSON.stringify(data.token));
      localStorage.setItem("user", JSON.stringify(data.user));
      api.defaults.headers.Authorization = `Bearer ${data.token}`;

      // Reload completo proposital: garante estado limpo de socket, caches
      // de query e permissões, que são todos escopados por companyId.
      window.location.href = "/tickets";
    } catch (err) {
      setSwitchingTo(null);
      // Mensagem genérica própria — não repassa o código de erro do backend
      // (ERR_ACCOUNT_SWITCH_NOT_ALLOWED etc.) cru para o usuário.
      toast.error(i18n.t("accountSwitch.error"));
    }
  };

  // Sem contas alternáveis → não renderiza nada (item oculto no menu).
  if (!accounts.length) return null;

  // Array (não fragment) para o MenuList clonar cada filho corretamente.
  return [
    <Divider key="account-switch-divider" />,
    <MenuItem key="account-switch-header" disabled style={{ opacity: 1 }}>
      <ListItemIcon style={{ minWidth: 32 }}>
        <ArrowLeftRight size={18} />
      </ListItemIcon>
      <ListItemText primary={i18n.t("accountSwitch.title")} />
    </MenuItem>,
    ...accounts.map((account) => (
      <MenuItem
        key={`account-switch-${account.companyId}`}
        onClick={() => handleSwitch(account.companyId)}
        disabled={switchingTo !== null}
      >
        <ListItemIcon style={{ minWidth: 32 }}>
          <Building2 size={18} />
        </ListItemIcon>
        <ListItemText
          primary={account.companyName}
          secondary={
            switchingTo === account.companyId
              ? i18n.t("accountSwitch.switching")
              : account.profile
          }
        />
      </MenuItem>
    )),
  ];
};

export default AccountSwitchMenuItems;
