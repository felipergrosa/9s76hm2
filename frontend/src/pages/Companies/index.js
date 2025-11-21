import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CompanyModal from "../../components/CompaniesModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import usePlans from "../../hooks/usePlans";
import moment from "moment";

const reducer = (state, action) => {
    if (action.type === "SET_COMPANIES") {
        // Substitui completamente a lista (paginação por página)
        return [...action.payload];
    }
    if (action.type === "LOAD_COMPANIES") {
        const companies = action.payload;
        const newCompanies = [];

        companies.forEach((company) => {
            const companyIndex = state.findIndex((u) => u.id === company.id);
            if (companyIndex !== -1) {
                state[companyIndex] = company;
            } else {
                newCompanies.push(company);
            }
        });

        return [...state, ...newCompanies];
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
    root: {
        flex: 1,
        backgroundColor: theme.palette.background.default,
        minHeight: "100%",
        padding: theme.spacing(2),
        [theme.breakpoints.down("sm")]: {
            padding: theme.spacing(1),
        },
    },
    container: {
        width: "100%",
        padding: theme.spacing(2),
        [theme.breakpoints.down("sm")]: {
            padding: theme.spacing(1),
        },
    },
    mainPaper: {
        flex: 1,
        padding: theme.spacing(1),
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    tableHead: {
        backgroundColor: theme.palette.grey[100],
        "& th": {
            padding: theme.spacing(1.5),
            textAlign: "left",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            borderBottom: `2px solid ${theme.palette.divider}`,
        },
    },
    sortButton: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(0.5),
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        "&:hover": {
            opacity: 0.8,
        },
    },
    sortIcon: {
        fontSize: "0.75rem",
        opacity: 0.6,
    },
    tableBody: {
        "& tr": {
            borderBottom: `1px solid ${theme.palette.divider}`,
            transition: "background-color 0.2s",
            "&:hover": {
                backgroundColor: theme.palette.action.hover,
            },
            "&:last-child": {
                borderBottom: "none",
            },
        },
        "& td": {
            padding: theme.spacing(1.5),
            fontSize: "0.875rem",
            color: theme.palette.text.primary,
        },
    },
    emptyState: {
        padding: theme.spacing(4),
        textAlign: "center",
        color: theme.palette.text.secondary,
    },
    pagination: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        boxShadow: theme.shadows[1],
        marginTop: theme.spacing(2),
    },
    paginationInfo: {
        fontSize: "0.875rem",
        color: theme.palette.text.secondary,
    },
    paginationControls: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
    },
    pageButton: {
        minWidth: 32,
        height: 32,
        padding: theme.spacing(0.5),
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover:not(:disabled)": {
            backgroundColor: theme.palette.action.hover,
        },
        "&:disabled": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
    pageButtonActive: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        borderColor: theme.palette.primary.main,
        "&:hover": {
            backgroundColor: theme.palette.primary.dark,
        },
    },
}));

const CustomTooltipProps = {
    arrow: true,
    enterTouchDelay: 0,
    leaveTouchDelay: 5000,
    enterDelay: 300,
    leaveDelay: 100,
};

const COMPANIES_PER_PAGE = 25;

