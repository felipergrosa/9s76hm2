import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
// import { SocketContext } from "../../context/Socket/SocketContext"; //

import { makeStyles, useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Grid from "@material-ui/core/Grid"; //
import Paper from "@material-ui/core/Paper"; //
import Button from "@material-ui/core/Button"; //
import Table from "@material-ui/core/Table"; //
import TableBody from "@material-ui/core/TableBody"; //
import TableCell from "@material-ui/core/TableCell"; //
import TableHead from "@material-ui/core/TableHead"; //
import TableRow from "@material-ui/core/TableRow"; //
import IconButton from "@material-ui/core/IconButton"; // Adicionado para os botões de ação na tabela
import TextField from "@material-ui/core/TextField"; // Adicionado para o campo de busca
import InputAdornment from "@material-ui/core/InputAdornment"; // Adicionado para o ícone de busca
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";

import SearchIcon from "@material-ui/icons/Search"; // Adicionado para o ícone de busca
import EditIcon from "@material-ui/icons/Edit"; // Adicionado para o ícone de editar
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline"; // Adicionado para o ícone de deletar

import MainContainer from "../../components/MainContainer"; //
import MainHeader from "../../components/MainHeader"; //
 // Adicionado, presumindo que é um componente que você tem

import Title from "../../components/Title"; //

import api from "../../services/api"; //
import { i18n } from "../../translate/i18n"; //
import TableRowSkeleton from "../../components/TableRowSkeleton"; //
import CompanyModal from "../../components/CompaniesModal"; //
import ConfirmationModal from "../../components/ConfirmationModal"; //
import toastError from "../../errors/toastError"; //
import { AuthContext } from "../../context/Auth/AuthContext"; //
import { useDate } from "../../hooks/useDate"; //
import usePlans from "../../hooks/usePlans"; // // Importação mantida, mesmo que não usada diretamente
import moment from "moment"; //

const reducer = (state, action) => {
    if (action.type === "LOAD_COMPANIES") {
        const companies = action.payload; //
        const newCompanies = []; //

        companies.forEach((company) => { //
            const companyIndex = state.findIndex((u) => u.id === company.id); //
            if (companyIndex !== -1) { //
                state[companyIndex] = company; //
            } else { //
                newCompanies.push(company); //
            }
        });

        return [...state, ...newCompanies]; //
    }

    if (action.type === "UPDATE_COMPANIES") {
        const company = action.payload; //
        const companyIndex = state.findIndex((u) => u.id === company.id); //

        if (companyIndex !== -1) { //
            state[companyIndex] = company; //
            return [...state]; //
        } else { //
            return [company, ...state]; //
        }
    }

    if (action.type === "DELETE_COMPANIES") {
        const companyId = action.payload; //

        const companyIndex = state.findIndex((u) => u.id === companyId); //
        if (companyIndex !== -1) { //
            state.splice(companyIndex, 1); //
        }
        return [...state]; //
    }

    if (action.type === "RESET") {
        return []; //
    }
    return state; // Retorne o estado atual se a ação não for reconhecida, para evitar undefined.
};

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1, //
        padding: theme.spacing(1), //
        overflowY: "scroll", //
        ...theme.scrollbarStyles, //
    },
    mobileList: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: theme.spacing(2),
        [theme.breakpoints.up("sm")]: {
            display: "none",
        },
    },
    desktopTableWrapper: {
        [theme.breakpoints.down("sm")]: {
            display: "none",
        },
    },
    card: {
        borderRadius: 14,
        padding: theme.spacing(2),
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        border: `1px solid ${theme.palette.divider}`,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1.25),
        background: theme.palette.background.paper,
    },
    cardHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(1),
    },
    cardTitle: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        fontWeight: 700,
        fontSize: "1.05rem",
        lineHeight: 1.2,
    },
    cardMeta: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: theme.spacing(1),
    },
    metaLabel: {
        fontSize: "0.85rem",
        color: theme.palette.text.secondary,
    },
    metaValue: {
        fontSize: "0.95rem",
        fontWeight: 600,
        wordBreak: "break-word",
    },
    cardActions: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        flexWrap: "wrap",
    },
    actionButton: {
        minWidth: 44,
        minHeight: 44,
    },
}));

