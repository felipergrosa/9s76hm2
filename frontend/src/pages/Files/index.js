import React, {
    useState,
    useEffect,
    useReducer,
    useCallback,
    useContext,
    useMemo,
} from "react";
import { toast } from "react-toastify";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import FileModal from "../../components/FileModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

const reducer = (state, action) => {
    if (action.type === "SET_FILES") {
        // Substitui completamente a lista (paginação por página)
        return [...action.payload];
    }
    if (action.type === "LOAD_FILES") {
        const files = action.payload;
        const newFiles = [];

        files.forEach((fileList) => {
            const fileListIndex = state.findIndex((s) => s.id === fileList.id);
            if (fileListIndex !== -1) {
                state[fileListIndex] = fileList;
            } else {
                newFiles.push(fileList);
            }
        });

        return [...state, ...newFiles];
    }

    if (action.type === "UPDATE_FILES") {
        const fileList = action.payload;
        const fileListIndex = state.findIndex((s) => s.id === fileList.id);

        if (fileListIndex !== -1) {
            state[fileListIndex] = fileList;
            return [...state];
        } else {
            return [fileList, ...state];
        }
    }

    if (action.type === "DELETE_FILE") {
        const fileListId = action.payload;

        const fileListIndex = state.findIndex((s) => s.id === fileListId);
        if (fileListIndex !== -1) {
            state.splice(fileListIndex, 1);
        }
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
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

const FILES_PER_PAGE = 25;

const FileLists = () => {
    const classes = useStyles();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
    const { user, socket } = useContext(AuthContext);
    const { hasPermission } = usePermissions();

    const [loading, setLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(FILES_PER_PAGE);
    const [totalItems, setTotalItems] = useState(0);
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [selectedFileList, setSelectedFileList] = useState(null);
    const [deletingFileList, setDeletingFileList] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const [files, dispatch] = useReducer(reducer, []);
    const [fileListModalOpen, setFileListModalOpen] = useState(false);

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

    const fetchFileLists = useCallback(async () => {
        try {
            const { data } = await api.get("/files/", {
                params: { 
                    searchParam, 
                    pageNumber,
                    limit: itemsPerPage,
                    orderBy: sortField || 'name',
                    order: sortDirection
                },
            });
            dispatch({ type: "SET_FILES", payload: data.files || [] });
            setTotalItems(typeof data.count === "number" ? data.count : (data.total || data.files?.length || 0));
            setLoading(false);
        } catch (err) {
            toastError(err);
            setLoading(false);
        }
    }, [searchParam, pageNumber, itemsPerPage, sortField, sortDirection]);

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [searchParam]);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            fetchFileLists();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [fetchFileLists]);

    useEffect(() => {
        // const socket = socketManager.GetSocket(user.companyId, user.id);

        const onFileEvent = (data) => {
            if (data.action === "update" || data.action === "create") {
                dispatch({ type: "UPDATE_FILES", payload: data.files });
            }

            if (data.action === "delete") {
                dispatch({ type: "DELETE_FILE", payload: +data.fileId });
            }
        };

        socket.on(`company-${user.companyId}-file`, onFileEvent);
        return () => {
            socket.off(`company-${user.companyId}-file`, onFileEvent);
        };
    }, [socket]);

    const handleOpenFileListModal = () => {
        setSelectedFileList(null);
        setFileListModalOpen(true);
    };

    const handleCloseFileListModal = () => {
        setSelectedFileList(null);
        setFileListModalOpen(false);
    };

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleEditFileList = (fileList) => {
        setSelectedFileList(fileList);
        setFileListModalOpen(true);
    };

    const handleDeleteFileList = async (fileListId) => {
        try {
            await api.delete(`/files/${fileListId}`);
            toast.success(i18n.t("files.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingFileList(null);
        setSearchParam("");
        setPageNumber(1);
        dispatch({ type: "RESET" });
        fetchFileLists();
    };

    return (
        <Box className={classes.root}>
            <MainContainer useWindowScroll>
                <Box className={classes.container}>
            <ConfirmationModal
                title={deletingFileList && `${i18n.t("files.confirmationModal.deleteTitle")}`}
                open={confirmModalOpen}
                onClose={setConfirmModalOpen}
                onConfirm={() => handleDeleteFileList(deletingFileList.id)}
            >
                {i18n.t("files.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <FileModal
                open={fileListModalOpen}
                onClose={handleCloseFileListModal}
                reload={fetchFileLists}
                aria-labelledby="form-dialog-title"
                fileListId={selectedFileList && selectedFileList.id}
            />
            {hasPermission("files.view") ? (
                <>
                    <MainHeader>
                                <Grid style={{ width: "99.6%" }} container>
                                    <Grid xs={12} sm={5} item>
                                        <Title>
                                            {i18n.t("files.title")} ({totalItems})
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
                                                <Tooltip {...CustomTooltipProps} title={i18n.t("files.buttons.add")}>
                            <Button
                                                        onClick={handleOpenFileListModal}
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
                                                        aria-label={i18n.t("files.buttons.add")}
                            >
                                {i18n.t("files.buttons.add")}
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
                                                    <th scope="col" style={{ textAlign: "center" }}>
                                                        <button 
                                                            onClick={() => handleSort('name')} 
                                                            className={classes.sortButton}
                                                            style={{ width: "100%", justifyContent: "center" }}
                                                        >
                                                            {i18n.t("files.table.name").toUpperCase()}
                                                            <span className={classes.sortIcon}>
                                                                {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                            </span>
                                                        </button>
                                                    </th>
                                                    <th scope="col" style={{ textAlign: "center" }}>
                                                        {i18n.t("files.table.actions").toUpperCase()}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className={classes.tableBody}>
                                                {!loading && files.length === 0 && (
                                                    <tr>
                                                        <td colSpan={2} className={classes.emptyState}>
                                                            Nenhum arquivo encontrado.
                                                        </td>
                                                    </tr>
                                                )}
                                                {files.map((fileList) => (
                                                    <tr key={fileList.id}>
                                                        <td style={{ textAlign: "center" }}>{fileList.name}</td>
                                                        <td style={{ textAlign: "center" }}>
                                                            <Tooltip {...CustomTooltipProps} title="Editar">
                                                                <IconButton 
                                                                    size="small" 
                                                                    onClick={() => handleEditFileList(fileList)}
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
                                                                    onClick={(e) => {
                                                                        setConfirmModalOpen(true);
                                                                        setDeletingFileList(fileList);
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
                                                {loading && <TableRowSkeleton columns={2} />}
                                            </tbody>
                                        </table>
                                    </Box>
                                    {/* Paginação Desktop */}
                                    <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                                        <span className={classes.paginationInfo}>
                                            Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                                            <strong>{totalItems}</strong> arquivos
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
                                /* Mobile View */
                                <>
                                    <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                                        {!loading && files.length === 0 && (
                                            <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                Nenhum arquivo encontrado.
                                            </div>
                                        )}
                                    {files.map((fileList) => (
                                            <div key={fileList.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-sm">{fileList.name}</span>
                                                    <div className="flex gap-1">
                                                        <Tooltip {...CustomTooltipProps} title="Editar">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleEditFileList(fileList)}
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
                                                    onClick={(e) => {
                                                        setConfirmModalOpen(true);
                                                        setDeletingFileList(fileList);
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
                                            </div>
                                        ))}
                                        {loading && <TableRowSkeleton columns={2} />}
                                    </div>
                                    {/* Paginação Mobile */}
                                    <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                            Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                                            {" "} de {" "}
                                            <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                                            {" "} • {" "}
                                            <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span> arquivos
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
                </>
            ) : <ForbiddenPage />}
                </Box>
        </MainContainer>
        </Box>
    );
};

export default FileLists;
