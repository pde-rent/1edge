// @ts-nocheck
import {
  Paper,
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useState } from 'react';
import packageInfo from '../../package.json';

/**
 * Props for the AppInfoPanel component.
 */
interface AppInfoPanelProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onResetLayout: () => void;
  onSaveLayout: () => void;
  onLoadLayout: () => void;
  className?: string;
}

/**
 * AppInfoPanel displays application info, version, and layout controls.
 * @param props - AppInfoPanelProps
 */
export default function AppInfoPanel({
  isLocked,
  onToggleLock,
  onResetLayout,
  onSaveLayout,
  onLoadLayout,
  className
}: AppInfoPanelProps) {
  const [anchorSaveLoadEl, setAnchorSaveLoadEl] = useState<null | HTMLElement>(null);
  const openSaveLoad = Boolean(anchorSaveLoadEl);

  const handleSaveLoadClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorSaveLoadEl(event.currentTarget);
  };

  const handleSaveLoadClose = () => {
    setAnchorSaveLoadEl(null);
  };

  // Simplified version string (v0.1 instead of Version 0.1.0-beta)
  const versionString = `v${packageInfo.version.split('.').slice(0, 2).join('.')}`;

  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        width: '100%',
        p: 0,
        position: 'relative'
      }}
    >
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: '72px',
        px: 1,
        py: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="1edge"
            sx={{
              height: 52,
              width: 128,
              objectFit: 'contain',
              filter: 'contrast(1.1) brightness(1.05)',
              transform: 'scale(1.15)',
              ml: '1rem'
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: 16,
                ml: 1.5,
                mb: 0,
                fontWeight: 600,
                color: '#888888',
                letterSpacing: '0.01em',
                lineHeight: 1
              }}
            >
              {versionString}
            </Typography>
          </Box>
        </Box>
        <Box>
          <ToggleButtonGroup orientation="vertical" size="small" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Tooltip title={isLocked ? 'Unlock Layout' : 'Lock Layout'} placement="left">
              <ToggleButton
                value="lock"
                selected={isLocked}
                onChange={onToggleLock}
                aria-label="lock layout"
                onMouseDown={(e) => e.stopPropagation()}
                sx={{ p: 0, minWidth: 'auto', width: 28, height: 28 }}
              >
                {isLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Save or load custom layout" placement="left">
              <ToggleButton
                value="saveLoad"
                onClick={handleSaveLoadClick}
                aria-label="save or load layout"
                onMouseDown={(e) => e.stopPropagation()}
                sx={{ p: 0, minWidth: 'auto', width: 28, height: 28 }}
              >
                <SaveIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Reset to default layout" placement="left">
              <ToggleButton
                value="reset"
                onClick={onResetLayout}
                aria-label="reset layout"
                onMouseDown={(e) => e.stopPropagation()}
                sx={{ p: 0, minWidth: 'auto', width: 28, height: 28 }}
              >
                <RefreshIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Menu
            id="save-load-menu"
            anchorEl={anchorSaveLoadEl}
            open={openSaveLoad}
            onClose={handleSaveLoadClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => { onSaveLayout(); handleSaveLoadClose(); }}>
              <ListItemIcon><SaveIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Save Layout</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { onLoadLayout(); handleSaveLoadClose(); }}>
              <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Load Layout</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>
    </Paper>
  );
}
