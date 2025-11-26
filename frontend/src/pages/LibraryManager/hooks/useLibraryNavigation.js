import { useState, useCallback } from 'react';

const useLibraryNavigation = () => {
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'Home' }]);

    const navigateToFolder = useCallback((folderId, folderName) => {
        setCurrentFolder(folderId);
        setBreadcrumbs(prev => {
            if (folderId === null || folderId === undefined) {
                return [{ id: null, name: 'Home' }];
            }

            const existingIndex = prev.findIndex(crumb => crumb.id === folderId);
            if (existingIndex >= 0) {
                return prev.slice(0, existingIndex + 1);
            }

            return [...prev, { id: folderId, name: folderName }];
        });
    }, []);

    const navigateUp = useCallback(() => {
        if (breadcrumbs.length > 1) {
            const newBreadcrumbs = breadcrumbs.slice(0, -1);
            setBreadcrumbs(newBreadcrumbs);
            setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1].id);
        }
    }, [breadcrumbs]);

    const navigateToBreadcrumb = useCallback((index) => {
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newBreadcrumbs);
        setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }, [breadcrumbs]);

    const reset = useCallback(() => {
        setCurrentFolder(null);
        setBreadcrumbs([{ id: null, name: 'Home' }]);
    }, []);

    return {
        currentFolder,
        breadcrumbs,
        navigateToFolder,
        navigateUp,
        navigateToBreadcrumb,
        reset
    };
};

export default useLibraryNavigation;
