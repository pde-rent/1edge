import React from 'react';
import { Controller } from 'react-hook-form';

const MomentumReversalForm = ({ control, errors }) => (
  <div className="space-y-4">
    <div>
      <label htmlFor="amount" className="block text-sm font-medium text-gray-300">Amount</label>
      <Controller
        name="amount"
        control={control}
        defaultValue=""
        render={({ field }) => <input {...field} id="amount" className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 placeholder-gray-400 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50" />}
      />
    </div>
    <div>
      <label htmlFor="rsiPeriod" className="block text-sm font-medium text-gray-300">RSI Period</label>
      <Controller
        name="rsiPeriod"
        control={control}
        defaultValue="14"
        render={({ field }) => <input {...field} id="rsiPeriod" type="number" className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 placeholder-gray-400 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50" />}
      />
    </div>
    <div>
      <label htmlFor="rsimaPeriod" className="block text-sm font-medium text-gray-300">RSI MA Period</label>
      <Controller
        name="rsimaPeriod"
        control={control}
        defaultValue="14"
        render={({ field }) => <input {...field} id="rsimaPeriod" type="number" className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 placeholder-gray-400 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50" />}
      />
    </div>
    <div>
      <label htmlFor="tpPct" className="block text-sm font-medium text-gray-300">Take Profit %</label>
      <Controller
        name="tpPct"
        control={control}
        defaultValue="5"
        render={({ field }) => <input {...field} id="tpPct" type="number" className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 placeholder-gray-400 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50" />}
      />
    </div>
    <div>
      <label htmlFor="slPct" className="block text-sm font-medium text-gray-300">Stop Loss %</label>
      <Controller
        name="slPct"
        control={control}
        defaultValue="2"
        render={({ field }) => <input {...field} id="slPct" type="number" className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 placeholder-gray-400 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50" />}
      />
    </div>
  </div>
);

export default MomentumReversalForm;