const Companies = () => {
    const classes = useStyles();
    const history = useHistory();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm")); //

    const [loading, setLoading] = useState(false); //
    const [pageNumber, setPageNumber] = useState(1); //
    const [hasMore, setHasMore] = useState(false); //
    const [selectedCompany, setSelectedCompany] = useState(null); //
    const [deletingCompany, setDeletingCompany] = useState(null); //
    const [companyModalOpen, setCompanyModalOpen] = useState(false); //
    const [confirmModalOpen, setConfirmModalOpen] = useState(false); //
    const [searchParam, setSearchParam] = useState(""); //
    const [companies, dispatch] = useReducer(reducer, []); //
    const { dateToClient, datetimeToClient } = useDate(); //

    // const { getPlanCompany } = usePlans(); //
    //   const socketManager = useContext(SocketContext); //
    const { user, socket } = useContext(AuthContext); //


    useEffect(() => {
        async function fetchData() {
            if (!user.super) { //
                toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando."); //
                setTimeout(() => { //
                    history.push(`/`) //
                }, 1000); //
            }
        }
        fetchData(); //
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); //

    useEffect(() => {
        dispatch({ type: "RESET" }); //
        setPageNumber(1); //
    }, [searchParam]); //

    useEffect(() => {
        setLoading(true); //
        const delayDebounceFn = setTimeout(() => { //
            const fetchCompanies = async () => {
                try {
                    const { data } = await api.get("/companiesPlan/", { //
                        params: { searchParam, pageNumber }, //
                    });
                    dispatch({ type: "LOAD_COMPANIES", payload: data.companies }); //
                    setHasMore(data.hasMore); //
                    setLoading(false); //
                } catch (err) {
                    toastError(err); //
                }
            };
            fetchCompanies(); //
        }, 500); //
        return () => clearTimeout(delayDebounceFn); //
    }, [searchParam, pageNumber]); //

    // // Evento de socket para atualização de empresas
    // useEffect(() => {
    //     if (socket) {
    //         socket.on("company", (data) => {
    //             if (data.action === "update" || data.action === "create") {
    //                 dispatch({ type: "UPDATE_COMPANIES", payload: data.company });
    //             } else if (data.action === "delete") {
    //                 dispatch({ type: "DELETE_COMPANIES", payload: data.companyId });
    //             }
    //         });
    //     }
    //     return () => {
    //         if (socket) {
    //             socket.off("company");
    //         }
    //     };
    // }, [socket]);


    const handleOpenCompanyModal = () => {
        setSelectedCompany(null); //
        setCompanyModalOpen(true); //
    };

    const handleCloseCompanyModal = () => {
        setSelectedCompany(null); //
        setCompanyModalOpen(false); //
    };

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase()); //
    };

    const handleEditCompany = (company) => {
        setSelectedCompany(company); //
        setCompanyModalOpen(true); //
    };

    const handleDeleteCompany = async (companyId) => {
        try {
            await api.delete(`/companies/${companyId}`); //
            toast.success(i18n.t("compaies.toasts.deleted")); //
        } catch (err) {
            toastError(err); //
        }
        setDeletingCompany(null); //
        setSearchParam(""); // Limpa o parâmetro de busca para recarregar a lista
        setPageNumber(1); // Redefine a página para a primeira
    };

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1); //
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return; //
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget; //
        if (scrollHeight - (scrollTop + 100) < clientHeight) { //
            loadMore(); //
        }
    };

    const renderStatus = (status) => { // Renomeado de 'row' para 'status' para clareza
        return status === false ? "Não" : "Sim"; //
    };

    const renderPlanValue = (company) => { // Renomeado de 'row' para 'company' para clareza
        return company.planId !== null && company.plan && company.plan.amount // Adicionada verificação de company.plan
            ? company.plan.amount.toLocaleString('pt-br', { minimumFractionDigits: 2 })
            : '00.00'; //
    };

    const renderWhatsapp = (useWhatsapp) => { // Renomeado de 'row' para 'useWhatsapp' para clareza
        return useWhatsapp === false ? "Não" : "Sim"; //
    };

    const renderFacebook = (useFacebook) => { // Renomeado de 'row' para 'useFacebook' para clareza
        return useFacebook === false ? "Não" : "Sim"; //
    };

    const renderInstagram = (useInstagram) => { // Renomeado de 'row' para 'useInstagram' para clareza
        return useInstagram === false ? "Não" : "Sim"; //
    };

    const renderCampaigns = (useCampaigns) => { // Renomeado de 'row' para 'useCampaigns' para clareza
        return useCampaigns === false ? "Não" : "Sim"; //
    };

    const renderSchedules = (useSchedules) => { // Renomeado de 'row' para 'useSchedules' para clareza
        return useSchedules === false ? "Não" : "Sim"; //
    };

    const renderInternalChat = (useInternalChat) => { // Renomeado de 'row' para 'useInternalChat' para clareza
        return useInternalChat === false ? "Não" : "Sim"; //
    };

    const renderExternalApi = (useExternalApi) => { // Renomeado de 'row' para 'useExternalApi' para clareza
        return useExternalApi === false ? "Não" : "Sim"; //
    };

    const rowStyle = (record) => {
        if (moment(record.dueDate).isValid()) { //
            const now = moment(); //
            const dueDate = moment(record.dueDate); //
            const diff = dueDate.diff(now, "days"); //
            if (diff >= 1 && diff <= 5) { //
                return { backgroundColor: "#fffead" }; //
            }
            if (diff <= 0) { //
                return { backgroundColor: "#fa8c8c" }; //
            }
        }
        return {}; //
    };

    return (
        <MainContainer>
            <ConfirmationModal
                title={
                    deletingCompany &&
                    `${i18n.t("compaies.confirmationModal.deleteTitle")} ${deletingCompany.name}?` //
                }
                open={confirmModalOpen} //
                onClose={() => setConfirmModalOpen(false)} // Função para fechar o modal
                onConfirm={() => handleDeleteCompany(deletingCompany.id)} //
            >
                {i18n.t("compaies.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <CompanyModal
                open={companyModalOpen} //
                onClose={handleCloseCompanyModal} //
                aria-labelledby="form-dialog-title" //
                companyId={selectedCompany && selectedCompany.id} //
            />
            <MainHeader>
                <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                        <Title>{i18n.t("compaies.title")} ({companies.length})</Title>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Grid container spacing={1} alignItems="center" justifyContent="flex-end">
                            <Grid item xs={12} sm>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder={i18n.t("contacts.searchPlaceholder")}
                                    type="search"
                                    value={searchParam}
                                    onChange={handleSearch}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon style={{ color: "gray" }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm="auto">
                                <Button
                                    fullWidth={isMobile}
                                    variant="contained"
                                    color="primary"
                                    onClick={handleOpenCompanyModal}
                                    style={{ minHeight: 44 }}
                                >
                                    {i18n.t("compaies.buttons.add")}
                                </Button>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </MainHeader>
            <Paper
                className={classes.mainPaper} //
                variant="outlined" //
                onScroll={handleScroll} //
            >
                {/* Mobile cards */}
                <div className={classes.mobileList}>
                    {companies.map((company) => (
                        <Card key={company.id} className={classes.card} style={rowStyle(company)}>
                            <div className={classes.cardHeader}>
                                <div className={classes.cardTitle}>
                                    #{company.id} · {company.name || "—"}
                                </div>
                                <div className={classes.metaValue}>{renderStatus(company.status)}</div>
                            </div>
                            <div className={classes.cardMeta}>
                                <div>
                                    <div className={classes.metaLabel}>{i18n.t("compaies.table.email")}</div>
                                    <div className={classes.metaValue}>{company.email || "—"}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>{i18n.t("compaies.table.namePlan")}</div>
                                    <div className={classes.metaValue}>{company?.plan?.name || "—"}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>{i18n.t("compaies.table.value")}</div>
                                    <div className={classes.metaValue}>R$ {renderPlanValue(company)}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>{i18n.t("compaies.table.createdAt")}</div>
                                    <div className={classes.metaValue}>{dateToClient(company.createdAt)}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>{i18n.t("compaies.table.dueDate")}</div>
                                    <div className={classes.metaValue}>{dateToClient(company.dueDate)} <span>{company.recurrence}</span></div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>{i18n.t("compaies.table.lastLogin")}</div>
                                    <div className={classes.metaValue}>{datetimeToClient(company.lastLogin)}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>Tamanho da pasta</div>
                                    <div className={classes.metaValue}>{company.folderSize || "—"}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>Total de arquivos</div>
                                    <div className={classes.metaValue}>{company.numberFileFolder || "—"}</div>
                                </div>
                                <div>
                                    <div className={classes.metaLabel}>Último update</div>
                                    <div className={classes.metaValue}>{datetimeToClient(company.updatedAtFolder)}</div>
                                </div>
                            </div>
                            <div className={classes.cardActions}>
                                <IconButton
                                    size="small"
                                    className={classes.actionButton}
                                    onClick={() => handleEditCompany(company)} //
                                >
                                    <EditIcon />
                                </IconButton>

                                <IconButton
                                    size="small"
                                    className={classes.actionButton}
                                    onClick={() => { // Modificado para não passar o evento 'e' se não for usado
                                        setConfirmModalOpen(true); //
                                        setDeletingCompany(company); //
                                    }}
                                >
                                    <DeleteOutlineIcon />
                                </IconButton>
                            </div>
                        </Card>
                    ))}
                    {loading && (
                        <Table>
                            <TableBody>
                                <TableRowSkeleton columns={4} />
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Desktop table */}
                <div className={classes.desktopTableWrapper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell align="center">{i18n.t("compaies.table.ID")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.status")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.name")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.email")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.namePlan")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.value")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.createdAt")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.dueDate")}</TableCell>
                                <TableCell align="center">{i18n.t("compaies.table.lastLogin")}</TableCell>
                                <TableCell align="center">Tamanho da pasta</TableCell>
                                <TableCell align="center">Total de arquivos</TableCell>
                                <TableCell align="center">Ultimo update</TableCell>
                                {/* Descomentado a coluna de ações */}
                                <TableCell align="center">{i18n.t("compaies.table.actions")}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <>
                                {companies.map((company) => (
                                    <TableRow style={rowStyle(company)} key={company.id}>
                                        <TableCell align="center">{company.id}</TableCell>
                                        <TableCell align="center">{renderStatus(company.status)}</TableCell>
                                        <TableCell align="center">{company.name}</TableCell>
                                        <TableCell align="center">{company.email}</TableCell>
                                        <TableCell align="center">{company?.plan?.name}</TableCell> {/* Acesso seguro a plan.name */}
                                        <TableCell align="center">R$ {renderPlanValue(company)}</TableCell>
                                        <TableCell align="center">{dateToClient(company.createdAt)}</TableCell>
                                        <TableCell align="center">{dateToClient(company.dueDate)}<br/>{company.recurrence}</TableCell>
                                        <TableCell align="center">{datetimeToClient(company.lastLogin)}</TableCell>
                                        <TableCell align="center">{company.folderSize}</TableCell>
                                        <TableCell align="center">{company.numberFileFolder}</TableCell>
                                        <TableCell align="center">{datetimeToClient(company.updatedAtFolder)}</TableCell>
                                        <TableCell align="center">
                                            {/* Descomentado os botões de ação */}
                                            <IconButton
                                                size="small"
                                                onClick={() => handleEditCompany(company)} //
                                            >
                                                <EditIcon />
                                            </IconButton>

                                            <IconButton
                                                size="small"
                                                onClick={() => { // Modificado para não passar o evento 'e' se não for usado
                                                    setConfirmModalOpen(true); //
                                                    setDeletingCompany(company); //
                                                }}
                                            >
                                                <DeleteOutlineIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {loading && <TableRowSkeleton columns={4} />}
                            </>
                        </TableBody>
                    </Table>
                </div>
            </Paper>
        </MainContainer>
    );
};

export default Companies;