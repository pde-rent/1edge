'use client'
import React, { useState } from 'react';
import ActiveFeedPanel from "@/components/ActiveFeedPanel";
import CreateOrderForm from "@/components/dashboard/CreateOrderForm";
import FeedsPanel from "@/components/FeedsPanel";
import { Paper } from "@mui/material";

export default function Home() {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);

  const gridItemStyle = { 
    height: '100%', 
    width: '100%', 
    overflow: 'hidden' 
  };

  const paperStyle = {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  };

  const handleFeedSelect = (feedId: string) => {
    setSelectedFeedId(feedId);
  };

  return (
    <div className="pt-32 px-4 h-screen max-h-fit">
      <div className="grid grid-cols-12 gap-8 h-full max-h-[70%]">
        <div className="col-span-12 lg:col-span-3 h-full max-h-full">
          <div style={gridItemStyle} className="max-h-full">
            <Paper sx={paperStyle} elevation={2}>
              <FeedsPanel onSelect={handleFeedSelect} />
            </Paper>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 h-[65%]">
          <div style={gridItemStyle} className="max-h-full">
            <Paper sx={paperStyle} elevation={2}>
              <ActiveFeedPanel feedId={selectedFeedId} />
            </Paper>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3 h-full">
          <div className="h-full max-h-full overflow-y-auto">
            <CreateOrderForm />
          </div>
        </div>
      </div>
    </div>
  );
}