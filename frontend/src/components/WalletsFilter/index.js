import { Box, Chip, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useState } from "react";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Filtro "Carteira" da listagem de tickets.
 * Lista usuários da empresa (/users/list); a seleção filtra tickets cujo
 * contato possui a tag pessoal (#) do usuário — ou seja, está na carteira
 * dele (mesmo critério da página /wallets e do backend em
 * helpers/walletExistsSql). Selecionar um usuário sem tag pessoal retorna
 * lista vazia, o que é o comportamento esperado.
 */
export function WalletsFilter({ onFiltered, initialWallets }) {
  const [users, setUsers] = useState([]);
  const [selecteds, setSelecteds] = useState([]);

  useEffect(() => {
    async function fetchData() {
      await loadUsers();
    }
    fetchData();
  }, []);

  useEffect(() => {
    setSelecteds([]);
    if (
      Array.isArray(initialWallets) &&
      Array.isArray(users) &&
      users.length > 0
    ) {
      onChange(initialWallets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWallets, users]);

  const loadUsers = async () => {
    try {
      const { data } = await api.get(`/users/list`);
      const userList = data.map((u) => ({ id: u.id, name: u.name }));
      setUsers(userList);
    } catch (err) {
      // 403 = sem permissão para listar usuários — silencia e mantém lista vazia
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  const onChange = async (value) => {
    setSelecteds(value);
    onFiltered(value);
  };

  return (
    <Box style={{ padding: "0px 10px 10px" }}>
      <Autocomplete
        multiple
        size="small"
        options={users}
        value={selecteds}
        onChange={(e, v, r) => onChange(v)}
        getOptionLabel={(option) => option.name}
        getOptionSelected={(option, value) => {
          return (
            option?.id === value?.id ||
            option?.name.toLowerCase() === value?.name.toLowerCase()
          );
        }}
        renderTags={(value, getUserProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              style={{
                backgroundColor: "#bfbfbf",
                textShadow: "1px 1px 1px #000",
                color: "white",
              }}
              label={option.name}
              {...getUserProps({ index })}
              size="small"
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            placeholder={i18n.t("tickets.search.filterWallet")}
          />
        )}
      />
    </Box>
  );
}
