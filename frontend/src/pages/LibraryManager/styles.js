import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
    root: {
        display: 'flex',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden'
    },
    sidebar: {
        width: 240,
        borderRight: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(2),
        overflowY: 'auto',
        backgroundColor: theme.palette.background.paper
    },
    sidebarItem: {
        borderRadius: 8,
        marginBottom: theme.spacing(0.5),
        '&:hover': {
            backgroundColor: theme.palette.action.hover
        }
    },
    sidebarItemSelected: {
        backgroundColor: theme.palette.primary.light,
        color: theme.palette.primary.contrastText,
        '&:hover': {
            backgroundColor: theme.palette.primary.main
        }
    },
    mainContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    topBar: {
        padding: theme.spacing(2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(2)
    },
    searchField: {
        flex: 1,
        maxWidth: 600
    },
    breadcrumbNav: {
        padding: theme.spacing(1, 2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.default
    },
    contentArea: {
        flex: 1,
        padding: theme.spacing(3),
        overflowY: 'auto',
        ...theme.scrollbarStyles
    },
    gridContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: theme.spacing(2)
    },
    folderCard: {
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 8,
        padding: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[4],
            borderColor: theme.palette.primary.main
        }
    },
    fileCard: {
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 8,
        padding: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[4]
        }
    },
    itemIcon: {
        fontSize: 64,
        marginBottom: theme.spacing(1)
    },
    itemName: {
        textAlign: 'center',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        wordBreak: 'break-word'
    },
    itemMeta: {
        fontSize: 12,
        color: theme.palette.text.secondary,
        marginTop: theme.spacing(0.5)
    },
    uploadZone: {
        border: `2px dashed ${theme.palette.primary.main}`,
        borderRadius: 8,
        padding: theme.spacing(6),
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s',
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
            borderColor: theme.palette.primary.dark
        },
        '&.dragOver': {
            backgroundColor: theme.palette.primary.light,
            transform: 'scale(1.02)'
        }
    },
    statusBadge: {
        position: 'absolute',
        top: theme.spacing(1),
        right: theme.spacing(1),
        fontSize: 10,
        padding: '2px 6px'
    },
    menuButton: {
        position: 'absolute',
        top: theme.spacing(0.5),
        right: theme.spacing(0.5)
    },
    emptyState: {
        textAlign: 'center',
        padding: theme.spacing(8),
        color: theme.palette.text.secondary
    },
    storageInfo: {
        padding: theme.spacing(2),
        borderTop: `1px solid ${theme.palette.divider}`,
        marginTop: 'auto'
    }
}));

export default useStyles;
