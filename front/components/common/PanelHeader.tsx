import { Typography, Box } from '@mui/material';
import { THEME } from '@common/constants';
import InfoTooltip from './InfoTooltip';

/**
 * Props for the HeaderPanel component.
 */
interface HeaderPanelProps {
  title: string;
  tooltip?: string;
}

/**
 * A standardized header component for panel sections
 * Ensures consistent styling across all panels in the application
 * @param props - HeaderPanelProps
 */
export default function HeaderPanel({ title, tooltip }: HeaderPanelProps) {
  return (
    <Box
      sx={{
        backgroundColor: THEME.background.paper,
        borderBottom: `1px solid ${THEME.background.overlay10}`,
        py: 1.5,
        px: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="subtitle1"
          align="center"
          sx={{
            fontWeight: 600,
            fontSize: THEME.font.size.sm,
            textTransform: 'uppercase',
            color: THEME.text.primary,
            letterSpacing: '0.5px'
          }}
        >
          {title}
        </Typography>
        {tooltip && <InfoTooltip title={tooltip} placement="right" />}
      </Box>
    </Box>
  );
}
