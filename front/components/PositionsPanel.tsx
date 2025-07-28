// @ts-nocheck
import { Paper, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Chip } from '@mui/material';
import PanelHeader from './common/PanelHeader';
import { roundSig } from '@common/utils';

/**
 * PositionsPanel displays a table of strategy positions across the platform.
 * Currently shows a placeholder until real positions are available.
 */
export default function PositionsPanel() {
  // Empty array for now, but will be populated with real positions later
  const positions = [];

  /**
   * Formats a timestamp for display.
   * @param timestamp - The timestamp to format.
   * @returns The formatted time string.
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  /**
   * Formats the size value for display.
   * @param value - The size value.
   * @returns The formatted string.
   */
  const formatSize = (value) => {
    if (value === undefined || value === null) return '-';
    return roundSig(value, 5).toLocaleString();
  };

  /**
   * Formats the entry value for display, using scientific notation for small values.
   * @param value - The entry value.
   * @returns The formatted string.
   */
  const formatEntry = (value) => {
    if (value === undefined || value === null) return '-';

    // Use scientific notation for values less than 0.001
    if (Math.abs(value) < 0.001 && value !== 0) {
      return roundSig(value, 6).toExponential();
    }

    return roundSig(value, 6).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  /**
   * Formats the PnL value for display.
   * @param value - The PnL value.
   * @returns The formatted string.
   */
  const formatPnL = (value) => {
    if (value === undefined || value === null) return '-';
    return roundSig(value, 6).toLocaleString();
  };

  /**
   * Gets the color for the type chip based on order type.
   * @param type - The order type.
   * @returns The color string.
   */
  const getTypeColor = (type) => {
    if (!type) return 'default';

    const buyTypes = ['buy', 'buy_limit', 'buy_stop'];
    const shortTypes = ['short', 'short_limit', 'short_stop'];

    if (buyTypes.includes(type.toLowerCase())) return 'primary';
    if (shortTypes.includes(type.toLowerCase())) return 'secondary';

    return 'default';
  };

  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        width: '100%',
        p: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <PanelHeader title="Positions" tooltip="Monitoring aggregated strategy positions across platform. Positions can be ordered (open order non executed, null exposure), open (non null exposure), closed (historical, null exposure)." />

      <TableContainer sx={{ maxHeight: '100%', width: '100%' }}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'left'
                }}
              >
                Strategy
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'left'
                }}
              >
                Market
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'left',
                  width: '90px'
                }}
              >
                Type
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'right'
                }}
              >
                Size
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'right'
                }}
              >
                Entry
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'right'
                }}
              >
                Updated
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'right'
                }}
              >
                PnL
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.length > 0 ? (
              positions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell align="left" sx={{ py: 0.5 }}>{position.strategy}</TableCell>
                  <TableCell align="left" sx={{ py: 0.5 }}>{position.market}</TableCell>
                  <TableCell align="left" sx={{ py: 0.5 }}>
                    <Chip
                      label={position.type}
                      size="small"
                      color={getTypeColor(position.type)}
                      sx={{ height: '20px', fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                    {formatSize(position.size)}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                    {formatEntry(position.entry)}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                    {formatTimestamp(position.updatedAt)}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, fontFamily: 'monospace' }}>
                    {formatPnL(position.pnl)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="text.secondary">
                    No positions available
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
