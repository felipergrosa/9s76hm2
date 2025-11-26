import React from 'react';
import { Breadcrumbs, Link, Typography } from '@material-ui/core';
import { NavigateNext as NavigateNextIcon } from '@material-ui/icons';
import useStyles from '../styles';

const BreadcrumbNav = ({ breadcrumbs, onNavigate }) => {
    const classes = useStyles();

    return (
        <div className={classes.breadcrumbNav}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
                {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    return isLast ? (
                        <Typography key={crumb.id || 'home'} color="textPrimary">
                            {crumb.name}
                        </Typography>
                    ) : (
                        <Link
                            key={crumb.id || 'home'}
                            color="inherit"
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                onNavigate(index);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            {crumb.name}
                        </Link>
                    );
                })}
            </Breadcrumbs>
        </div>
    );
};

export default BreadcrumbNav;
