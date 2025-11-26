import React from 'react';
import {
    TextField,
    Button,
    IconButton,
    InputAdornment,
    Toolbar
} from '@material-ui/core';
import {
    Search as SearchIcon,
    Add as AddIcon,
    CloudUpload as CloudUploadIcon,
    ViewModule as ViewModuleIcon,
    ViewList as ViewListIcon,
    DoneAll as DoneAllIcon
} from '@material-ui/icons';
import useStyles from '../styles';

const TopBar = ({
    searchValue,
    onSearchChange,
    onCreateClick,
    onUploadClick,
    onIndexAllClick,
    viewMode,
    onViewModeChange
}) => {
    const classes = useStyles();

    return (
        <Toolbar className={classes.topBar}>
            <TextField
                className={classes.searchField}
                placeholder="Pesquisar arquivos, pastas"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                variant="outlined"
                size="small"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" />
                        </InputAdornment>
                    )
                }}
            />

            <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={onCreateClick}
                style={{ marginLeft: 'auto' }}
            >
                Criar
            </Button>

            <Button
                variant="contained"
                color="primary"
                startIcon={<CloudUploadIcon />}
                onClick={onUploadClick}
                style={{ marginLeft: 8 }}
            >
                Upload
            </Button>

            <Button
                variant="contained"
                startIcon={<DoneAllIcon />}
                onClick={onIndexAllClick}
                style={{ marginLeft: 8, backgroundColor: '#2e7d32', color: '#fff' }}
            >
                Indexar
            </Button>

            <IconButton
                onClick={() => onViewModeChange('grid')}
                color={viewMode === 'grid' ? 'primary' : 'default'}
                style={{ marginLeft: 16 }}
            >
                <ViewModuleIcon />
            </IconButton>

            <IconButton
                onClick={() => onViewModeChange('list')}
                color={viewMode === 'list' ? 'primary' : 'default'}
            >
                <ViewListIcon />
            </IconButton>
        </Toolbar>
    );
};

export default TopBar;
