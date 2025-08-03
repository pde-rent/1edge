import React from 'react';
import { BaseModal, ModalSection, ModalInfoBox, ModalKeyValue } from '@/components/ui/base-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Order, OrderStatus, OrderType, OrderEvent } from '@common/types';
import { Clock, Hash, TrendingUp, Activity } from 'lucide-react';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onCancel?: (orderId: string) => void;
  onModify?: (orderId: string) => void;
}

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  onCancel,
  onModify,
}: OrderDetailsModalProps) {
  if (!order) return null;

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatAmount = (amount?: string) => {
    if (!amount) return 'N/A';
    return parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.ACTIVE:
        return 'bg-primary/20 border-primary text-primary';
      case OrderStatus.FILLED:
      case OrderStatus.COMPLETED:
        return 'bg-success/20 border-success text-success';
      case OrderStatus.CANCELLED:
      case OrderStatus.EXPIRED:
        return 'bg-muted border-muted-foreground text-muted-foreground';
      case OrderStatus.FAILED:
        return 'bg-destructive/20 border-destructive text-destructive';
      case OrderStatus.PARTIALLY_FILLED:
        return 'bg-warning/20 border-warning text-warning';
      default:
        return 'bg-muted border-muted-foreground text-muted-foreground';
    }
  };

  const renderParams = () => {
    if (!order.params) return null;

    const params = order.params as Record<string, any>;
    return Object.entries(params).map(([key, value]) => (
      <ModalKeyValue
        key={key}
        label={key.replace(/([A-Z])/g, ' $1').trim()}
        value={typeof value === 'number' ? value.toLocaleString() : String(value)}
      />
    ));
  };

  const mockTriggerHistory: OrderEvent[] = [
    {
      orderId: order.id,
      status: OrderStatus.PENDING,
      timestamp: order.createdAt,
    },
    {
      orderId: order.id,
      status: OrderStatus.ACTIVE,
      timestamp: order.createdAt + 1000,
      orderHash: '0x1234...5678',
    },
    {
      orderId: order.id,
      status: OrderStatus.ACTIVE,
      timestamp: order.createdAt + 2000,
      orderHash: '0x1234...5678',
    },
  ];

  const footerButtons = (
    <>
      <Button
        variant="outline"
        onClick={onClose}
        className="border-muted-foreground/50 text-muted-foreground hover:text-foreground"
      >
        Close
      </Button>
      {order.status === OrderStatus.ACTIVE && (
        <>
          <Button
            variant="outline"
            onClick={() => onModify?.(order.id)}
            className="border-warning/50 text-warning hover:bg-warning/10"
          >
            Modify
          </Button>
          <Button
            variant="outline"
            onClick={() => onCancel?.(order.id)}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            Cancel
          </Button>
        </>
      )}
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order Details - ${order.id}`}
      titleIcon={<Hash className="w-5 h-5" />}
      maxWidth="4xl"
      footer={footerButtons}
    >

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Order Info */}
        <div className="space-y-6">
          {/* Basic Info */}
          <ModalSection title="Order Information" icon={<TrendingUp className="w-4 h-4 text-primary" />}>
            <ModalInfoBox>
              <div className="space-y-1">
                <ModalKeyValue 
                  label="Type" 
                  value={<Badge variant="outline" className="bg-primary/10 border-primary/50 text-primary">{order.type}</Badge>}
                />
                <ModalKeyValue 
                  label="Status" 
                  value={<Badge variant="outline" className={getStatusBadgeStyle(order.status)}>{order.status}</Badge>}
                />
                <ModalKeyValue label="Total Size" value={formatAmount(order.size)} />
                <ModalKeyValue label="Remaining" value={formatAmount(order.remainingSize)} />
                <ModalKeyValue label="Created At" value={formatTimestamp(order.createdAt)} />
                <ModalKeyValue label="Trigger Count" value={order.triggerCount} />
                {order.nextTriggerValue && (
                  <ModalKeyValue label="Next Trigger" value={order.nextTriggerValue} />
                )}
              </div>
            </ModalInfoBox>
          </ModalSection>

          {/* Order Parameters */}
          <ModalSection title="Parameters">
            <ModalInfoBox>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {renderParams()}
                </div>
              </ScrollArea>
            </ModalInfoBox>
          </ModalSection>
        </div>

        {/* Right Column - Trigger History */}
        <div className="space-y-6">
          <ModalSection title="Trigger History" icon={<Activity className="w-4 h-4 text-primary" />}>
            <ModalInfoBox>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {mockTriggerHistory.map((event, index) => (
                    <div key={index} className="flex items-start gap-3 pb-4 border-b border-muted/20 last:border-b-0">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getStatusBadgeStyle(event.status)}>
                            {event.status}
                          </Badge>
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        {event.orderHash && (
                          <div className="text-xs font-mono text-muted-foreground">
                            Hash: {event.orderHash}
                          </div>
                        )}
                        {event.txHash && (
                          <div className="text-xs font-mono text-muted-foreground">
                            Tx: {event.txHash}
                          </div>
                        )}
                        {event.filledAmount && (
                          <div className="text-xs text-muted-foreground">
                            Filled: {formatAmount(event.filledAmount)}
                          </div>
                        )}
                        {event.error && (
                          <div className="text-xs text-destructive">
                            Error: {event.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </ModalInfoBox>
          </ModalSection>

          {/* 1inch Order Hashes */}
          {order.oneInchOrderHashes && order.oneInchOrderHashes.length > 0 && (
            <ModalSection title="1inch Orders">
              <ModalInfoBox>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {order.oneInchOrderHashes.map((hash, index) => (
                      <div key={index} className="text-xs font-mono text-muted-foreground p-2 bg-background/50 rounded border">
                        {hash}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </ModalInfoBox>
            </ModalSection>
          )}
        </div>
      </div>

    </BaseModal>
  );
}