const Companies = () => {
    const classes = useStyles();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
    const history = useHistory();

    const [loading, setLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(COMPANIES_PER_PAGE);
    const [totalItems, setTotalItems] = useState(0);
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [deletingCompany, setDeletingCompany] = useState(null);
    const [companyModalOpen, setCompanyModalOpen] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const [companies, dispatch] = useReducer(reducer, []);
    const { dateToClient, datetimeToClient } = useDate();
    const { user, socket } = useContext(AuthContext);

    const totalPages = useMemo(() => {
        return totalItems === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
    }, [totalItems, itemsPerPage]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setPageNumber(page);
        }
    };

    const renderPageNumbers = useMemo(() => {
        const pages = [];
        if (totalPages <= 3) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            const start = Math.max(1, Math.min(pageNumber - 1, totalPages - 2));
            const end = Math.min(totalPages, start + 2);
            for (let i = start; i <= end; i++) pages.push(i);
        }
        return pages;
    }, [pageNumber, totalPages]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };


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
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchCompanies = async () => {
                try {
                    const { data } = await api.get("/companiesPlan/", {
                        params: { 
                            searchParam, 
                            pageNumber,
                            limit: itemsPerPage,
                            orderBy: sortField || 'name',
                            order: sortDirection
                        },
                    });
                    dispatch({ type: "SET_COMPANIES", payload: data.companies || [] });
                    setTotalItems(typeof data.count === "number" ? data.count : (data.total || data.companies?.length || 0));
                    setLoading(false);
                } catch (err) {
                    toastError(err);
                    setLoading(false);
                }
            };
            fetchCompanies();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchParam, pageNumber, itemsPerPage, sortField, sortDirection]);

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
            await api.delete(`/companies/${companyId}`);
            toast.success(i18n.t("compaies.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingCompany(null);
        setSearchParam("");
        setPageNumber(1);
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
        <Box className={classes.root}>
            <MainContainer useWindowScroll>
                <Box className={classes.container}>
            <ConfirmationModal
                title={
                    deletingCompany &&
                            `${i18n.t("compaies.confirmationModal.deleteTitle")} ${deletingCompany.name}?`
                }
                        open={confirmModalOpen}
                        onClose={() => setConfirmModalOpen(false)}
                        onConfirm={() => handleDeleteCompany(deletingCompany.id)}
            >
                {i18n.t("compaies.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <CompanyModal
                        open={companyModalOpen}
                        onClose={handleCloseCompanyModal}
                        aria-labelledby="form-dialog-title"
                        companyId={selectedCompany && selectedCompany.id}
            />
            <MainHeader>
                        <Grid style={{ width: "99.6%" }} container>
                            <Grid xs={12} sm={5} item>
                                <Title>
                                    {i18n.t("compaies.title")} ({totalItems})
                                </Title>
                            </Grid>
                            <Grid xs={12} sm={7} item>
                                <Grid container alignItems="center" spacing={2}>
                                    <Grid item xs>
                    <TextField
                                            fullWidth
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
                                    <Grid item>
                                        <Tooltip {...CustomTooltipProps} title={i18n.t("compaies.buttons.add")}>
                    <Button
                                                onClick={handleOpenCompanyModal}
                        variant="contained"
                                                size="small"
                                                style={{ 
                                                    backgroundColor: "#4ade80",
                                                    color: "#ffffff",
                                                    textTransform: "uppercase",
                                                    fontWeight: 600,
                                                    borderRadius: "8px"
                                                }}
                                                startIcon={<Plus className="w-4 h-4" />}
                                                aria-label={i18n.t("compaies.buttons.add")}
                    >
                        {i18n.t("compaies.buttons.add")}
                    </Button>
                                        </Tooltip>
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
            </MainHeader>
                    {isDesktop ? (
                        <Paper className={classes.mainPaper} variant="outlined">
                            <Box style={{ overflowX: "auto" }}>
                                <table className={classes.table}>
                                    <thead className={classes.tableHead}>
                                        <tr>
                                            <th scope="col" style={{ textAlign: "center", width: "80px" }}>
                                                <button 
                                                    onClick={() => handleSort('id')} 
                                                    className={classes.sortButton}
                                                    style={{ width: "100%", justifyContent: "center" }}
                                                >
                                                    {i18n.t("compaies.table.ID").toUpperCase()}
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "100px" }}>
                                                {i18n.t("compaies.table.status").toUpperCase()}
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "200px" }}>
                                                <button 
                                                    onClick={() => handleSort('name')} 
                                                    className={classes.sortButton}
                                                    style={{ width: "100%", justifyContent: "center" }}
                                                >
                                                    {i18n.t("compaies.table.name").toUpperCase()}
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "200px" }}>
                                                <button 
                                                    onClick={() => handleSort('email')} 
                                                    className={classes.sortButton}
                                                    style={{ width: "100%", justifyContent: "center" }}
                                                >
                                                    {i18n.t("compaies.table.email").toUpperCase()}
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "150px" }}>
                                                {i18n.t("compaies.table.namePlan").toUpperCase()}
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                                                {i18n.t("compaies.table.value").toUpperCase()}
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                                                {i18n.t("compaies.table.createdAt").toUpperCase()}
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "150px" }}>
                                                {i18n.t("compaies.table.dueDate").toUpperCase()}
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "150px" }}>
                                                {i18n.t("compaies.table.lastLogin").toUpperCase()}
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                                                TAMANHO DA PASTA
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                                                TOTAL DE ARQUIVOS
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "150px" }}>
                                                ULTIMO UPDATE
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                                                {i18n.t("compaies.table.actions").toUpperCase()}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className={classes.tableBody}>
                                        {!loading && companies.length === 0 && (
                                            <tr>
                                                <td colSpan={13} className={classes.emptyState}>
                                                    Nenhuma empresa encontrada.
                                                </td>
                                            </tr>
                                        )}
                        {companies.map((company) => (
                                            <tr key={company.id} style={rowStyle(company)}>
                                                <td style={{ textAlign: "center" }}>{company.id}</td>
                                                <td style={{ textAlign: "center" }}>{renderStatus(company.status)}</td>
                                                <td style={{ textAlign: "center" }}>{company.name}</td>
                                                <td style={{ textAlign: "center" }}>{company.email}</td>
                                                <td style={{ textAlign: "center" }}>{company?.plan?.name}</td>
                                                <td style={{ textAlign: "center" }}>R$ {renderPlanValue(company)}</td>
                                                <td style={{ textAlign: "center" }}>{dateToClient(company.createdAt)}</td>
                                                <td style={{ textAlign: "center" }}>
                                    {dateToClient(company.dueDate)}
                                    {company.recurrence && (
                                        <>
                                            <br />
                                            <span>{company.recurrence}</span>
                                        </>
                                    )}
                                                </td>
                                                <td style={{ textAlign: "center" }}>{datetimeToClient(company.lastLogin)}</td>
                                                <td style={{ textAlign: "center" }}>{company.folderSize}</td>
                                                <td style={{ textAlign: "center" }}>{company.numberFileFolder}</td>
                                                <td style={{ textAlign: "center" }}>{datetimeToClient(company.updatedAtFolder)}</td>
                                                <td style={{ textAlign: "center" }}>
                                                    <Tooltip {...CustomTooltipProps} title="Editar">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleEditCompany(company)}
                                                            style={{
                                                                color: "#374151",
                                                                backgroundColor: "#ffffff",
                                                                border: "1px solid #d1d5db",
                                                                borderRadius: "8px",
                                                                marginRight: 4
                                                            }}
                                    >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip {...CustomTooltipProps} title="Deletar">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setConfirmModalOpen(true);
                                                                setDeletingCompany(company);
                                                            }}
                                                            style={{
                                                                color: "#dc2626",
                                                                backgroundColor: "#ffffff",
                                                                border: "1px solid #d1d5db",
                                                                borderRadius: "8px"
                                                            }}
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        ))}
                                        {loading && <TableRowSkeleton columns={13} />}
                                    </tbody>
                                </table>
                            </Box>
                            {/* Paginação Desktop */}
                            <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                                <span className={classes.paginationInfo}>
                                    Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                                    <strong>{totalItems}</strong> empresas
                                </span>
                                <Box className={classes.paginationControls}>
                                    <span style={{ fontSize: "0.875rem", marginRight: 8 }}>Itens por página:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setPageNumber(1);
                                        }}
                                        style={{ fontSize: "0.875rem", padding: "4px 8px", border: "1px solid #E5E7EB", borderRadius: "4px" }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </Box>
                                <Box className={classes.paginationControls} component="ul" style={{ listStyle: "none", display: "flex", gap: 4, margin: 0, padding: 0 }}>
                                    <li>
                                        <button
                                            onClick={() => handlePageChange(1)}
                                            disabled={pageNumber === 1}
                                            className={classes.pageButton}
                                        >
                                            <ChevronsLeft className="w-5 h-5" />
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => handlePageChange(pageNumber - 1)}
                                            disabled={pageNumber === 1}
                                            className={classes.pageButton}
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                    </li>
                                    {renderPageNumbers.map((page, index) => (
                                        <li key={index}>
                                            <button
                                                onClick={() => handlePageChange(page)}
                                                className={`${classes.pageButton} ${page === pageNumber ? classes.pageButtonActive : ""}`}
                                            >
                                                {page}
                                            </button>
                                        </li>
                                    ))}
                                    <li>
                                        <button
                                            onClick={() => handlePageChange(pageNumber + 1)}
                                            disabled={pageNumber === totalPages}
                                            className={classes.pageButton}
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => handlePageChange(totalPages)}
                                            disabled={pageNumber === totalPages}
                                            className={classes.pageButton}
                                        >
                                            <ChevronsRight className="w-5 h-5" />
                                        </button>
                                    </li>
                                </Box>
                            </Box>
                        </Paper>
                    ) : (
                        /* Mobile View - Companies tem muitas colunas, então vou mostrar apenas as principais */
                        <>
                            <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                                {!loading && companies.length === 0 && (
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        Nenhuma empresa encontrada.
                                    </div>
                                )}
                                {companies.map((company) => (
                                    <div key={company.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3" style={rowStyle(company)}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <span className="font-semibold text-sm">{company.name}</span>
                                                <div className="text-xs text-gray-600 dark:text-gray-400">{company.email}</div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Tooltip {...CustomTooltipProps} title="Editar">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleEditCompany(company)}
                                                        style={{
                                                            color: "#374151",
                                                            backgroundColor: "#ffffff",
                                                            border: "1px solid #d1d5db",
                                                            borderRadius: "8px"
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip {...CustomTooltipProps} title="Deletar">
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setConfirmModalOpen(true);
                                            setDeletingCompany(company);
                                        }}
                                                        style={{
                                                            color: "#dc2626",
                                                            backgroundColor: "#ffffff",
                                                            border: "1px solid #d1d5db",
                                                            borderRadius: "8px"
                                                        }}
                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                            <div>ID: {company.id}</div>
                                            <div>Status: {renderStatus(company.status)}</div>
                                            <div>Plano: {company?.plan?.name || '-'}</div>
                                            <div>Valor: R$ {renderPlanValue(company)}</div>
                                            <div>Vencimento: {dateToClient(company.dueDate)}</div>
                                        </div>
                                    </div>
                        ))}
                                {loading && <TableRowSkeleton columns={13} />}
                            </div>
                            {/* Paginação Mobile */}
                            <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                    Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                                    {" "} de {" "}
                                    <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                                    {" "} • {" "}
                                    <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span> empresas
                                </span>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setPageNumber(1);
                                        }}
                                        className="text-xs bg-gray-50 border border-gray-300 rounded-md p-1 dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <option value={5}>5</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <ul className="inline-flex items-center -space-x-px">
                                        <li>
                                            <button
                                                onClick={() => handlePageChange(1)}
                                                disabled={pageNumber === 1}
                                                className="flex items-center justify-center px-2 h-8 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronsLeft className="w-4 h-4" />
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => handlePageChange(pageNumber - 1)}
                                                disabled={pageNumber === 1}
                                                className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                        </li>
                                        {renderPageNumbers.map((page, index) => (
                                            <li key={index}>
                                                <button
                                                    onClick={() => handlePageChange(page)}
                                                    className={`flex items-center justify-center px-2 h-8 leading-tight border
                                                        ${page === pageNumber
                                                            ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                                                            : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            </li>
                                        ))}
                                        <li>
                                            <button
                                                onClick={() => handlePageChange(pageNumber + 1)}
                                                disabled={pageNumber === totalPages}
                                                className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => handlePageChange(totalPages)}
                                                disabled={pageNumber === totalPages}
                                                className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronsRight className="w-4 h-4" />
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </nav>
                        </>
                    )}
                </Box>
        </MainContainer>
        </Box>
    );
};

export default Companies;