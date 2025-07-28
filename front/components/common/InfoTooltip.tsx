import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { THEME } from '@common/constants';

/**
 * Props for the InfoTooltip component.
 */
interface InfoTooltipProps {
  title: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * InfoTooltip displays a help icon with a tooltip for additional information.
 * @param props - InfoTooltipProps
 */
export default function InfoTooltip({ title, placement = 'right' }: InfoTooltipProps) {
  return (
    <Tooltip title={title} placement={placement}>
      <HelpOutlineIcon
        fontSize='inherit'
        sx={{
          fontSize: THEME.font.size.sm,
          color: THEME.text.secondary,
          cursor: 'pointer'
        }}
      />
    </Tooltip>
  );
}
