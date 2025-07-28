import { ReactNode } from 'react';
import { Paper, Box, Typography } from '@mui/material';

interface BaseSectionProps {
  className?: string;
  children: ReactNode;
  [key: string]: any;
}

/**
 * BaseSection is a styled Paper component for consistent panel layout.
 * @param props - BaseSectionProps
 */
export function BaseSection({ className = "", children, ...props }: BaseSectionProps) {
  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        p: 2
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}

/**
 * BaseSectionTitle is a styled Typography component for section titles.
 * @param props - React component props
 */
export function BaseSectionTitle({ className = "", ...props }) {
  return (
    <Typography
      variant="h6"
      sx={{
        mb: 2,
        pb: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        fontWeight: 'medium'
      }}
      {...props}
    />
  );
}
