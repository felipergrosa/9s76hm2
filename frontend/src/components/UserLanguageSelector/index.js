// ARQUIVO COMPLETO: frontend/src/components/UserLanguageSelector/index.js

import React, { useContext, useState } from "react";
import { Button, Menu, MenuItem, Tooltip } from "@material-ui/core"; // Adicione Tooltip para acessibilidade
import { Globe as LanguageIcon } from "lucide-react"; // 1. Importe o ícone do globo

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const UserLanguageSelector = () => {
    const [langueMenuAnchorEl, setLangueMenuAnchorEl] = useState(null);

    const { user } = useContext(AuthContext);

    const handleOpenLanguageMenu = e => {
        setLangueMenuAnchorEl(e.currentTarget);
    };

    const handleCloseLanguageMenu = () => {
        setLangueMenuAnchorEl(null);
    };

    const handleChangeLanguage = async language => {
        try {
            await i18n.changeLanguage(language);
            await api.put(`/users/${user.id}`, { language });
        } catch (err) {
            toastError(err);
        }

        handleCloseLanguageMenu();
    };

    return (
        <>
            {/* 2. Adicione um Tooltip para indicar a função do ícone */}
            <Tooltip title={i18n.t("mainHeader.buttons.language")} arrow>
                <Button
                    color="inherit"
                    onClick={handleOpenLanguageMenu}

                >
                    {/* 3. Substitua o texto pelo ícone */}
                    <LanguageIcon />
                </Button>
            </Tooltip>
            <Menu
                anchorEl={langueMenuAnchorEl}
                keepMounted
                open={Boolean(langueMenuAnchorEl)}
                onClose={handleCloseLanguageMenu}
            >
                <MenuItem onClick={() => handleChangeLanguage("pt-BR")}>
                    {i18n.t("languages.pt-BR")}
                </MenuItem>
                <MenuItem onClick={() => handleChangeLanguage("en")}>
                    {i18n.t("languages.en")}
                </MenuItem>
                <MenuItem onClick={() => handleChangeLanguage("es")}>
                    {i18n.t("languages.es")}
                </MenuItem>
                <MenuItem onClick={() => handleChangeLanguage("tr")}>
                    {i18n.t("languages.tr")}
                </MenuItem>
            </Menu>
        </>
    );
};

export default UserLanguageSelector;